/**
 * Winner Pool engine — Winner Pool PRD §7, §10, §11, §12, §19, §21.
 *
 * Three layers:
 *   1. Guardrails — pre-create validation (private only, RM50/RM500 caps,
 *      no self-declaration, etc).
 *   2. Pool math — calculate net pool, apply distribution method, decide
 *      per-winner amounts.
 *   3. Money-laundering signals — detect same-group repeat transfers.
 *
 * All pure functions. Routes call into these, no DB writes happen here
 * (the routes do the DB writes wrapped in transactions).
 */

import type { WinConditionCode } from './winConditions';
import type { CategoryV2, CreatorIntent, Visibility } from './moderation';
import type { VerificationLevel, RewardType } from './verification';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DistributionMethod =
  | 'ALL_COMPLETERS_EQUAL_SPLIT'
  | 'TOP_N_EQUAL_SPLIT'
  | 'RANKED_PERCENTAGE'
  | 'PROPORTIONAL'
  | 'WINNER_TAKES_ALL'
  | 'TEAM_SPLIT';

export type NoWinnerRule =
  | 'REFUND_ALL'
  | 'ROLL_TO_CHARITY'
  | 'ROLL_TO_PLATFORM'
  | 'ADMIN_DECISION';

// ─── MVP constraints — Winner Pool PRD §10.1 + §26 ──────────────────────────

export const WINNER_POOL_MVP = {
  minContributionMyr: 1,
  maxContributionMyr: 50,
  maxTotalPoolMyr: 500,
  minParticipants: 2,
  maxParticipants: 20,
  defaultDisputeWindowHours: 24,
  defaultNoWinnerRule: 'REFUND_ALL' as NoWinnerRule,
  allowedVisibilities: ['PRIVATE', 'GROUP'] as ReadonlyArray<Visibility>,
  blockedDistributionMethods: ['WINNER_TAKES_ALL'] as ReadonlyArray<DistributionMethod>,
  blockedCategories: [] as ReadonlyArray<CategoryV2>, // category-level handled in moderation
} as const;

// ─── Guardrail input ────────────────────────────────────────────────────────

export interface WinnerPoolConfig {
  entryContributionAmount: number;
  participantMinimum: number;
  participantMaximum: number;
  distributionMethod: DistributionMethod;
  noWinnerRule?: NoWinnerRule;
  payoutConfig?: {
    rankPercentages?: number[]; // for RANKED_PERCENTAGE
  } | null;
  termsAccepted: boolean;
  // Optional MVP-tier opts
  maxPayoutPerUser?: number | null;
  minimumScoreToQualify?: number | null;
  platformFeePercentage?: number | null;
  platformFeeFixed?: number | null;
}

export interface CreateContext {
  visibility: Visibility;
  intent: CreatorIntent;
  category: CategoryV2;
  reward: RewardType;
  verification: VerificationLevel;
  winCondition: WinConditionCode;
  creatorAgeVerified: boolean;
  creatorJurisdiction?: string | null;
  creatorTrustScore?: number;
}

