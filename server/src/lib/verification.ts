/**
 * Verification ladder + confidence scoring — PRD §7 + §10.3.
 *
 * Seven verification levels, each with:
 *   - a baseline confidence score (raises to threshold = auto-approve)
 *   - allowed reward tiers (you can't pay out vouchers behind self-declaration)
 *   - which challenge types it suits
 *
 * Plus peer-verification rules (2 approvals min, 24h deadline, no self-approval)
 * and the safety rule that blocks Winner Pool + self-declaration combos.
 */

import type { WinConditionCode } from './winConditions';

// ─── Types ─────────────────────────────────────────────────────────────────

export type VerificationLevel =
  | 'SELF_DECLARATION'
  | 'PHOTO_UPLOAD'
  | 'PEER_VERIFICATION'
  | 'ORGANIZER_APPROVAL'
  | 'QR_LOCATION'
  | 'RECEIPT_POS_API'
  | 'PARTNER_VERIFIED';

export type RewardType =
  | 'NONE'
  | 'BADGE'
  | 'POINTS'
  | 'VOUCHER'
  | 'DISCOUNT_FREE_ITEM'
  | 'SPONSOR_REWARD'
  | 'REFUNDABLE_DEPOSIT'
  | 'WINNER_POOL'
  | 'RANDOM_PAID_PRIZE';

export interface VerificationMeta {
  level: VerificationLevel;
  label: string;
  shortLabel: string;
  baselineConfidence: number; // PRD §10.3
  trustTier: 'low' | 'medium' | 'high';
  allowedRewards: ReadonlyArray<RewardType>;
  needsPeerSlots: boolean;
  needsLocation: boolean;
  needsExternalApi: boolean;
}

// ─── Confidence + reward gating ────────────────────────────────────────────

export const VERIFICATION_LEVELS: Record<VerificationLevel, VerificationMeta> = {
  SELF_DECLARATION: {
    level: 'SELF_DECLARATION',
    label: 'Self-declaration',
    shortLabel: 'Honor system',
    baselineConfidence: 20,
    trustTier: 'low',
    allowedRewards: ['NONE', 'BADGE'],
    needsPeerSlots: false,
    needsLocation: false,
    needsExternalApi: false,
  },
  PHOTO_UPLOAD: {
    level: 'PHOTO_UPLOAD',
    label: 'Photo / video upload',
    shortLabel: 'Photo proof',
    baselineConfidence: 40,
    trustTier: 'medium',
    allowedRewards: ['NONE', 'BADGE', 'POINTS'],
    needsPeerSlots: false,
    needsLocation: false,
    needsExternalApi: false,
  },
  PEER_VERIFICATION: {
    level: 'PEER_VERIFICATION',
    label: 'Peer verification',
    shortLabel: 'Friends approve',
    baselineConfidence: 55,
    trustTier: 'medium',
    allowedRewards: ['NONE', 'BADGE', 'POINTS', 'VOUCHER', 'WINNER_POOL'],
    needsPeerSlots: true,
    needsLocation: false,
    needsExternalApi: false,
  },
  ORGANIZER_APPROVAL: {
    level: 'ORGANIZER_APPROVAL',
    label: 'Organizer / admin approval',
    shortLabel: 'Organizer approves',
    baselineConfidence: 75,
    trustTier: 'high',
    allowedRewards: ['NONE', 'BADGE', 'POINTS', 'VOUCHER', 'DISCOUNT_FREE_ITEM', 'SPONSOR_REWARD', 'WINNER_POOL'],
    needsPeerSlots: false,
    needsLocation: false,
    needsExternalApi: false,
  },
  QR_LOCATION: {
    level: 'QR_LOCATION',
    label: 'QR / location check-in',
    shortLabel: 'QR scan',
    baselineConfidence: 75,
    trustTier: 'high',
    allowedRewards: ['NONE', 'BADGE', 'POINTS', 'VOUCHER', 'DISCOUNT_FREE_ITEM', 'SPONSOR_REWARD', 'WINNER_POOL'],
    needsPeerSlots: false,
    needsLocation: true,
    needsExternalApi: false,
  },
  RECEIPT_POS_API: {
    level: 'RECEIPT_POS_API',
    label: 'Receipt / POS / API data',
    shortLabel: 'API verified',
    baselineConfidence: 90,
    trustTier: 'high',
    allowedRewards: ['NONE', 'BADGE', 'POINTS', 'VOUCHER', 'DISCOUNT_FREE_ITEM', 'SPONSOR_REWARD', 'WINNER_POOL', 'REFUNDABLE_DEPOSIT'],
    needsPeerSlots: false,
    needsLocation: false,
    needsExternalApi: true,
  },
  PARTNER_VERIFIED: {
    level: 'PARTNER_VERIFIED',
    label: 'Partner / merchant / HR verified',
    shortLabel: 'Partner verified',
    baselineConfidence: 95,
    trustTier: 'high',
    allowedRewards: ['NONE', 'BADGE', 'POINTS', 'VOUCHER', 'DISCOUNT_FREE_ITEM', 'SPONSOR_REWARD', 'WINNER_POOL', 'REFUNDABLE_DEPOSIT'],
    needsPeerSlots: false,
    needsLocation: false,
    needsExternalApi: true,
  },
};

