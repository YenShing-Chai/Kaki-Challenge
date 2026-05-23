/**
 * Win-condition engine — PRD §6.
 *
 * Eleven evaluation strategies, each a pure function. Inputs: participant
 * progress + the rule that was set on the challenge. Output: a typed
 * verdict the resolution job and leaderboard can rely on.
 *
 * No DB access here. Callers load data, build the inputs, and call evaluate().
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type WinConditionCode =
  | 'COMPLETE_ALL'
  | 'COMPLETE_MINIMUM'
  | 'REACH_TARGET'
  | 'STAY_BELOW_LIMIT'
  | 'RANK_TOP_N'
  | 'RANK_TOP_PERCENT'
  | 'TEAM_TARGET'
  | 'LAST_REMAINING'
  | 'FASTEST_COMPLETION'
  | 'JUDGED_BEST'
  | 'NO_VIOLATION';

/** Result for a single participant. */
export type ResultStatus = 'SUCCESS' | 'FAILED' | 'DISQUALIFIED' | 'PENDING_REVIEW';

export interface ParticipantSnapshot {
  /** Participant DB row id (passed through to results). */
  participantId: string;
  userId: string;
  /** Total verified completion days (or task count for COMPLETE_*). */
  completionCount: number;
  /** Verified primary metric (steps, savings, etc). */
  progressValue: number;
  /** Days the participant failed to hit the target. */
  missedCount: number;
  /** Approved submissions count. */
  approvedSubmissionCount: number;
  /** True if any disqualifying flag landed during the challenge. */
  disqualified: boolean;
  /** True if at least one submission is still PENDING_REVIEW. */
  hasPendingProof: boolean;
  /** Timestamp (ms) of earliest APPROVED submission, for FASTEST_COMPLETION. */
  firstCompletedAt?: number;
  /** Judge/vote score, for JUDGED_BEST. */
  judgedScore?: number;
  /** Optional team id, for TEAM_TARGET. */
  teamId?: string | null;
  /** Total violations recorded, for NO_VIOLATION + LAST_REMAINING. */
  violationCount?: number;
}

export interface ChallengeRuleInputs {
  winConditionType: WinConditionCode;
  targetValue?: number | null;
  limitValue?: number | null;
  requiredCount?: number | null;
  allowedMisses?: number | null;
  winnerCount?: number | null;
  winnerPercentage?: number | null;
  teamTargetValue?: number | null;
  individualMinimumValue?: number | null;
  rankingOrder?: 'ASC' | 'DESC' | string | null;
  tieBreaker?: string | null;
}

export interface EvaluationVerdict {
  participantId: string;
  userId: string;
  resultStatus: ResultStatus;
  finalScore: number | null;
  finalRank: number | null;
  reason?: string;
}

// ─── Per-code evaluators ───────────────────────────────────────────────────

function failWith(p: ParticipantSnapshot, reason: string): EvaluationVerdict {
  return {
    participantId: p.participantId,
    userId: p.userId,
    resultStatus: 'FAILED',
    finalScore: p.progressValue,
    finalRank: null,
    reason,
  };
}

function dq(p: ParticipantSnapshot): EvaluationVerdict {
  return {
    participantId: p.participantId,
    userId: p.userId,
    resultStatus: 'DISQUALIFIED',
    finalScore: null,
    finalRank: null,
    reason: 'disqualified',
  };
}

function pendingReview(p: ParticipantSnapshot): EvaluationVerdict {
  return {
    participantId: p.participantId,
    userId: p.userId,
    resultStatus: 'PENDING_REVIEW',
    finalScore: null,
    finalRank: null,
    reason: 'has_pending_proof',
  };
}

function evalCompleteAll(p: ParticipantSnapshot, r: ChallengeRuleInputs): EvaluationVerdict {
  const required = r.requiredCount ?? 0;
  const ok = p.approvedSubmissionCount >= required;
  return ok
    ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: p.approvedSubmissionCount, finalRank: null }
    : failWith(p, `approved=${p.approvedSubmissionCount} < required=${required}`);
}

function evalCompleteMinimum(p: ParticipantSnapshot, r: ChallengeRuleInputs): EvaluationVerdict {
  const required = r.requiredCount ?? 0;
  const ok = p.approvedSubmissionCount >= required;
  return ok
    ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: p.approvedSubmissionCount, finalRank: null }
    : failWith(p, `approved=${p.approvedSubmissionCount} < min=${required}`);
}

