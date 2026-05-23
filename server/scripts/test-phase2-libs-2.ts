/**
 * Smoke tests for Phase 2 session 2: disputes + winner pool guardrails/math.
 *
 * Note: auditLog tests hit the live DB — skipped here to keep this file
 * pure-logic. AuditLog is exercised by integration in routes (Session 3).
 */

import 'dotenv/config';

import {
  windowHoursForRisk,
  computeWindow,
  actionForResolution,
  canRaiseDispute,
  isValidReason,
} from '../src/lib/disputes';

import {
  WINNER_POOL_MVP,
  checkWinnerPoolGuardrails,
  calculatePool,
  distribute,
  evaluateRepeatTransfer,
} from '../src/lib/winnerPool';

let passed = 0;
let failed = 0;

function eq<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

function truthy(actual: unknown, label: string) {
  if (actual) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`); }
}

function falsy(actual: unknown, label: string) {
  if (!actual) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} — got ${JSON.stringify(actual)}`); }
}

function section(name: string) { console.log(`\n── ${name} ──`); }

const baseConfig = {
  entryContributionAmount: 10,
  participantMinimum: 2,
  participantMaximum: 8,
  distributionMethod: 'ALL_COMPLETERS_EQUAL_SPLIT' as const,
  termsAccepted: true,
} as const;

