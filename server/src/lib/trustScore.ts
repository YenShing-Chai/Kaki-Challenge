/**
 * User trust score — PRD §10.2.
 *
 * Pure formula. No DB writes here. Callers load the relevant counters
 * from the user row + audit log + fraud signals and pass them in.
 *
 * Score = 100
 *   - fraud_flags
 *   - rejected_submissions
 *   - dispute_losses
 *   - suspicious_device_links
 *   + completed_challenges (capped contribution)
 *   + verified_api_submissions (capped)
 *   + account_age_score (months capped)
 *
 * Bounded 0-100.
 */

export interface TrustScoreInputs {
  fraudFlags: number; // hard count of flags raised against this user
  rejectedSubmissions: number; // submissions reviewers explicitly rejected
  disputeLosses: number; // disputes resolved against this user
  suspiciousDeviceLinks: number; // unique other accounts on same device
  completedChallenges: number;
  verifiedApiSubmissions: number;
  accountAgeMonths: number;
}

export interface TrustScoreBreakdown {
  score: number;
  positives: number;
  negatives: number;
  tier: TrustTier;
  reasons: string[];
}

export type TrustTier =
  | 'TRUSTED'       // 80-100
  | 'NORMAL'        // 60-79
  | 'WATCHLIST'     // 40-59
  | 'HIGH_RISK'     // 20-39
  | 'SUSPICIOUS';   // 0-19

const POSITIVE_CAP_PER_AXIS = 15;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function cap(n: number) {
  return Math.min(POSITIVE_CAP_PER_AXIS, Math.max(0, n));
}

export function computeTrust(inputs: TrustScoreInputs): TrustScoreBreakdown {
  const negativesRaw =
    inputs.fraudFlags * 8 +
    inputs.rejectedSubmissions * 2 +
    inputs.disputeLosses * 6 +
    inputs.suspiciousDeviceLinks * 4;

  const positivesRaw =
    cap(inputs.completedChallenges) * 1 +
    cap(inputs.verifiedApiSubmissions) * 1 +
    cap(Math.floor(inputs.accountAgeMonths)) * 0.5;

  const raw = 100 - negativesRaw + positivesRaw;
  const score = clamp(Math.round(raw), 0, 100);

  const reasons: string[] = [];
  if (inputs.fraudFlags > 0) reasons.push(`-${inputs.fraudFlags * 8} fraud flags (${inputs.fraudFlags})`);
  if (inputs.rejectedSubmissions > 0) reasons.push(`-${inputs.rejectedSubmissions * 2} rejected submissions`);
  if (inputs.disputeLosses > 0) reasons.push(`-${inputs.disputeLosses * 6} dispute losses`);
  if (inputs.suspiciousDeviceLinks > 0)
    reasons.push(`-${inputs.suspiciousDeviceLinks * 4} suspicious device links`);
  if (inputs.completedChallenges > 0)
    reasons.push(`+${cap(inputs.completedChallenges)} completed challenges`);
  if (inputs.verifiedApiSubmissions > 0)
    reasons.push(`+${cap(inputs.verifiedApiSubmissions)} API-verified submissions`);
  if (inputs.accountAgeMonths > 0)
    reasons.push(`+${cap(Math.floor(inputs.accountAgeMonths)) * 0.5} account age`);

  return {
    score,
    positives: Math.round(positivesRaw),
    negatives: Math.round(negativesRaw),
    tier: tierFromScore(score),
    reasons,
  };
}

export function tierFromScore(score: number): TrustTier {
  if (score >= 80) return 'TRUSTED';
  if (score >= 60) return 'NORMAL';
  if (score >= 40) return 'WATCHLIST';
  if (score >= 20) return 'HIGH_RISK';
  return 'SUSPICIOUS';
}

export interface TrustPolicy {
  allowCreate: boolean;
  allowWinnerPool: boolean;
  requireAdminReview: boolean;
  maxContributionMyr: number;
}

/**
 * Policy decisions per trust tier. Pulled out of the score so callers can
 * apply different policies (creator-side vs joiner-side) without re-tuning.
 */
export function policyForTier(tier: TrustTier): TrustPolicy {
  switch (tier) {
    case 'TRUSTED':
      return { allowCreate: true, allowWinnerPool: true, requireAdminReview: false, maxContributionMyr: 50 };
    case 'NORMAL':
      return { allowCreate: true, allowWinnerPool: true, requireAdminReview: true, maxContributionMyr: 50 };
    case 'WATCHLIST':
      return { allowCreate: true, allowWinnerPool: true, requireAdminReview: true, maxContributionMyr: 25 };
    case 'HIGH_RISK':
      return { allowCreate: true, allowWinnerPool: false, requireAdminReview: true, maxContributionMyr: 5 };
    case 'SUSPICIOUS':
      return { allowCreate: false, allowWinnerPool: false, requireAdminReview: true, maxContributionMyr: 0 };
  }
}