function evalReachTarget(p: ParticipantSnapshot, r: ChallengeRuleInputs): EvaluationVerdict {
  // Streak-style: also enforce missedCount <= allowedMisses if requiredCount set
  const target = r.targetValue ?? 0;
  const allowedMisses = r.allowedMisses ?? 0;

  if (r.requiredCount && p.missedCount > allowedMisses) {
    return failWith(p, `missed=${p.missedCount} > allowed=${allowedMisses}`);
  }

  // Two flavours:
  //  - requiredCount set → daily target check: each day >= targetValue, completed days >= required
  //  - no requiredCount → cumulative target check: progressValue >= targetValue
  if (r.requiredCount) {
    const ok = p.completionCount >= r.requiredCount;
    return ok
      ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: p.completionCount, finalRank: null }
      : failWith(p, `completed=${p.completionCount} < required=${r.requiredCount}`);
  }

  const ok = p.progressValue >= target;
  return ok
    ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: p.progressValue, finalRank: null }
    : failWith(p, `progress=${p.progressValue} < target=${target}`);
}

function evalStayBelowLimit(p: ParticipantSnapshot, r: ChallengeRuleInputs): EvaluationVerdict {
  const limit = r.limitValue ?? Number.POSITIVE_INFINITY;
  const ok = p.progressValue <= limit;
  return ok
    ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: p.progressValue, finalRank: null }
    : failWith(p, `progress=${p.progressValue} > limit=${limit}`);
}

function evalLastRemaining(p: ParticipantSnapshot, _r: ChallengeRuleInputs): EvaluationVerdict {
  const violations = p.violationCount ?? 0;
  if (violations === 0 && !p.disqualified) {
    return { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: 0, finalRank: null };
  }
  return failWith(p, `violations=${violations}`);
}

function evalNoViolation(p: ParticipantSnapshot, _r: ChallengeRuleInputs): EvaluationVerdict {
  const violations = p.violationCount ?? 0;
  return violations === 0
    ? { participantId: p.participantId, userId: p.userId, resultStatus: 'SUCCESS', finalScore: 0, finalRank: null }
    : failWith(p, `violations=${violations}`);
}

// ─── Per-participant first pass ─────────────────────────────────────────────

/**
 * Evaluate one participant against the rule. For ranking codes (RANK_TOP_*,
 * FASTEST_COMPLETION, JUDGED_BEST, TEAM_TARGET) this only does the "eligible
 * to be ranked" check; final rank determination happens in finalize().
 */
export function evaluateOne(p: ParticipantSnapshot, r: ChallengeRuleInputs): EvaluationVerdict {
  if (p.disqualified) return dq(p);
  if (p.hasPendingProof) return pendingReview(p);

  switch (r.winConditionType) {
    case 'COMPLETE_ALL':
      return evalCompleteAll(p, r);
    case 'COMPLETE_MINIMUM':
      return evalCompleteMinimum(p, r);
    case 'REACH_TARGET':
      return evalReachTarget(p, r);
    case 'STAY_BELOW_LIMIT':
      return evalStayBelowLimit(p, r);
    case 'LAST_REMAINING':
      return evalLastRemaining(p, r);
    case 'NO_VIOLATION':
      return evalNoViolation(p, r);
    // Ranking / team / judged: eligibility = approved + not DQ. Final rank assigned in finalize().
    case 'RANK_TOP_N':
    case 'RANK_TOP_PERCENT':
    case 'FASTEST_COMPLETION':
    case 'JUDGED_BEST':
    case 'TEAM_TARGET':
      return {
        participantId: p.participantId,
        userId: p.userId,
        resultStatus: 'PENDING_REVIEW', // marker — finalize() overwrites
        finalScore: p.progressValue,
        finalRank: null,
      };
    default: {
      const _exhaustive: never = r.winConditionType;
      void _exhaustive;
      return failWith(p, `unknown win condition: ${String(r.winConditionType)}`);
    }
  }
}

// ─── Finalize across the cohort ─────────────────────────────────────────────

/**
 * Take the per-participant verdicts and apply cohort-level rules:
 *   - ranking (TOP_N / TOP_PERCENT / FASTEST / JUDGED)
 *   - team sums (TEAM_TARGET)
 *   - tie-breakers
 *
 * Returns updated verdicts with finalRank populated where applicable.
 */
