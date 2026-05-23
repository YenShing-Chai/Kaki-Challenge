/**
 * Audit log helper — PRD §14.5.
 *
 * Every challenge state change writes a row to ChallengeAuditLog. The log
 * is append-only and is what compliance/legal can read to defend any
 * dispute or payout decision. Keep entries small and structured.
 *
 * Actions are short SCREAMING_SNAKE constants — the AUDIT_ACTIONS table is
 * the authoritative list. Adding a new action means adding it here so
 * we don't typo strings at call sites.
 */

import { db, schema } from './db';

// ─── Canonical action names ────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Challenge lifecycle
  CHALLENGE_CREATED: 'CHALLENGE_CREATED',
  CHALLENGE_PUBLISHED: 'CHALLENGE_PUBLISHED',
  CHALLENGE_APPROVED: 'CHALLENGE_APPROVED',
  CHALLENGE_REJECTED: 'CHALLENGE_REJECTED',
  CHALLENGE_SUSPENDED: 'CHALLENGE_SUSPENDED',
  CHALLENGE_RESUMED: 'CHALLENGE_RESUMED',
  CHALLENGE_CANCELLED: 'CHALLENGE_CANCELLED',
  CHALLENGE_STARTED: 'CHALLENGE_STARTED',
  CHALLENGE_ENDED: 'CHALLENGE_ENDED',
  CHALLENGE_LOCKED: 'CHALLENGE_LOCKED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  MATERIAL_FIELD_EDITED: 'MATERIAL_FIELD_EDITED',

  // Moderation
  RISK_CLASSIFIED: 'RISK_CLASSIFIED',
  KEYWORD_BLOCKED: 'KEYWORD_BLOCKED',
  MODERATION_APPROVED: 'MODERATION_APPROVED',
  MODERATION_REJECTED: 'MODERATION_REJECTED',

  // Participants
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT: 'PARTICIPANT_LEFT',
  PARTICIPANT_DISQUALIFIED: 'PARTICIPANT_DISQUALIFIED',

  // Submissions
  SUBMISSION_CREATED: 'SUBMISSION_CREATED',
  SUBMISSION_AUTO_APPROVED: 'SUBMISSION_AUTO_APPROVED',
  SUBMISSION_APPROVED: 'SUBMISSION_APPROVED',
  SUBMISSION_REJECTED: 'SUBMISSION_REJECTED',
  PEER_REVIEW_CAST: 'PEER_REVIEW_CAST',

  // Disputes
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  DISPUTE_REVIEWED: 'DISPUTE_REVIEWED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',

  // Winner Pool money
  POOL_CONTRIBUTION_HELD: 'POOL_CONTRIBUTION_HELD',
  POOL_CONTRIBUTION_REFUNDED: 'POOL_CONTRIBUTION_REFUNDED',
  POOL_CONTRIBUTION_FORFEITED: 'POOL_CONTRIBUTION_FORFEITED',
  POOL_CALCULATED: 'POOL_CALCULATED',
  PAYOUT_QUEUED: 'PAYOUT_QUEUED',
  PAYOUT_APPROVED: 'PAYOUT_APPROVED',
  PAYOUT_RELEASED: 'PAYOUT_RELEASED',
  PAYOUT_FAILED: 'PAYOUT_FAILED',

  // Admin overrides
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type ActorType = 'USER' | 'ADMIN' | 'SYSTEM';

// ─── Public API ────────────────────────────────────────────────────────────

export interface LogEntry {
  challengeId: string;
  action: AuditAction;
  actorId?: string | null;
  actorType?: ActorType;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Insert a single audit log entry. Never throws — audit logging failures
 * should not break user flows. Errors are reported via console.error so
 * monitoring can pick them up.
 */
export async function logAudit(entry: LogEntry): Promise<void> {
  try {
    await db.insert(schema.challengeAuditLogs).values({
      challengeId: entry.challengeId,
      action: entry.action,
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? 'SYSTEM',
      oldValue: (entry.oldValue ?? null) as unknown as object | null,
      newValue: (entry.newValue ?? null) as unknown as object | null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to write log entry', { entry, err });
  }
}

/**
 * Batch insert — used when many things change at once (e.g. payout release
 * generates one entry per winner).
 */
export async function logAuditMany(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await db.insert(schema.challengeAuditLogs).values(
      entries.map((e) => ({
        challengeId: e.challengeId,
        action: e.action,
        actorId: e.actorId ?? null,
        actorType: e.actorType ?? 'SYSTEM',
        oldValue: (e.oldValue ?? null) as unknown as object | null,
        newValue: (e.newValue ?? null) as unknown as object | null,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
      })),
    );
  } catch (err) {
    console.error('[audit] failed to write batch', { count: entries.length, err });
  }
}

/**
 * Convenience wrapper for status transitions — captures old + new.
 */
export async function logStatusChange(
  challengeId: string,
  from: string | null | undefined,
  to: string,
  actor?: { id?: string | null; type?: ActorType },
): Promise<void> {
  await logAudit({
    challengeId,
    action: AUDIT_ACTIONS.STATUS_CHANGED,
    actorId: actor?.id ?? null,
    actorType: actor?.type ?? 'SYSTEM',
    oldValue: { status: from ?? null },
    newValue: { status: to },
  });
}