/** PRD §10.3 — confidence ≥ threshold = AUTO_APPROVED. */
export const DEFAULT_AUTO_APPROVE_THRESHOLD = 75;

// ─── Peer verification rules — PRD §7.2 ─────────────────────────────────────

export const PEER_RULES = {
  minimumApprovals: 2,
  approvalDeadlineHours: 24,
  rejectionThreshold: 2,
  selfApprovalAllowed: false,
  creatorOverrideAllowed: false, // not for reward challenges
} as const;

export interface PeerReviewSnapshot {
  approvals: number;
  rejections: number;
  selfReviewBlocked: boolean; // safety flag if a self-review attempt was logged
  hoursSinceSubmission: number;
}

export type PeerOutcome = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'EXPIRED';

export function resolvePeerOutcome(s: PeerReviewSnapshot): PeerOutcome {
  if (s.rejections >= PEER_RULES.rejectionThreshold) return 'REJECTED';
  if (s.approvals >= PEER_RULES.minimumApprovals) return 'APPROVED';
  if (s.hoursSinceSubmission > PEER_RULES.approvalDeadlineHours) return 'EXPIRED';
  return 'PENDING_REVIEW';
}

// ─── Reward → verification gating ──────────────────────────────────────────

/**
 * PRD §10.3 hard rule:
 *   IF reward_type = WINNER_POOL AND verification_method = SELF_DECLARATION
 *   THEN block creation
 *
 * PRD §18.2 — minimum verification per reward type.
 *
 * Returns null if OK, or an error message if blocked.
 */
export function checkRewardVerificationCompatibility(
  reward: RewardType,
  verification: VerificationLevel,
): string | null {
  // Hard block first
  if (reward === 'WINNER_POOL' && verification === 'SELF_DECLARATION') {
    return 'Winner Pool challenges cannot use self-declaration verification.';
  }
  if (reward === 'RANDOM_PAID_PRIZE') {
    return 'Random paid prize draws are not supported.';
  }

  const meta = VERIFICATION_LEVELS[verification];
  if (!meta) return `Unknown verification level: ${verification}`;
  if (!meta.allowedRewards.includes(reward)) {
    return `Reward "${reward}" requires stronger verification than ${meta.shortLabel}.`;
  }
  return null;
}

// ─── Confidence score helpers ───────────────────────────────────────────────

export interface ConfidenceSignals {
  level: VerificationLevel;
  /** Optional EXIF intact / not edited (photos). */
  exifOk?: boolean;
  /** Optional GPS within geofence (QR/location). */
  geoMatch?: boolean;
  /** Optional submitted before deadline. */
  onTime?: boolean;
  /** Trust score snapshot of submitter at time of submission. */
  userTrustScore?: number;
  /** -1..1 adjustment for app-defined fraud signals. */
  fraudAdjustment?: number;
}

/**
 * Compute final confidence score for a submission, 0-100. Capped.
 */
export function computeConfidence(s: ConfidenceSignals): number {
  let score = VERIFICATION_LEVELS[s.level].baselineConfidence;

  // Bonus for clean signals
  if (s.level === 'PHOTO_UPLOAD' && s.exifOk) score += 10;
  if (s.level === 'QR_LOCATION' && s.geoMatch) score += 5;
  if (s.onTime) score += 3;

  // Trust score nudge: full-trust user (100) → +5, 0 → -10
  if (typeof s.userTrustScore === 'number') {
    const norm = (s.userTrustScore - 60) / 40; // 60 = neutral baseline
    score += Math.round(norm * 5);
  }

  // Fraud signals can shave up to 30 off
  if (typeof s.fraudAdjustment === 'number') {
    score += Math.round(Math.max(-30, Math.min(0, s.fraudAdjustment * 30)));
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine the submission's verification outcome given its confidence.
 */
export type SubmissionOutcome = 'AUTO_APPROVED' | 'PENDING_REVIEW';

export function classifySubmission(
  confidence: number,
  threshold = DEFAULT_AUTO_APPROVE_THRESHOLD,
): SubmissionOutcome {
  return confidence >= threshold ? 'AUTO_APPROVED' : 'PENDING_REVIEW';
}

// ─── Suggested verification per win condition ──────────────────────────────

/**
 * Recommended verification per challenge type for the Winner Pool path —
 * cross-references PRD §10.3 (per-type minimum) with §7.
 */
export function suggestVerification(
  win: WinConditionCode,
  isWinnerPool: boolean,
): VerificationLevel {
  if (isWinnerPool) {
    switch (win) {
      case 'COMPLETE_ALL':
      case 'COMPLETE_MINIMUM':
        return 'PHOTO_UPLOAD';
      case 'REACH_TARGET':
      case 'STAY_BELOW_LIMIT':
        return 'RECEIPT_POS_API';
      case 'RANK_TOP_N':
      case 'RANK_TOP_PERCENT':
      case 'FASTEST_COMPLETION':
        return 'RECEIPT_POS_API';
      case 'JUDGED_BEST':
        return 'ORGANIZER_APPROVAL';
      case 'TEAM_TARGET':
      case 'LAST_REMAINING':
      case 'NO_VIOLATION':
        return 'ORGANIZER_APPROVAL';
    }
  }
  // Non-Winner-Pool default: photo upload is a reasonable middle ground
  return 'PHOTO_UPLOAD';
}