const baseCtx = {
  visibility: 'PRIVATE' as const,
  intent: 'FRIENDS' as const,
  category: 'FITNESS' as const,
  reward: 'WINNER_POOL' as const,
  verification: 'PHOTO_UPLOAD' as const,
  winCondition: 'REACH_TARGET' as const,
  creatorAgeVerified: true,
  creatorJurisdiction: 'MY',
  creatorTrustScore: 80,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Disputes
// ═══════════════════════════════════════════════════════════════════════════

section('Disputes — window math');

eq(windowHoursForRisk('LOW'), 24, 'LOW = 24h');
eq(windowHoursForRisk('MEDIUM'), 48, 'MEDIUM = 48h');
eq(windowHoursForRisk('HIGH'), 72, 'HIGH = 72h');
eq(windowHoursForRisk('UNKNOWN'), 24, 'fallback = 24h');

{
  const end = new Date('2026-05-01T00:00:00Z');
  const now = new Date('2026-05-01T12:00:00Z'); // 12h after
  const w = computeWindow(end, 24, now);
  falsy(w.isClosed, 'window still open at 12h');
  eq(w.msRemaining, 12 * 3600 * 1000, 'msRemaining = 12h');
}

{
  const end = new Date('2026-05-01T00:00:00Z');
  const now = new Date('2026-05-02T01:00:00Z'); // 25h after
  const w = computeWindow(end, 24, now);
  truthy(w.isClosed, 'window closed at 25h');
  eq(w.msRemaining, 0, 'msRemaining = 0');
}

section('Disputes — canRaise');

{
  const v = canRaiseDispute({
    challengeEndAt: new Date('2026-05-01T00:00:00Z'),
    challengeLifecycle: 'DISPUTE_OPEN',
    disputeWindowHours: 24,
    now: new Date('2026-05-01T10:00:00Z'),
  });
  truthy(v.ok, 'can raise within window');
}

{
  const v = canRaiseDispute({
    challengeEndAt: null,
    challengeLifecycle: 'ACTIVE',
    disputeWindowHours: 24,
  });
  falsy(v.ok, 'cannot raise before challenge ends');
  eq(v.reason, 'challenge_not_ended', 'reason: not ended');
}

{
  const v = canRaiseDispute({
    challengeEndAt: new Date('2026-05-01T00:00:00Z'),
    challengeLifecycle: 'CANCELLED',
    disputeWindowHours: 24,
    now: new Date('2026-05-01T10:00:00Z'),
  });
  falsy(v.ok, 'cannot raise on cancelled');
}

section('Disputes — resolution actions');

eq(actionForResolution('UPHELD', { affectedParticipantId: null, severity: 'low' }).type, 'RECALCULATE_WINNERS', 'UPHELD = recalc');
eq(actionForResolution('UPHELD', { affectedParticipantId: 'p1', severity: 'high' }).type, 'DISQUALIFY_PARTICIPANT', 'UPHELD+high = DQ');
eq(actionForResolution('REJECTED', {}).type, 'NO_CHANGE', 'REJECTED = no change');
eq(actionForResolution('WITHDRAWN', {}).type, 'NO_CHANGE', 'WITHDRAWN = no change');
eq(actionForResolution('RESOLVED_VOID', {}).type, 'VOID_CHALLENGE', 'VOID = refund all');

truthy(isValidReason('FAKE_PROOF'), 'valid reason');
falsy(isValidReason('NOT_A_REAL_REASON'), 'invalid reason');

// ═══════════════════════════════════════════════════════════════════════════
// Winner Pool guardrails
// ═══════════════════════════════════════════════════════════════════════════

section('Winner Pool — guardrails (happy path)');

{
  const v = checkWinnerPoolGuardrails(baseConfig, baseCtx);
  truthy(v.ok, 'baseline config passes');
  eq(v.errors, [], 'no errors');
}

section('Winner Pool — guardrails (caps)');

{
  const v = checkWinnerPoolGuardrails({ ...baseConfig, entryContributionAmount: 51 }, baseCtx);
  falsy(v.ok, 'RM 51 entry blocked');
  truthy(v.errors.some((e) => e.includes('cap of RM 50')), 'error mentions cap');
}

{
  const v = checkWinnerPoolGuardrails({ ...baseConfig, entryContributionAmount: 0.5 }, baseCtx);
  falsy(v.ok, 'RM 0.50 entry blocked');
}

{
  // 30 × RM 20 = RM 600 total, exceeds RM 500 cap
  const v = checkWinnerPoolGuardrails(
    { ...baseConfig, entryContributionAmount: 20, participantMaximum: 30 },
    baseCtx,
  );
  falsy(v.ok, 'total pool > RM 500 blocked');
  truthy(v.errors.some((e) => e.includes('Max participants')), 'flags max participants');
}

{
  // RM 50 × 10 = RM 500 — at the edge, should pass
  const v = checkWinnerPoolGuardrails(
    { ...baseConfig, entryContributionAmount: 50, participantMaximum: 10 },
    baseCtx,
  );
  truthy(v.ok, 'RM 500 total pool OK at edge');
}

section('Winner Pool — guardrails (visibility)');

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx, visibility: 'PUBLIC' });
  falsy(v.ok, 'PUBLIC visibility blocked');
  truthy(v.errors.some((e) => e.includes('private/group-only')), 'error mentions private-only');
}

section('Winner Pool — guardrails (verification)');

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx, verification: 'SELF_DECLARATION' });
  falsy(v.ok, 'self-declaration blocked');
}

section('Winner Pool — guardrails (distribution)');

{
  const v = checkWinnerPoolGuardrails(
    { ...baseConfig, distributionMethod: 'WINNER_TAKES_ALL' },
    baseCtx,
  );
  falsy(v.ok, 'WINNER_TAKES_ALL blocked in MVP');
}

{
  const v = checkWinnerPoolGuardrails(
    { ...baseConfig, distributionMethod: 'RANKED_PERCENTAGE' },
    baseCtx,
  );
  falsy(v.ok, 'RANKED_PERCENTAGE without config blocked');
  truthy(v.errors.some((e) => e.includes('rankPercentages')), 'flags missing config');
}

{
  const v = checkWinnerPoolGuardrails(
    {
      ...baseConfig,
      distributionMethod: 'RANKED_PERCENTAGE',
      payoutConfig: { rankPercentages: [50, 30, 25] }, // sums to 105
    },
    baseCtx,
  );
  falsy(v.ok, 'percentages not summing to 100 blocked');
}