export interface GuardrailVerdict {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Guardrails — pre-create validation ─────────────────────────────────────

const ALLOWED_JURISDICTIONS = new Set(['MY', 'SG', 'TH', 'ID', 'PH', 'VN']);

export function checkWinnerPoolGuardrails(
  config: WinnerPoolConfig,
  ctx: CreateContext,
): GuardrailVerdict {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ─── Reward / verification basics (mirrors verification.ts but explicit) ─
  if (ctx.reward !== 'WINNER_POOL') {
    errors.push('reward_type must be WINNER_POOL');
  }
  if (ctx.verification === 'SELF_DECLARATION') {
    errors.push('Winner Pool challenges cannot use self-declaration verification.');
  }

  // ─── Visibility ────────────────────────────────────────────────────────
  if (!WINNER_POOL_MVP.allowedVisibilities.includes(ctx.visibility)) {
    errors.push(
      `Winner Pool challenges are private/group-only in MVP (got ${ctx.visibility}).`,
    );
  }

  // ─── Contribution limits ───────────────────────────────────────────────
  if (config.entryContributionAmount < WINNER_POOL_MVP.minContributionMyr) {
    errors.push(
      `Entry must be at least RM ${WINNER_POOL_MVP.minContributionMyr}.`,
    );
  }
  if (config.entryContributionAmount > WINNER_POOL_MVP.maxContributionMyr) {
    errors.push(
      `Entry exceeds MVP cap of RM ${WINNER_POOL_MVP.maxContributionMyr}.`,
    );
  }

  // ─── Participant range ─────────────────────────────────────────────────
  if (config.participantMinimum < WINNER_POOL_MVP.minParticipants) {
    errors.push(
      `Min participants must be ≥ ${WINNER_POOL_MVP.minParticipants}.`,
    );
  }
  if (config.participantMaximum > WINNER_POOL_MVP.maxParticipants) {
    errors.push(
      `Max participants must be ≤ ${WINNER_POOL_MVP.maxParticipants}.`,
    );
  }
  if (config.participantMaximum < config.participantMinimum) {
    errors.push('Max participants must be ≥ min participants.');
  }

  // ─── Total pool ceiling ────────────────────────────────────────────────
  const maxPool = config.entryContributionAmount * config.participantMaximum;
  if (maxPool > WINNER_POOL_MVP.maxTotalPoolMyr) {
    errors.push(
      `Max total pool RM ${maxPool} exceeds MVP cap of RM ${WINNER_POOL_MVP.maxTotalPoolMyr}.`,
    );
  }

  // ─── Distribution method ──────────────────────────────────────────────
  if (WINNER_POOL_MVP.blockedDistributionMethods.includes(config.distributionMethod)) {
    errors.push(
      `Distribution method ${config.distributionMethod} is not allowed in MVP.`,
    );
  }
  if (config.distributionMethod === 'RANKED_PERCENTAGE') {
    const pcts = config.payoutConfig?.rankPercentages ?? [];
    if (pcts.length === 0) {
      errors.push('RANKED_PERCENTAGE needs payoutConfig.rankPercentages.');
    } else {
      const sum = pcts.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(`Rank percentages must sum to 100 (got ${sum}).`);
      }
    }
  }
  // Match distribution method to win-condition reality
  if (config.distributionMethod === 'TEAM_SPLIT' && ctx.winCondition !== 'TEAM_TARGET') {
    errors.push('TEAM_SPLIT distribution requires TEAM_TARGET win condition.');
  }
  if (config.distributionMethod === 'TOP_N_EQUAL_SPLIT' && !isRankBased(ctx.winCondition)) {
    warnings.push('TOP_N_EQUAL_SPLIT works best with ranking-based win conditions.');
  }

  // ─── Terms ─────────────────────────────────────────────────────────────
  if (!config.termsAccepted) {
    errors.push('Creator must accept Winner Pool terms.');
  }