export function finalize(
  verdicts: EvaluationVerdict[],
  snapshots: ParticipantSnapshot[],
  rule: ChallengeRuleInputs,
): EvaluationVerdict[] {
  const byId = new Map(snapshots.map((s) => [s.participantId, s]));

  switch (rule.winConditionType) {
    case 'RANK_TOP_N':
    case 'RANK_TOP_PERCENT': {
      // Score = progressValue. Default DESC (highest wins) unless rankingOrder = ASC.
      const isAsc = rule.rankingOrder === 'ASC';
      const eligible = verdicts
        .filter((v) => v.resultStatus !== 'DISQUALIFIED')
        .map((v) => ({ v, s: byId.get(v.participantId)! }))
        .sort((a, b) => {
          const diff = a.s.progressValue - b.s.progressValue;
          return isAsc ? diff : -diff;
        });

      const winnerCount =
        rule.winConditionType === 'RANK_TOP_N'
          ? rule.winnerCount ?? 1
          : Math.max(1, Math.floor((eligible.length * (rule.winnerPercentage ?? 0)) / 100));

      eligible.forEach(({ v, s }, idx) => {
        const rank = idx + 1;
        v.finalRank = rank;
        v.finalScore = s.progressValue;
        v.resultStatus = rank <= winnerCount ? 'SUCCESS' : 'FAILED';
        v.reason = rank <= winnerCount ? `rank ${rank} ≤ ${winnerCount}` : `rank ${rank} > ${winnerCount}`;
      });
      return verdicts;
    }

    case 'FASTEST_COMPLETION': {
      // Earliest firstCompletedAt wins. Missing timestamp → FAILED.
      const eligible = verdicts
        .filter((v) => v.resultStatus !== 'DISQUALIFIED')
        .map((v) => ({ v, s: byId.get(v.participantId)! }))
        .filter(({ s }) => typeof s.firstCompletedAt === 'number')
        .sort((a, b) => (a.s.firstCompletedAt! - b.s.firstCompletedAt!));

      eligible.forEach(({ v, s }, idx) => {
        v.finalRank = idx + 1;
        v.finalScore = s.firstCompletedAt!;
        v.resultStatus = idx === 0 ? 'SUCCESS' : 'FAILED';
        v.reason = idx === 0 ? 'fastest' : `rank ${idx + 1}`;
      });

      // Anyone with no timestamp → FAILED
      for (const v of verdicts) {
        const s = byId.get(v.participantId);
        if (s && typeof s.firstCompletedAt !== 'number' && v.resultStatus !== 'DISQUALIFIED') {
          v.resultStatus = 'FAILED';
          v.reason = 'never_completed';
          v.finalRank = null;
        }
      }
      return verdicts;
    }

    case 'JUDGED_BEST': {
      const eligible = verdicts
        .filter((v) => v.resultStatus !== 'DISQUALIFIED')
        .map((v) => ({ v, s: byId.get(v.participantId)! }))
        .sort((a, b) => (b.s.judgedScore ?? -Infinity) - (a.s.judgedScore ?? -Infinity));

      eligible.forEach(({ v, s }, idx) => {
        v.finalRank = idx + 1;
        v.finalScore = s.judgedScore ?? null;
        v.resultStatus = idx === 0 ? 'SUCCESS' : 'FAILED';
        v.reason = idx === 0 ? 'judged_best' : `rank ${idx + 1}`;
      });
      return verdicts;
    }

    case 'TEAM_TARGET': {
      const target = rule.teamTargetValue ?? 0;
      const indMin = rule.individualMinimumValue ?? 0;

      // Sum team progress
      const teamSums = new Map<string, number>();
      for (const s of snapshots) {
        if (!s.teamId) continue;
        teamSums.set(s.teamId, (teamSums.get(s.teamId) ?? 0) + s.progressValue);
      }

      for (const v of verdicts) {
        if (v.resultStatus === 'DISQUALIFIED') continue;
        const s = byId.get(v.participantId);
        if (!s || !s.teamId) {
          v.resultStatus = 'FAILED';
          v.reason = 'no_team';
          continue;
        }
        const teamSum = teamSums.get(s.teamId) ?? 0;
        const teamOk = teamSum >= target;
        const individualOk = indMin === 0 || s.progressValue >= indMin;
        if (teamOk && individualOk) {
          v.resultStatus = 'SUCCESS';
          v.finalScore = s.progressValue;
          v.reason = `team_sum=${teamSum} ≥ ${target}`;
        } else {
          v.resultStatus = 'FAILED';
          v.reason = teamOk
            ? `individual=${s.progressValue} < ${indMin}`
            : `team_sum=${teamSum} < ${target}`;
        }
      }
      return verdicts;
    }

    default:
      // Non-ranking codes: per-participant verdict already final.
      return verdicts;
  }
}