{
  const v = checkWinnerPoolGuardrails(
    {
      ...baseConfig,
      distributionMethod: 'RANKED_PERCENTAGE',
      payoutConfig: { rankPercentages: [50, 30, 20] },
    },
    baseCtx,
  );
  truthy(v.ok, 'percentages summing to 100 pass');
}

{
  const v = checkWinnerPoolGuardrails(
    { ...baseConfig, distributionMethod: 'TEAM_SPLIT' },
    baseCtx, // winCondition = REACH_TARGET, not TEAM_TARGET
  );
  falsy(v.ok, 'TEAM_SPLIT requires TEAM_TARGET');
}

section('Winner Pool — guardrails (creator)');

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx, creatorAgeVerified: false });
  falsy(v.ok, 'unverified age blocked');
}

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx, creatorJurisdiction: 'US' });
  falsy(v.ok, 'restricted jurisdiction blocked');
}

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx, creatorTrustScore: 30 });
  falsy(v.ok, 'low trust blocked');
}

{
  const v = checkWinnerPoolGuardrails(baseConfig, { ...baseCtx });
  // No termsAccepted = false missing
  const v2 = checkWinnerPoolGuardrails({ ...baseConfig, termsAccepted: false }, baseCtx);
  falsy(v2.ok, 'untermed config blocked');
}

// ═══════════════════════════════════════════════════════════════════════════
// Pool math
// ═══════════════════════════════════════════════════════════════════════════

section('Pool math — calculation');

{
  const r = calculatePool({
    heldContributions: [
      { participantId: 'a', amount: 10 },
      { participantId: 'b', amount: 10 },
      { participantId: 'c', amount: 10 },
    ],
    refundedAmountTotal: 0,
  });
  eq(r.totalPool, 30, 'total pool 3 × 10');
  eq(r.netPool, 30, 'net = total (no fee)');
}

{
  const r = calculatePool({
    heldContributions: [
      { participantId: 'a', amount: 10 },
      { participantId: 'b', amount: 10 },
    ],
    refundedAmountTotal: 0,
    platformFeePercentage: 10,
  });
  eq(r.platformFee, 2, '10% fee on RM 20 = RM 2');
  eq(r.netPool, 18, 'net = 18');
}

// ═══════════════════════════════════════════════════════════════════════════
// Distribution
// ═══════════════════════════════════════════════════════════════════════════

section('Distribution — all completers equal');

{
  const r = distribute({
    method: 'ALL_COMPLETERS_EQUAL_SPLIT',
    netPool: 100,
    winners: [
      { participantId: 'a', userId: 'u1' },
      { participantId: 'b', userId: 'u2' },
      { participantId: 'c', userId: 'u3' },
      { participantId: 'd', userId: 'u4' },
      { participantId: 'e', userId: 'u5' },
    ],
  });
  eq(r.allocations.length, 5, '5 allocations');
  eq(r.allocations[0]!.payoutAmount, 20, '20 per winner');
  eq(r.remainder, 0, 'no remainder on clean divide');
}

{
  // 100 / 3 = 33.33 with .01 remainder
  const r = distribute({
    method: 'ALL_COMPLETERS_EQUAL_SPLIT',
    netPool: 100,
    winners: [
      { participantId: 'a', userId: 'u1' },
      { participantId: 'b', userId: 'u2' },
      { participantId: 'c', userId: 'u3' },
    ],
  });
  eq(r.allocations[0]!.payoutAmount, 33.33, 'RM 33.33 per winner');
  eq(r.remainder, 0.01, 'RM 0.01 remainder');
}

section('Distribution — ranked %');

