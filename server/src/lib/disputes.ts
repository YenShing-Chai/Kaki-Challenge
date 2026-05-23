/**
 * Dispute lifecycle — PRD §12 + Winner Pool §18.
 *
 * Disputes pause payouts and force recalculation. The state machine:
 *
 *   OPEN ──→ UNDER_REVIEW ──┬─→ UPHELD          (submission rejected, recalc)
 *                           ├─→ REJECTED        (dispute dismissed)
 *                           ├─→ WITHDRAWN       (raiser pulled it)
 *                           └─→ RESOLVED_VOID   (challenge cancelled)
 *
 * Pure helpers here — DB writes happen in routes. We expose:
 *   - dispute window math (when does the window close?)
 *   - "is payout safe to release?" check
 *   - resolution outcome → action map
 */

import { sql, eq, and, gte, or, inArray } from 'drizzle-orm';
import { db, schema } from './db';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DisputeReason =
  | 'FAKE_PROOF'
  | 'WRONG_SCORE'
  | 'LATE_SUBMISSION'
  | 'RULE_VIOLATION'
  | 'DUPLICATE_PROOF'
  | 'UNSAFE_BEHAVIOR'
  | 'OTHER';

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'UPHELD'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'RESOLVED_VOID';

export interface DisputeWindow {
  /** Hours from challenge end. PRD §18.1 — 24/48/72 based on risk. */
  hoursFromEnd: number;
  /** UTC ms of dispute window close. */
  closesAtMs: number;
  /** True if now is past the close. */
  isClosed: boolean;
  /** Ms remaining (0 if closed). */
  msRemaining: number;
}

// ─── Window math ───────────────────────────────────────────────────────────

/**
 * PRD §18.1 — dispute window hours by risk level. Defaults to 24h.
 */
export function windowHoursForRisk(risk: string | null | undefined): number {
  switch (risk) {
    case 'LOW':
      return 24;
    case 'MEDIUM':
      return 48;
    case 'HIGH':
      return 72;
    default:
      return 24;
  }
}

export function computeWindow(
  challengeEndAt: Date,
  hoursFromEnd: number,
  now: Date = new Date(),
): DisputeWindow {
  const closesAtMs = challengeEndAt.getTime() + hoursFromEnd * 3600 * 1000;
  const isClosed = now.getTime() >= closesAtMs;
  return {
    hoursFromEnd,
    closesAtMs,
    isClosed,
    msRemaining: Math.max(0, closesAtMs - now.getTime()),
  };
}

// ─── Active dispute check ──────────────────────────────────────────────────

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ['OPEN', 'UNDER_REVIEW'];

/**
 * Is any dispute on this challenge still unresolved? Payout can't release
 * while this is true.
 */