// ─── Top-level convenience ──────────────────────────────────────────────────

/**
 * Full evaluation pipeline: per-participant + cohort finalize.
 */
export function evaluateAll(
  snapshots: ParticipantSnapshot[],
  rule: ChallengeRuleInputs,
): EvaluationVerdict[] {
  const first = snapshots.map((p) => evaluateOne(p, rule));
  return finalize(first, snapshots, rule);
}

// ─── Metadata for UI / validation ──────────────────────────────────────────

export interface WinConditionMeta {
  code: WinConditionCode;
  label: string;
  needsTarget: boolean;
  needsLimit: boolean;
  needsRequiredCount: boolean;
  needsWinnerCount: boolean;
  needsWinnerPercent: boolean;
  needsTeamTarget: boolean;
  needsJudges: boolean;
  rankingBased: boolean;
}

export const WIN_CONDITIONS: Record<WinConditionCode, WinConditionMeta> = {
  COMPLETE_ALL: { code: 'COMPLETE_ALL', label: 'Complete all tasks', needsTarget: false, needsLimit: false, needsRequiredCount: true, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
  COMPLETE_MINIMUM: { code: 'COMPLETE_MINIMUM', label: 'Complete minimum N', needsTarget: false, needsLimit: false, needsRequiredCount: true, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
  REACH_TARGET: { code: 'REACH_TARGET', label: 'Reach target', needsTarget: true, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
  STAY_BELOW_LIMIT: { code: 'STAY_BELOW_LIMIT', label: 'Stay below limit', needsTarget: false, needsLimit: true, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
  RANK_TOP_N: { code: 'RANK_TOP_N', label: 'Top N ranking', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: true, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: true },
  RANK_TOP_PERCENT: { code: 'RANK_TOP_PERCENT', label: 'Top % ranking', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: true, needsTeamTarget: false, needsJudges: false, rankingBased: true },
  TEAM_TARGET: { code: 'TEAM_TARGET', label: 'Team target', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: true, needsJudges: false, rankingBased: false },
  LAST_REMAINING: { code: 'LAST_REMAINING', label: 'Last remaining', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
  FASTEST_COMPLETION: { code: 'FASTEST_COMPLETION', label: 'Fastest completion', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: true },
  JUDGED_BEST: { code: 'JUDGED_BEST', label: 'Judged best', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: true, rankingBased: true },
  NO_VIOLATION: { code: 'NO_VIOLATION', label: 'No violation', needsTarget: false, needsLimit: false, needsRequiredCount: false, needsWinnerCount: false, needsWinnerPercent: false, needsTeamTarget: false, needsJudges: false, rankingBased: false },
};

/** Returns an array of validation errors. Empty = OK. */
export function validateRule(rule: ChallengeRuleInputs): string[] {
  const errors: string[] = [];
  const meta = WIN_CONDITIONS[rule.winConditionType];
  if (!meta) {
    errors.push(`unknown win_condition: ${rule.winConditionType}`);
    return errors;
  }
  if (meta.needsTarget && (rule.targetValue ?? 0) <= 0) errors.push('target_value required');
  if (meta.needsLimit && rule.limitValue == null) errors.push('limit_value required');
  if (meta.needsRequiredCount && (rule.requiredCount ?? 0) <= 0) errors.push('required_count required');
  if (meta.needsWinnerCount && (rule.winnerCount ?? 0) <= 0) errors.push('winner_count required');
  if (meta.needsWinnerPercent) {
    const p = rule.winnerPercentage ?? 0;
    if (p <= 0 || p > 100) errors.push('winner_percentage must be (0, 100]');
  }
  if (meta.needsTeamTarget && (rule.teamTargetValue ?? 0) <= 0) errors.push('team_target_value required');
  if ((rule.allowedMisses ?? 0) < 0) errors.push('allowed_misses must be >= 0');
  return errors;
}