{
  const r = distribute({
    method: 'RANKED_PERCENTAGE',
    netPool: 100,
    winners: [
      { participantId: 'a', userId: 'u1', finalRank: 1 },
      { participantId: 'b', userId: 'u2', finalRank: 2 },
      { participantId: 'c', userId: 'u3', finalRank: 3 },
    ],
    rankPercentages: [50, 30, 20],
  });
  const byRank = Object.fromEntries(r.allocations.map((a) => [a.participantId, a.payoutAmount]));
  eq(byRank.a, 50, 'rank 1 = 50');
  eq(byRank.b, 30, 'rank 2 = 30');
  eq(byRank.c, 20, 'rank 3 = 20');
}

section('Distribution — proportional');

{
  const r = distribute({
    method: 'PROPORTIONAL',
    netPool: 100,
    winners: [
      { participantId: 'a', userId: 'u1', verifiedScore: 10 },
      { participantId: 'b', userId: 'u2', verifiedScore: 30 },
      { participantId: 'c', userId: 'u3', verifiedScore: 10 },
    ],
  });
  const byId = Object.fromEntries(r.allocations.map((a) => [a.participantId, a.payoutAmount]));
  eq(byId.a, 20, 'a: 10/50 = 20');
  eq(byId.b, 60, 'b: 30/50 = 60');
  eq(byId.c, 20, 'c: 10/50 = 20');
}

section('Distribution — team split');

{
  const r = distribute({
    method: 'TEAM_SPLIT',
    netPool: 100,
    winners: [
      { participantId: 'a', userId: 'u1', teamId: 'T1' },
      { participantId: 'b', userId: 'u2', teamId: 'T1' },
      { participantId: 'c', userId: 'u3', teamId: 'T2' },
      { participantId: 'd', userId: 'u4', teamId: 'T2' },
    ],
  });
  // 100 / 2 teams = 50 per team. 50 / 2 members = 25.
  const allEqual = r.allocations.every((a) => a.payoutAmount === 25);
  truthy(allEqual, 'all 4 winners get 25');
}

section('Distribution — winner takes all (lib only, not MVP)');

{
  const r = distribute({
    method: 'WINNER_TAKES_ALL',
    netPool: 100,
    winners: [{ participantId: 'a', userId: 'u1' }],
  });
  eq(r.allocations[0]!.payoutAmount, 100, '1 winner gets 100');
}

section('Distribution — winner takes all with cap');

{
  const r = distribute({
    method: 'WINNER_TAKES_ALL',
    netPool: 100,
    winners: [{ participantId: 'a', userId: 'u1' }],
    maxPayoutPerUser: 50,
  });
  eq(r.allocations[0]!.payoutAmount, 50, 'capped at 50');
  eq(r.remainder, 50, 'remainder 50 to suspense');
}

section('Distribution — empty winners');

{
  const r = distribute({
    method: 'ALL_COMPLETERS_EQUAL_SPLIT',
    netPool: 100,
    winners: [],
  });
  eq(r.allocations.length, 0, 'no allocations');
  eq(r.remainder, 100, 'full remainder');
}

// ═══════════════════════════════════════════════════════════════════════════
// Money-laundering signals
// ═══════════════════════════════════════════════════════════════════════════

section('Money laundering — repeat transfer signal');

{
  const s = evaluateRepeatTransfer({ pastChallengeCount: 1, amountTransferredBetween: 50 });
  falsy(s.flagged, 'single small transfer ignored');
}

{
  const s = evaluateRepeatTransfer({ pastChallengeCount: 5, amountTransferredBetween: 100 });
  truthy(s.flagged, 'repeat 5x flagged');
  truthy(s.reason?.includes('5 times'), 'reason mentions count');
}

{
  const s = evaluateRepeatTransfer({ pastChallengeCount: 1, amountTransferredBetween: 300 });
  truthy(s.flagged, 'high cumulative flagged');
  truthy(s.reason?.includes('RM 300'), 'reason mentions amount');
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Passed: ${passed}   Failed: ${failed}`);
console.log('═'.repeat(60));
process.exit(failed > 0 ? 1 : 0);