export async function hasActiveDispute(challengeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.challengeDisputes.id })
    .from(schema.challengeDisputes)
    .where(
      and(
        eq(schema.challengeDisputes.challengeId, challengeId),
        inArray(schema.challengeDisputes.status, ACTIVE_DISPUTE_STATUSES),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ─── Payout safety gate ────────────────────────────────────────────────────

export interface PayoutGate {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * Aggregate "is it safe to release payouts on this challenge?" check.
 *
 * Combines:
 *   - dispute window closed
 *   - no active disputes
 *   - challenge.lifecycle = LOCKED or further
 *   - no unresolved fraud flags on the pool (caller passes this in for now)
 */
export async function checkPayoutGate(args: {
  challengeId: string;
  challengeEndAt: Date | null;
  disputeWindowHours: number;
  lifecycle: string | null;
  fraudFlagsUnresolved: number;
  now?: Date;
}): Promise<PayoutGate> {
  const now = args.now ?? new Date();

  if (!args.challengeEndAt) {
    return { ok: false, reason: 'challenge_not_ended' };
  }
  const window = computeWindow(args.challengeEndAt, args.disputeWindowHours, now);
  if (!window.isClosed) {
    return {
      ok: false,
      reason: 'dispute_window_open',
      details: { msRemaining: window.msRemaining },
    };
  }

  // Lifecycle must be at or past LOCKED
  const order = ['DRAFT','PENDING_REVIEW','SCHEDULED','ACTIVE','PAUSED','ENDED','CALCULATING','DISPUTE_OPEN','LOCKED','REWARD_PROCESSING','COMPLETED','CANCELLED','SUSPENDED'];
  const lockedIdx = order.indexOf('LOCKED');
  const cur = order.indexOf(args.lifecycle ?? 'DRAFT');
  // CANCELLED / SUSPENDED block payouts entirely
  if (args.lifecycle === 'CANCELLED' || args.lifecycle === 'SUSPENDED') {
    return { ok: false, reason: `challenge_${args.lifecycle?.toLowerCase()}` };
  }
  if (cur < lockedIdx) {
    return { ok: false, reason: 'not_locked_yet', details: { lifecycle: args.lifecycle } };
  }

  // Active disputes?
  const active = await hasActiveDispute(args.challengeId);
  if (active) {
    return { ok: false, reason: 'active_dispute' };
  }

  if (args.fraudFlagsUnresolved > 0) {
    return {
      ok: false,
      reason: 'unresolved_fraud_flags',
      details: { count: args.fraudFlagsUnresolved },
    };
  }

  return { ok: true };
}

// ─── Resolution → action map ───────────────────────────────────────────────

export type ResolutionAction =
  | { type: 'NO_CHANGE' }
  | { type: 'RECALCULATE_WINNERS' }
  | { type: 'DISQUALIFY_PARTICIPANT'; participantId: string }
  | { type: 'VOID_CHALLENGE'; refundAll: true };

/**
 * Given a dispute resolution status + context, what action does the system
 * take? Returns a structured action the routes/cron can execute.
 */
export function actionForResolution(
  status: DisputeStatus,
  context: { affectedParticipantId?: string | null; severity?: 'low' | 'high' },
): ResolutionAction {
  switch (status) {
    case 'REJECTED':
    case 'WITHDRAWN':
      return { type: 'NO_CHANGE' };
    case 'UPHELD':
      if (context.severity === 'high' && context.affectedParticipantId) {
        return { type: 'DISQUALIFY_PARTICIPANT', participantId: context.affectedParticipantId };
      }
      return { type: 'RECALCULATE_WINNERS' };
    case 'RESOLVED_VOID':
      return { type: 'VOID_CHALLENGE', refundAll: true };
    case 'OPEN':
    case 'UNDER_REVIEW':
      return { type: 'NO_CHANGE' };
  }
}

// ─── Validation ────────────────────────────────────────────────────────────

const VALID_REASONS: DisputeReason[] = [
  'FAKE_PROOF',
  'WRONG_SCORE',
  'LATE_SUBMISSION',
  'RULE_VIOLATION',
  'DUPLICATE_PROOF',
  'UNSAFE_BEHAVIOR',
  'OTHER',
];

export function isValidReason(s: string): s is DisputeReason {
  return (VALID_REASONS as string[]).includes(s);
}

/**
 * Can the user raise a dispute right now?
 *   - challenge has ended
 *   - dispute window still open
 *   - user is a participant (or affected party — caller checks)
 *   - no prior open dispute from same user on same target
 */
export interface CanRaiseInput {
  challengeEndAt: Date | null;
  challengeLifecycle: string | null;
  disputeWindowHours: number;
  now?: Date;
}

export function canRaiseDispute(input: CanRaiseInput): { ok: boolean; reason?: string } {
  if (!input.challengeEndAt) return { ok: false, reason: 'challenge_not_ended' };
  if (input.challengeLifecycle === 'CANCELLED') return { ok: false, reason: 'challenge_cancelled' };
  if (input.challengeLifecycle === 'COMPLETED') return { ok: false, reason: 'challenge_completed' };
  const w = computeWindow(input.challengeEndAt, input.disputeWindowHours, input.now);
  if (w.isClosed) return { ok: false, reason: 'dispute_window_closed' };
  return { ok: true };
}

// Re-export so route code only needs one import
export { sql, eq, and, gte, or } from 'drizzle-orm';
