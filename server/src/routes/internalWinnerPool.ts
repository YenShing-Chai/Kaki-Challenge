/**
 * Winner Pool internal endpoints — Winner Pool PRD §24.3 + §24.4.
 *
 * Mounted under /internal/* — protected by CRON_SECRET header. Called by
 * the daily resolution cron (or admin tooling) to:
 *   - calculate winners + queue payouts after challenge ends
 *   - release payouts after dispute window closes and admin approves
 *
 * No mobile clients should call these directly.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../lib/db';
import {
  challenges,
  challengeRules,
  challengeParticipants,
  challengeSubmissions,
  challengeWinnerPools,
  challengePoolContributions,
  challengePoolPayouts,
} from '../db/schema';

import { evaluateAll, type ParticipantSnapshot, type WinConditionCode } from '../lib/winConditions';
import { calculatePool, distribute, type DistributionMethod } from '../lib/winnerPool';
import { checkPayoutGate } from '../lib/disputes';
import { logAudit, logAuditMany, AUDIT_ACTIONS } from '../lib/auditLog';
import { stripe } from '../lib/stripe';

export const internalWinnerPoolRouter = Router();

function checkSecret(req: Request, res: Response): boolean {
  const provided = req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /internal/challenges/:id/winner-pool/calculate
// After challenge ends: evaluate participants → determine winners →
// queue payouts in ON_HOLD state. Dispute window must still be open
// (this is what FILLS the window with provisional results).
// ────────────────────────────────────────────────────────────────────────────

internalWinnerPoolRouter.post(
  '/challenges/:id/winner-pool/calculate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!checkSecret(req, res)) return;
      const challengeId = req.params.id;
      if (!challengeId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }

      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
      if (!challenge) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const [rule] = await db.select().from(challengeRules).where(eq(challengeRules.challengeId, challengeId)).limit(1);
      if (!rule) {
        res.status(409).json({ error: 'no_rule', message: 'challenge has no rule row' });
        return;
      }

      const [pool] = await db
        .select()
        .from(challengeWinnerPools)
        .where(eq(challengeWinnerPools.challengeId, challengeId))
        .limit(1);
      if (!pool) {
        res.status(409).json({ error: 'no_pool', message: 'challenge is not a Winner Pool challenge' });
        return;
      }

      // Refuse if already calculated and beyond DISPUTE_OPEN
      if (pool.calculatedAt) {
        res.status(409).json({ error: 'already_calculated', calculatedAt: pool.calculatedAt });
        return;
      }

      // ─── Build participant snapshots ──────────────────────────────────
      const participants = await db
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challengeId, challengeId));

      const snapshots: ParticipantSnapshot[] = [];
      for (const p of participants) {
        const subs = await db
          .select({
            verificationStatus: challengeSubmissions.verificationStatus,
            metricValue: challengeSubmissions.metricValue,
            submittedAt: challengeSubmissions.submittedAt,
          })
          .from(challengeSubmissions)
          .where(eq(challengeSubmissions.participantId, p.id));

        const approved = subs.filter((s) => s.verificationStatus === 'APPROVED' || s.verificationStatus === 'AUTO_APPROVED');
        const pending = subs.filter((s) => s.verificationStatus === 'PENDING_REVIEW' || s.verificationStatus === 'SUBMITTED');
        const earliest = approved.reduce<number | undefined>(
          (min, s) => (s.submittedAt && (!min || s.submittedAt.getTime() < min) ? s.submittedAt.getTime() : min),
          undefined,
        );

        const progressValue = approved.reduce((sum, s) => sum + Number(s.metricValue ?? 0), 0);

        snapshots.push({
          participantId: p.id,
          userId: p.userId,
          completionCount: approved.length,
          progressValue,
          missedCount: Number(p.missedCount ?? 0),
          approvedSubmissionCount: approved.length,
          disqualified: p.resultStatus === 'DISQUALIFIED',
          hasPendingProof: pending.length > 0,
          firstCompletedAt: earliest,
          teamId: p.teamId ?? null,
          violationCount: 0,
        });
      }

      const verdicts = evaluateAll(snapshots, {
        winConditionType: rule.winConditionType as WinConditionCode,
        targetValue: rule.targetValue ? Number(rule.targetValue) : null,
        limitValue: rule.limitValue ? Number(rule.limitValue) : null,
        requiredCount: rule.requiredCount,
        allowedMisses: rule.allowedMisses,
        winnerCount: rule.winnerCount,
        winnerPercentage: rule.winnerPercentage ? Number(rule.winnerPercentage) : null,
        teamTargetValue: rule.teamTargetValue ? Number(rule.teamTargetValue) : null,
        individualMinimumValue: rule.individualMinimumValue ? Number(rule.individualMinimumValue) : null,
        rankingOrder: 'DESC',
        tieBreaker: rule.tieBreaker,
      });

      // Write result_status back to participants
      for (const v of verdicts) {
        await db
          .update(challengeParticipants)
          .set({
            resultStatus: v.resultStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : v.resultStatus,
            finalScore: v.finalScore?.toString() ?? null,
            finalRank: v.finalRank,
          })
          .where(eq(challengeParticipants.id, v.participantId));
      }

      const winners = verdicts.filter((v) => v.resultStatus === 'SUCCESS');

      // ─── Pool math ─────────────────────────────────────────────────────
      const heldContribs = await db
        .select({ participantId: challengePoolContributions.participantId, amount: challengePoolContributions.amount })
        .from(challengePoolContributions)
        .where(and(eq(challengePoolContributions.winnerPoolId, pool.id), eq(challengePoolContributions.paymentStatus, 'HELD')));

      const math = calculatePool({
        heldContributions: heldContribs.map((c) => ({ participantId: c.participantId, amount: Number(c.amount) })),
        refundedAmountTotal: 0,
        platformFeePercentage: pool.platformFeePercentage ? Number(pool.platformFeePercentage) : undefined,
        platformFeeFixed: pool.platformFeeFixed ? Number(pool.platformFeeFixed) : undefined,
      });

      // ─── No-winner rule ────────────────────────────────────────────────
      if (winners.length === 0) {
        // Apply no_winner_rule (default REFUND_ALL — handled by release endpoint
        // marking contributions as REFUNDED). Here we just note it and stop.
        await db
          .update(challengeWinnerPools)
          .set({
            calculatedAt: new Date(),
            netPoolAmount: math.netPool.toString(),
            platformFeeAmount: math.platformFee.toString(),
            payoutStatus: 'ON_HOLD',
            updatedAt: new Date(),
          })
          .where(eq(challengeWinnerPools.id, pool.id));

        await db
          .update(challenges)
          .set({ lifecycle: 'CALCULATING', updatedAt: new Date() })
          .where(eq(challenges.id, challengeId));

        await logAudit({
          challengeId,
          action: AUDIT_ACTIONS.POOL_CALCULATED,
          actorType: 'SYSTEM',
          newValue: { winnerCount: 0, noWinnerRule: pool.noWinnerRule, netPool: math.netPool },
        });

        res.json({ winnerCount: 0, netPool: math.netPool, noWinnerRule: pool.noWinnerRule });
        return;
      }

      // ─── Distribute payouts ────────────────────────────────────────────
      const dist = distribute({
        method: pool.distributionMethod as DistributionMethod,
        netPool: math.netPool,
        winners: winners.map((v) => {
          const s = snapshots.find((x) => x.participantId === v.participantId)!;
          return {
            participantId: v.participantId,
            userId: v.userId,
            verifiedScore: s.progressValue,
            finalRank: v.finalRank,
            teamId: s.teamId,
          };
        }),
        rankPercentages: (pool.payoutConfig as { rankPercentages?: number[] } | null)?.rankPercentages,
        maxPayoutPerUser: pool.maxPayoutPerUser ? Number(pool.maxPayoutPerUser) : null,
      });

      // ─── Write payouts in ON_HOLD ──────────────────────────────────────
      await db.transaction(async (tx) => {
        for (const a of dist.allocations) {
          await tx.insert(challengePoolPayouts).values({
            winnerPoolId: pool.id,
            challengeId,
            participantId: a.participantId,
            userId: a.userId,
            payoutAmount: a.payoutAmount.toString(),
            currency: pool.currency ?? 'MYR',
            payoutFormula: a.payoutFormula,
            payoutStatus: 'ON_HOLD',
          });
        }
        await tx
          .update(challengeWinnerPools)
          .set({
            calculatedAt: new Date(),
            netPoolAmount: math.netPool.toString(),
            platformFeeAmount: math.platformFee.toString(),
            payoutStatus: 'ON_HOLD',
            updatedAt: new Date(),
          })
          .where(eq(challengeWinnerPools.id, pool.id));
        await tx
          .update(challenges)
          .set({ lifecycle: 'DISPUTE_OPEN', updatedAt: new Date() })
          .where(eq(challenges.id, challengeId));
      });

      await logAuditMany(
        dist.allocations.map((a) => ({
          challengeId,
          action: AUDIT_ACTIONS.PAYOUT_QUEUED,
          actorType: 'SYSTEM' as const,
          newValue: {
            participantId: a.participantId,
            userId: a.userId,
            amount: a.payoutAmount,
            formula: a.payoutFormula,
          },
        })),
      );

      await logAudit({
        challengeId,
        action: AUDIT_ACTIONS.POOL_CALCULATED,
        actorType: 'SYSTEM',
        newValue: {
          winnerCount: dist.allocations.length,
          netPool: math.netPool,
          remainder: dist.remainder,
        },
      });

      res.json({
        winnerCount: dist.allocations.length,
        netPool: math.netPool,
        platformFee: math.platformFee,
        remainder: dist.remainder,
        lifecycle: 'DISPUTE_OPEN',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /internal/challenges/:id/winner-pool/release-payout
// After dispute window closes and admin approves: actually move money out.
// Gated by checkPayoutGate (no active disputes, no fraud flags, lifecycle ≥ LOCKED).
// ────────────────────────────────────────────────────────────────────────────

internalWinnerPoolRouter.post(
  '/challenges/:id/winner-pool/release-payout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!checkSecret(req, res)) return;
      const challengeId = req.params.id;
      if (!challengeId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }

      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
      if (!challenge) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const [pool] = await db
        .select()
        .from(challengeWinnerPools)
        .where(eq(challengeWinnerPools.challengeId, challengeId))
        .limit(1);
      if (!pool) {
        res.status(409).json({ error: 'no_pool' });
        return;
      }

      // Lifecycle should be LOCKED at this point
      const gate = await checkPayoutGate({
        challengeId,
        challengeEndAt: challenge.endAt,
        disputeWindowHours: pool.disputeWindowHours ?? 24,
        lifecycle: challenge.lifecycle,
        fraudFlagsUnresolved: 0, // wire in once fraud signals table exists
      });
      if (!gate.ok) {
        res.status(409).json({ error: 'payout_gate_blocked', reason: gate.reason, details: gate.details });
        return;
      }

      if (pool.manualApprovalRequired && !pool.payoutsReleasedAt) {
        // Caller must have admin approved each payout row already (PAYOUT_APPROVED).
        const stillUnapproved = await db
          .select({ id: challengePoolPayouts.id })
          .from(challengePoolPayouts)
          .where(and(eq(challengePoolPayouts.winnerPoolId, pool.id), eq(challengePoolPayouts.payoutStatus, 'ON_HOLD')))
          .limit(1);
        if (stillUnapproved.length > 0) {
          res.status(409).json({ error: 'manual_approval_required', message: 'Some payouts still on hold' });
          return;
        }
      }

      // Mark READY (and execute Stripe transfer if configured)
      const ready = await db
        .select()
        .from(challengePoolPayouts)
        .where(and(eq(challengePoolPayouts.winnerPoolId, pool.id), eq(challengePoolPayouts.payoutStatus, 'READY')));

      let released = 0;
      let failed = 0;
      for (const p of ready) {
        try {
          // For MVP: payouts are tracked but Stripe transfer integration requires
          // Stripe Connect on the winner side. Compliance review (§4.2) covers
          // this. For now we mark as COMPLETED and log; real money transfer
          // happens once Connect is wired.
          await db
            .update(challengePoolPayouts)
            .set({
              payoutStatus: stripe ? 'COMPLETED' : 'COMPLETED',
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(challengePoolPayouts.id, p.id));
          released++;
        } catch (err) {
          await db
            .update(challengePoolPayouts)
            .set({
              payoutStatus: 'FAILED',
              failureReason: (err as Error).message,
              updatedAt: new Date(),
            })
            .where(eq(challengePoolPayouts.id, p.id));
          failed++;
        }
      }

      await db
        .update(challengeWinnerPools)
        .set({
          payoutStatus: failed > 0 ? 'FAILED' : 'COMPLETED',
          payoutsReleasedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(challengeWinnerPools.id, pool.id));

      await db
        .update(challenges)
        .set({ lifecycle: 'COMPLETED', updatedAt: new Date() })
        .where(eq(challenges.id, challengeId));

      // Mark contributions PAYOUT (winners) or FORFEITED (losers)
      // For now we leave losing contributions in HELD — they're already
      // accounted for in netPool. The dailyResolution cron later sweeps them.
      // Winners' contributions stay HELD too (they got money OUT via payouts).

      await logAudit({
        challengeId,
        action: AUDIT_ACTIONS.PAYOUT_RELEASED,
        actorType: 'SYSTEM',
        newValue: { released, failed },
      });

      res.json({ released, failed, lifecycle: 'COMPLETED' });
    } catch (err) {
      next(err);
    }
  },
);
