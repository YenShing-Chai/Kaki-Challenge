/**
 * Admin moderation + payout endpoints — PRD §16 + Winner Pool §24.4.
 *
 * Mounted under /admin/* — protected by requireAdmin (ADMIN_EMAIL check).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../lib/db';
import {
  challenges,
  challengeRules,
  challengeWinnerPools,
  challengePoolPayouts,
  challengeSubmissions,
  challengeDisputes,
  challengeAuditLogs,
  users,
} from '../db/schema';
import { logAudit, AUDIT_ACTIONS } from '../lib/auditLog';

export const adminChallengesRouter = Router();

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/challenges/review-queue
// Pending review challenges, oldest first. Includes creator name +
// moderation reason so the queue UI can show triage info inline.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get('/challenges/review-queue', requireAdmin, async (_req, res, next) => {
  try {
    const queue = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        description: challenges.description,
        category: challenges.categoryV2,
        creatorIntent: challenges.creatorIntent,
        visibility: challenges.visibility,
        rewardType: challenges.rewardType,
        riskLevel: challenges.riskLevel,
        moderationStatus: challenges.moderationStatus,
        moderationReason: challenges.moderationReason,
        createdAt: challenges.createdAt,
        creatorId: challenges.createdById,
        creatorName: users.name,
        creatorEmail: users.email,
        creatorTrustScore: users.trustScore,
      })
      .from(challenges)
      .innerJoin(users, eq(users.id, challenges.createdById))
      .where(eq(challenges.moderationStatus, 'PENDING_REVIEW'))
      .orderBy(challenges.createdAt);

    const enriched = queue.map((c) => ({
      ...c,
      creatorName: c.creatorName ?? c.creatorEmail.split('@')[0],
      createdAt: c.createdAt.toISOString(),
    }));
    res.json({ queue: enriched });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/challenges/:id/detail
// Full admin view: challenge + rule + winnerPool + recent audit log entries.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get(
  '/challenges/:id/detail',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const challengeId = req.params.id;
      if (!challengeId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      const [c] = await db
        .select({
          id: challenges.id,
          title: challenges.title,
          description: challenges.description,
          category: challenges.categoryV2,
          creatorIntent: challenges.creatorIntent,
          visibility: challenges.visibility,
          rewardType: challenges.rewardType,
          riskLevel: challenges.riskLevel,
          moderationStatus: challenges.moderationStatus,
          moderationReason: challenges.moderationReason,
          lifecycle: challenges.lifecycle,
          startAt: challenges.startAt,
          endAt: challenges.endAt,
          createdAt: challenges.createdAt,
          creatorId: challenges.createdById,
          creatorName: users.name,
          creatorEmail: users.email,
          creatorTrustScore: users.trustScore,
        })
        .from(challenges)
        .innerJoin(users, eq(users.id, challenges.createdById))
        .where(eq(challenges.id, challengeId))
        .limit(1);
      if (!c) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const [rule] = await db
        .select()
        .from(challengeRules)
        .where(eq(challengeRules.challengeId, challengeId))
        .limit(1);

      const [pool] = await db
        .select({
          id: challengeWinnerPools.id,
          entryContributionAmount: challengeWinnerPools.entryContributionAmount,
          currency: challengeWinnerPools.currency,
          distributionMethod: challengeWinnerPools.distributionMethod,
          participantMinimum: challengeWinnerPools.participantMinimum,
          participantMaximum: challengeWinnerPools.participantMaximum,
          payoutStatus: challengeWinnerPools.payoutStatus,
        })
        .from(challengeWinnerPools)
        .where(eq(challengeWinnerPools.challengeId, challengeId))
        .limit(1);

      const audit = await db
        .select({
          action: challengeAuditLogs.action,
          actorType: challengeAuditLogs.actorType,
          actorId: challengeAuditLogs.actorId,
          newValue: challengeAuditLogs.newValue,
          createdAt: challengeAuditLogs.createdAt,
        })
        .from(challengeAuditLogs)
        .where(eq(challengeAuditLogs.challengeId, challengeId))
        .orderBy(desc(challengeAuditLogs.createdAt))
        .limit(20);

      // Disputes on this challenge — admin needs to see them inline to clear
      // any blockers before approving payouts.
      const disputeRows = await db
        .select({
          id: challengeDisputes.id,
          status: challengeDisputes.status,
          disputeReason: challengeDisputes.disputeReason,
          description: challengeDisputes.description,
          raiserId: challengeDisputes.raisedBy,
          raiserName: users.name,
          raiserEmail: users.email,
          createdAt: challengeDisputes.createdAt,
          resolution: challengeDisputes.resolution,
          resolvedAt: challengeDisputes.resolvedAt,
        })
        .from(challengeDisputes)
        .innerJoin(users, eq(users.id, challengeDisputes.raisedBy))
        .where(eq(challengeDisputes.challengeId, challengeId))
        .orderBy(desc(challengeDisputes.createdAt));

      res.json({
        challenge: {
          ...c,
          creatorName: c.creatorName ?? c.creatorEmail.split('@')[0],
          startAt: c.startAt?.toISOString() ?? null,
          endAt: c.endAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        },
        rule: rule ?? null,
        winnerPool: pool ?? null,
        disputes: disputeRows.map((d) => ({
          ...d,
          raiserName: d.raiserName ?? d.raiserEmail.split('@')[0],
          createdAt: d.createdAt.toISOString(),
          resolvedAt: d.resolvedAt?.toISOString() ?? null,
        })),
        audit: audit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/submissions/review-queue
// All submissions currently in PENDING_REVIEW across the system.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get(
  '/submissions/review-queue',
  requireAdmin,
  async (_req, res, next) => {
    try {
      const rows = await db
        .select({
          id: challengeSubmissions.id,
          challengeId: challengeSubmissions.challengeId,
          challengeTitle: challenges.title,
          submitterId: challengeSubmissions.userId,
          submitterName: users.name,
          submitterEmail: users.email,
          submissionType: challengeSubmissions.submissionType,
          evidenceUrl: challengeSubmissions.evidenceUrl,
          metricValue: challengeSubmissions.metricValue,
          submittedAt: challengeSubmissions.submittedAt,
          confidenceScore: challengeSubmissions.confidenceScore,
          metadata: challengeSubmissions.metadata,
        })
        .from(challengeSubmissions)
        .innerJoin(users, eq(users.id, challengeSubmissions.userId))
        .innerJoin(challenges, eq(challenges.id, challengeSubmissions.challengeId))
        .where(eq(challengeSubmissions.verificationStatus, 'PENDING_REVIEW'))
        .orderBy(challengeSubmissions.submittedAt)
        .limit(100);
      res.json({
        queue: rows.map((r) => ({
          ...r,
          metricValue: r.metricValue ? Number(r.metricValue) : null,
          submitterName: r.submitterName ?? r.submitterEmail.split('@')[0],
          submittedAt: r.submittedAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// GET /admin/disputes/queue
// All OPEN + UNDER_REVIEW disputes across the system.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.get('/disputes/queue', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: challengeDisputes.id,
        challengeId: challengeDisputes.challengeId,
        challengeTitle: challenges.title,
        status: challengeDisputes.status,
        disputeReason: challengeDisputes.disputeReason,
        description: challengeDisputes.description,
        raiserId: challengeDisputes.raisedBy,
        raiserName: users.name,
        raiserEmail: users.email,
        createdAt: challengeDisputes.createdAt,
      })
      .from(challengeDisputes)
      .innerJoin(users, eq(users.id, challengeDisputes.raisedBy))
      .innerJoin(challenges, eq(challenges.id, challengeDisputes.challengeId))
      .where(inArray(challengeDisputes.status, ['OPEN', 'UNDER_REVIEW']))
      .orderBy(challengeDisputes.createdAt);
    res.json({
      queue: rows.map((r) => ({
        ...r,
        raiserName: r.raiserName ?? r.raiserEmail.split('@')[0],
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /admin/disputes/:id/resolve
// Resolve a dispute. Status must be UPHELD | REJECTED | WITHDRAWN | RESOLVED_VOID.
// ────────────────────────────────────────────────────────────────────────────

adminChallengesRouter.post(
  '/disputes/:id/resolve',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const disputeId = req.params.id;
      if (!disputeId) {
        res.status(400).json({ error: 'bad_request' });
        return;
      }
      const body = (req.body ?? {}) as {
        status?: 'UPHELD' | 'REJECTED' | 'WITHDRAWN' | 'RESOLVED_VOID';
        resolutionNote?: string;
      };
      const allowed = ['UPHELD', 'REJECTED', 'WITHDRAWN', 'RESOLVED_VOID'] as const;
      if (!body.status || !(allowed as readonly string[]).includes(body.status)) {
        res.status(400).json({ error: 'bad_request', message: 'invalid status' });
        return;
      }

      const [updated] = await db
        .update(challengeDisputes)
        .set({
          status: body.status,
          resolution: body.resolutionNote ?? null,
          resolvedBy: req.auth.userId,
          resolvedAt: new Date(),
        })
        .where(eq(challengeDisputes.id, disputeId))
        .returning({ challengeId: challengeDisputes.challengeId });

      if (!updated) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      await logAudit({
        challengeId: updated.challengeId,
        action: AUDIT_ACTIONS.DISPUTE_RESOLVED,
        actorId: req.auth.userId,
        actorType: 'ADMIN',
        newValue: { disputeId, status: body.status, note: body.resolutionNote },
      });

      res.json({ ok: true, status: body.status });
    } catch (err) {
      next(err);
    }
  },
);

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