  // ─── Creator eligibility — Winner Pool §6.1 / §6.2 ─────────────────────
  if (!ctx.creatorAgeVerified) {
    errors.push('Creator must be 18+ (age verification required).');
  }
  if (ctx.creatorJurisdiction && !ALLOWED_JURISDICTIONS.has(ctx.creatorJurisdiction)) {
    errors.push(
      `Winner Pool not yet available in jurisdiction ${ctx.creatorJurisdiction}.`,
    );
  }
  if (typeof ctx.creatorTrustScore === 'number' && ctx.creatorTrustScore < 40) {
    errors.push('Creator trust score too low for Winner Pool challenges.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

function isRankBased(win: WinConditionCode): boolean {
  return (
    win === 'RANK_TOP_N' ||
    win === 'RANK_TOP_PERCENT' ||
    win === 'FASTEST_COMPLETION' ||
    win === 'JUDGED_BEST'
  );
}

// ─── Pool math — Winner Pool PRD §11 ────────────────────────────────────────

export interface PoolMathInput {
  /** Contributions held + currently in the pool (status = HELD). */
  heldContributions: Array<{ participantId: string; amount: number }>;
  /** Contributions already refunded — exclude from total. */
  refundedAmountTotal: number;
  platformFeePercentage?: number; // 0-100
  platformFeeFixed?: number;
}

export interface PoolMathResult {
  totalPool: number;
  adjustedPool: number; // after refunds
  platformFee: number;
  netPool: number;
}

export function calculatePool(input: PoolMathInput): PoolMathResult {
  const totalPool = input.heldContributions.reduce((sum, c) => sum + c.amount, 0);
  const adjustedPool = totalPool; // refunds already excluded from heldContributions
  const _refundsAlreadyExcluded = input.refundedAmountTotal; // for audit clarity
  void _refundsAlreadyExcluded;

  const pctFee = ((input.platformFeePercentage ?? 0) / 100) * adjustedPool;
  const fixedFee = input.platformFeeFixed ?? 0;
  const platformFee = round2(pctFee + fixedFee);
  const netPool = round2(Math.max(0, adjustedPool - platformFee));

  return {
    totalPool: round2(totalPool),
    adjustedPool: round2(adjustedPool),
    platformFee,
    netPool,
  };
}

// ─── Distribution — Winner Pool PRD §12 ─────────────────────────────────────

export interface WinnerInput {
  participantId: string;
  userId: string;
  /** Verified score for proportional/ranked. */
  verifiedScore?: number;
  /** Final rank from win-condition finalize. */
  finalRank?: number | null;
  /** Team id for TEAM_SPLIT. */
  teamId?: string | null;
}

export interface DistributionInput {
  method: DistributionMethod;
  netPool: number;
  winners: WinnerInput[];
  rankPercentages?: number[]; // for RANKED_PERCENTAGE
  maxPayoutPerUser?: number | null;
}

export interface PayoutAllocation {
  participantId: string;
  userId: string;
  payoutAmount: number;
  payoutFormula: string;
}

export interface DistributionResult {
  allocations: PayoutAllocation[];
  /** Cents (or sub-unit) that didn't divide evenly — routes to platform suspense. */
  remainder: number;
}

export function distribute(input: DistributionInput): DistributionResult {
  const { method, netPool, winners } = input;

  if (winners.length === 0) {
    return { allocations: [], remainder: netPool };
  }

  switch (method) {
    case 'ALL_COMPLETERS_EQUAL_SPLIT': {
      return equalSplit(netPool, winners, 'all_completers / n');
    }
    case 'TOP_N_EQUAL_SPLIT': {
      // Caller already filtered winners to top N. Just equal split.
      return equalSplit(netPool, winners, `top_${winners.length} / n`);
    }
    case 'RANKED_PERCENTAGE': {
      return rankedPercent(netPool, winners, input.rankPercentages ?? []);
    }
    case 'PROPORTIONAL': {
      return proportional(netPool, winners);
    }
    case 'WINNER_TAKES_ALL': {
      // Not MVP but supported in lib for later phases
      const sole = winners[0];
      if (!sole) return { allocations: [], remainder: netPool };
      const capped = applyCap(netPool, input.maxPayoutPerUser);
      return {
        allocations: [
          {
            participantId: sole.participantId,
            userId: sole.userId,
            payoutAmount: capped.amount,
            payoutFormula: 'winner_takes_all',
          },
        ],
        remainder: round2(netPool - capped.amount),
      };
    }
    case 'TEAM_SPLIT': {
      return teamSplit(netPool, winners);
    }
  }
}

// ─── Distribution helpers ───────────────────────────────────────────────────

function equalSplit(
  netPool: number,
  winners: WinnerInput[],
  formula: string,
): DistributionResult {
  const per = round2(netPool / winners.length);
  const distributed = round2(per * winners.length);
  return {
    allocations: winners.map((w) => ({
      participantId: w.participantId,
      userId: w.userId,
      payoutAmount: per,
      payoutFormula: formula,
    })),
    remainder: round2(netPool - distributed),
  };
}

function rankedPercent(
  netPool: number,
  winners: WinnerInput[],
  pcts: number[],
): DistributionResult {
  // winners must be sorted by finalRank ascending
  const sorted = [...winners].sort(
    (a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity),
  );
  const allocations: PayoutAllocation[] = [];
  let distributed = 0;
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i]!;
    const pct = pcts[i] ?? 0;
    const amt = round2((netPool * pct) / 100);
    allocations.push({
      participantId: w.participantId,
      userId: w.userId,
      payoutAmount: amt,
      payoutFormula: `ranked rank=${w.finalRank} pct=${pct}`,
    });
    distributed += amt;
  }
  return { allocations, remainder: round2(netPool - distributed) };
}

function proportional(netPool: number, winners: WinnerInput[]): DistributionResult {
  const totalScore = winners.reduce((s, w) => s + (w.verifiedScore ?? 0), 0);
  if (totalScore <= 0) {
    // Fallback to equal split if all scores are zero
    return equalSplit(netPool, winners, 'proportional (fallback equal)');
  }
  const allocations: PayoutAllocation[] = [];
  let distributed = 0;
  for (const w of winners) {
    const share = (w.verifiedScore ?? 0) / totalScore;
    const amt = round2(netPool * share);
    allocations.push({
      participantId: w.participantId,
      userId: w.userId,
      payoutAmount: amt,
      payoutFormula: `proportional score=${w.verifiedScore}/${totalScore}`,
    });
    distributed += amt;
  }
  return { allocations, remainder: round2(netPool - distributed) };
}

function teamSplit(netPool: number, winners: WinnerInput[]): DistributionResult {
  // Group by team
  const byTeam = new Map<string, WinnerInput[]>();
  for (const w of winners) {
    if (!w.teamId) continue;
    const arr = byTeam.get(w.teamId) ?? [];
    arr.push(w);
    byTeam.set(w.teamId, arr);
  }
  const teamCount = byTeam.size;
  if (teamCount === 0) return { allocations: [], remainder: netPool };

  // Equal pool per winning team, then equal member split per team
  const perTeam = round2(netPool / teamCount);
  const allocations: PayoutAllocation[] = [];
  let distributed = 0;
  for (const [teamId, members] of byTeam.entries()) {
    const per = round2(perTeam / members.length);
    for (const m of members) {
      allocations.push({
        participantId: m.participantId,
        userId: m.userId,
        payoutAmount: per,
        payoutFormula: `team_split team=${teamId} per_team=${perTeam} members=${members.length}`,
      });
      distributed += per;
    }
  }
  return { allocations, remainder: round2(netPool - distributed) };
}

function applyCap(amount: number, cap?: number | null): { amount: number; cappedFrom?: number } {
  if (cap == null || cap <= 0) return { amount: round2(amount) };
  if (amount > cap) return { amount: round2(cap), cappedFrom: round2(amount) };
  return { amount: round2(amount) };
}

function round2(n: number): number {
  // Round down to nearest cent — remainder routes to platform suspense per PRD §11.4
  return Math.floor(n * 100) / 100;
}

// ─── Money-laundering signals — Winner Pool §21.3 ───────────────────────────

export interface RepeatTransferSignal {
  /** Sum of pool amounts where this creator was paid by this winner before. */
  amountTransferredBetween: number;
  /** Count of past challenges with same creator + same winner. */
  pastChallengeCount: number;
  /** Days since first such challenge. */
  daysSpan?: number;
  /** Triggered? */
  flagged: boolean;
  reason?: string;
}

/**
 * Detect "same-group repeats" — A and B keep transferring pools between
 * themselves. PRD §21.3 mandatory control.
 *
 * Thresholds are conservative for MVP. Tune from real data.
 */
export function evaluateRepeatTransfer(args: {
  pastChallengeCount: number;
  amountTransferredBetween: number;
  daysSpan?: number;
}): RepeatTransferSignal {
  const COUNT_THRESHOLD = 3;
  const AMOUNT_THRESHOLD = 200; // MYR
  let flagged = false;
  let reason: string | undefined;

  if (args.pastChallengeCount >= COUNT_THRESHOLD) {
    flagged = true;
    reason = `same group ${args.pastChallengeCount} times`;
  }
  if (args.amountTransferredBetween >= AMOUNT_THRESHOLD) {
    flagged = true;
    reason = `${reason ? `${reason}; ` : ''}cumulative RM ${args.amountTransferredBetween} between same parties`;
  }
  return {
    pastChallengeCount: args.pastChallengeCount,
    amountTransferredBetween: args.amountTransferredBetween,
    daysSpan: args.daysSpan,
    flagged,
    reason,
  };
}
