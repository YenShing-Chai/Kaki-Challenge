/**
 * Admin moderation + payout endpoints — PRD §16 + Winner Pool §24.4.
 *
 * Mounted under /admin/* — protected by requireAdmin (ADMIN_EMAIL check).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';

import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../lib/db';
import {
  challenges,
  challengeRules,
  challengeWinnerPools,
  challengePoolPayouts,
  challengeSubmissions,
} from '../db/schema';
import { logAudit, AUDIT_ACTIONS } from '../lib/auditLog';

export const adminChallengesRouter = Router();

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/challenges/review-queue
// Pending review challenges, oldest first.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get('/challenges/review-queue', requireAdmin, async (_req, res, next) => {
  try {
    const queue = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        category: challenges.categoryV2,
        creatorIntent: challenges.creatorIntent,
        visibility: challenges.visibility,
        rewardType: challenges.rewardType,
        riskLevel: challenges.riskLevel,
        moderationStatus: challenges.moderationStatus,
        createdAt: challenges.createdAt,
      })
      .from(challenges)
      .where(eq(challenges.moderationStatus, 'PENDING_REVIEW'))
      .orderBy(challenges.createdAt);
    res.json({ queue });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /admin/challenges/:id/approve
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.post('/challenges/:id/approve', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const challengeId = req.params.id;
    if (!challengeId) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const [updated] = await db
      .update(challenges)
      .set({
        moderationStatus: 'APPROVED',
        lifecycle: 'SCHEDULED',
        moderationReviewedBy: req.auth.userId,
        moderationReviewedAt: new Date(),
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(challenges.id, challengeId))
      .returning({ id: challenges.id });

    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await logAudit({
      challengeId,
      action: AUDIT_ACTIONS.CHALLENGE_APPROVED,
      actorId: req.auth.userId,
      actorType: 'ADMIN',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /admin/challenges/:id/reject
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.post('/challenges/:id/reject', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const challengeId = req.params.id;
    if (!challengeId) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const body = (req.body ?? {}) as { reason?: string };

    const [updated] = await db
      .update(challenges)
      .set({
        moderationStatus: 'REJECTED',
        lifecycle: 'CANCELLED',
        moderationReason: body.reason ?? 'admin rejected',
        moderationReviewedBy: req.auth.userId,
        moderationReviewedAt: new Date(),
        cancelledAt: new Date(),
        cancelledReason: body.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(challenges.id, challengeId))
      .returning({ id: challenges.id });

    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await logAudit({
      challengeId,
      action: AUDIT_ACTIONS.CHALLENGE_REJECTED,
      actorId: req.auth.userId,
      actorType: 'ADMIN',
      newValue: { reason: body.reason },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/winner-pool/payout-queue
// Pools whose dispute window has closed but payouts still ON_HOLD.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get('/winner-pool/payout-queue', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        poolId: challengeWinnerPools.id,
        challengeId: challengeWinnerPools.challengeId,
        title: challenges.title,
        netPool: challengeWinnerPools.netPoolAmount,
        currency: challengeWinnerPools.currency,
        calculatedAt: challengeWinnerPools.calculatedAt,
        payoutStatus: challengeWinnerPools.payoutStatus,
        lifecycle: challenges.lifecycle,
      })
      .from(challengeWinnerPools)
      .innerJoin(challenges, eq(challenges.id, challengeWinnerPools.challengeId))
      .where(eq(challengeWinnerPools.payoutStatus, 'ON_HOLD'));
    res.json({ queue: rows });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /admin/winner-pool/:poolId/approve-payouts
// Flip all ON_HOLD payouts in a pool to READY. The internal release
// endpoint then actually moves money.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.post(
  '/winner-pool/:poolId/approve-payouts',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const poolId = req.params.poolId;
      if (!poolId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }

      const [pool] = await db
        .select({ challengeId: challengeWinnerPools.challengeId })
        .from(challengeWinnerPools)
        .where(eq(challengeWinnerPools.id, poolId))
        .limit(1);
      if (!pool) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const updated = await db
        .update(challengePoolPayouts)
        .set({
          payoutStatus: 'READY',
          approvedBy: req.auth.userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(challengePoolPayouts.winnerPoolId, poolId), eq(challengePoolPayouts.payoutStatus, 'ON_HOLD')))
        .returning({ id: challengePoolPayouts.id });

      // Move challenge → LOCKED so checkPayoutGate passes
      await db
        .update(challenges)
        .set({ lifecycle: 'LOCKED', updatedAt: new Date() })
        .where(eq(challenges.id, pool.challengeId));

      await logAudit({
        challengeId: pool.challengeId,
        action: AUDIT_ACTIONS.PAYOUT_APPROVED,
        actorId: req.auth.userId,
        actorType: 'ADMIN',
        newValue: { count: updated.length },
      });

      res.json({ ok: true, count: updated.length, lifecycle: 'LOCKED' });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /admin/submissions/:id/review
// Manually approve/reject a submission still in PENDING_REVIEW.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.post(
  '/submissions/:id/review',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const submissionId = req.params.id;
      if (!submissionId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      const body = (req.body ?? {}) as { decision?: 'APPROVE' | 'REJECT'; reason?: string };
      if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
        res.status(400).json({ error: 'bad_request', message: 'decision must be APPROVE or REJECT' });
        return;
      }

      const newStatus = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const [updated] = await db
        .update(challengeSubmissions)
        .set({
          verificationStatus: newStatus,
          reviewStatus: newStatus,
          reviewedBy: req.auth.userId,
          reviewedAt: new Date(),
          rejectionReason: body.decision === 'REJECT' ? body.reason ?? null : null,
        })
        .where(eq(challengeSubmissions.id, submissionId))
        .returning({ challengeId: challengeSubmissions.challengeId });

      if (!updated) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      await logAudit({
        challengeId: updated.challengeId,
        action: body.decision === 'APPROVE' ? AUDIT_ACTIONS.SUBMISSION_APPROVED : AUDIT_ACTIONS.SUBMISSION_REJECTED,
        actorId: req.auth.userId,
        actorType: 'ADMIN',
        newValue: { submissionId, reason: body.reason },
      });

      res.json({ ok: true, status: newStatus });
    } catch (err) {
      next(err);
    }
  },
);
