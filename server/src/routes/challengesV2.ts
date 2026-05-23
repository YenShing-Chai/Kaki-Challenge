/**
 * Create Challenge Engine v2 — PRD §15 + Winner Pool §24.
 *
 * Mounted under /api/challenges/* so the legacy /challenges/* routes keep
 * working for the current mobile app until Phase 3 cuts over.
 *
 * Endpoints:
 *   POST /api/challenges/validate    — pre-flight safety check
 *   POST /api/challenges             — create (writes Challenge + Rule + optional WinnerPool)
 *   POST /api/challenges/:id/join    — join (Winner Pool: Stripe payment intent)
 *   POST /api/challenges/:id/submissions
 *   POST /api/challenges/:id/peer-reviews
 *   POST /api/challenges/:id/disputes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import {
  challenges,
  challengeRules,
  challengeParticipants,
  challengeSubmissions,
  challengePeerReviews,
  challengeDisputes,
  challengeWinnerPools,
  challengePoolContributions,
  users,
} from '../db/schema';

import { evaluateModeration, type ModerationInput } from '../lib/moderation';
import { checkRewardVerificationCompatibility, computeConfidence, classifySubmission, resolvePeerOutcome, PEER_RULES } from '../lib/verification';
import { validateRule, type WinConditionCode } from '../lib/winConditions';
import { checkWinnerPoolGuardrails, WINNER_POOL_MVP } from '../lib/winnerPool';
import { computeTrust, policyForTier } from '../lib/trustScore';
import { logAudit, AUDIT_ACTIONS } from '../lib/auditLog';
import { canRaiseDispute, isValidReason, windowHoursForRisk } from '../lib/disputes';
import { stripe } from '../lib/stripe';

export const challengesV2Router = Router();

// ─── Shared helpers ────────────────────────────────────────────────────────

function badRequest(res: Response, message: string, extra?: Record<string, unknown>) {
  res.status(400).json({ error: 'bad_request', message, ...(extra ?? {}) });
}

function unauthorized(res: Response) {
  res.status(401).json({ error: 'unauthorized' });
}

function notFound(res: Response, what: string) {
  res.status(404).json({ error: 'not_found', message: `${what} not found` });
}

interface CreateChallengePayload {
  title: string;
  description?: string;
  creatorIntent: ModerationInput['intent'];
  category: ModerationInput['category'];
  visibility: ModerationInput['visibility'];
  rewardType: ModerationInput['reward'];
  verificationMethod: ModerationInput['verification'];
  winCondition: {
    type: WinConditionCode;
    targetValue?: number;
    limitValue?: number;
    requiredCount?: number;
    allowedMisses?: number;
    winnerCount?: number;
    winnerPercentage?: number;
    teamTargetValue?: number;
    individualMinimumValue?: number;
    tieBreaker?: string;
    metricType?: string;
    frequency?: string;
  };
  winnerPool?: {
    entryContributionAmount: number;
    currency?: string;
    distributionMethod: string;
    participantMinimum: number;
    participantMaximum: number;
    disputeWindowHours?: number;
    noWinnerRule?: string;
    payoutConfig?: { rankPercentages?: number[] };
    termsAccepted: boolean;
  };
  startAt: string; // ISO
  endAt: string;
  timezone?: string;
  participantLimit?: number;
  minParticipants?: number;
  gracePeriodMinutes?: number;
  allowLateJoin?: boolean;
}

function parsePayload(body: unknown): CreateChallengePayload | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) return null;
  if (typeof b.creatorIntent !== 'string') return null;
  if (typeof b.category !== 'string') return null;
  if (typeof b.visibility !== 'string') return null;
  if (typeof b.rewardType !== 'string') return null;
  if (typeof b.verificationMethod !== 'string') return null;
  if (!b.winCondition || typeof b.winCondition !== 'object') return null;
  if (typeof b.startAt !== 'string' || typeof b.endAt !== 'string') return null;
  return body as unknown as CreateChallengePayload;
}

async function loadCreatorContext(userId: string) {
  const [u] = await db
    .select({
      id: users.id,
      isAgeVerified: users.isAgeVerified,
      jurisdiction: users.jurisdiction,
      trustScore: users.trustScore,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges/validate
// Pre-flight safety check. No DB writes.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/validate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const p = parsePayload(req.body);
    if (!p) return badRequest(res, 'invalid payload');

    const creator = await loadCreatorContext(req.auth.userId);
    if (!creator) return notFound(res, 'user');

    // 1. Rule validation
    const ruleErrors = validateRule({
      winConditionType: p.winCondition.type,
      targetValue: p.winCondition.targetValue,
      limitValue: p.winCondition.limitValue,
      requiredCount: p.winCondition.requiredCount,
      allowedMisses: p.winCondition.allowedMisses,
      winnerCount: p.winCondition.winnerCount,
      winnerPercentage: p.winCondition.winnerPercentage,
      teamTargetValue: p.winCondition.teamTargetValue,
      individualMinimumValue: p.winCondition.individualMinimumValue,
      tieBreaker: p.winCondition.tieBreaker,
    });
    if (ruleErrors.length > 0) {
      return res.json({ canCreate: false, blockReason: ruleErrors.join('; '), errors: ruleErrors });
    }

    // 2. Reward × verification compatibility
    const compatErr = checkRewardVerificationCompatibility(p.rewardType as never, p.verificationMethod as never);
    if (compatErr) {
      return res.json({ canCreate: false, blockReason: compatErr });
    }

    // 3. Moderation pipeline
    const mod = evaluateModeration({
      title: p.title,
      description: p.description,
      intent: p.creatorIntent,
      category: p.category,
      visibility: p.visibility,
      reward: p.rewardType,
      verification: p.verificationMethod,
      creatorTrustScore: creator.trustScore ?? undefined,
    });
    if (mod.blocked) {
      return res.json({
        canCreate: false,
        riskLevel: mod.riskLevel,
        blockReason: mod.blockReason,
        suggestedAlternative: mod.suggestedAlternative,
      });
    }

    // 4. Winner Pool guardrails (if applicable)
    if (p.rewardType === 'WINNER_POOL') {
      if (!p.winnerPool) {
        return res.json({ canCreate: false, blockReason: 'winnerPool config required for WINNER_POOL reward' });
      }
      const guard = checkWinnerPoolGuardrails(
        {
          entryContributionAmount: p.winnerPool.entryContributionAmount,
          participantMinimum: p.winnerPool.participantMinimum,
          participantMaximum: p.winnerPool.participantMaximum,
          distributionMethod: p.winnerPool.distributionMethod as never,
          payoutConfig: p.winnerPool.payoutConfig,
          termsAccepted: p.winnerPool.termsAccepted,
        },
        {
          visibility: p.visibility,
          intent: p.creatorIntent,
          category: p.category,
          reward: p.rewardType,
          verification: p.verificationMethod,
          winCondition: p.winCondition.type,
          creatorAgeVerified: creator.isAgeVerified ?? false,
          creatorJurisdiction: creator.jurisdiction ?? undefined,
          creatorTrustScore: creator.trustScore ?? undefined,
        },
      );
      if (!guard.ok) {
        return res.json({ canCreate: false, blockReason: guard.errors.join('; '), errors: guard.errors });
      }
    }

    res.json({
      canCreate: true,
      riskLevel: mod.riskLevel,
      moderationStatus: mod.moderationStatus,
      warnings: mod.warnings,
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges
// Create new challenge (full PRD shape). Writes Challenge + Rule + optional
// WinnerPool atomically. Status = PENDING_REVIEW or SCHEDULED based on
// moderation outcome.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const userId = req.auth.userId;
    const p = parsePayload(req.body);
    if (!p) return badRequest(res, 'invalid payload');

    const creator = await loadCreatorContext(userId);
    if (!creator) return notFound(res, 'user');

    // Re-run the same validation pipeline
    const ruleErrors = validateRule({
      winConditionType: p.winCondition.type,
      targetValue: p.winCondition.targetValue,
      limitValue: p.winCondition.limitValue,
      requiredCount: p.winCondition.requiredCount,
      allowedMisses: p.winCondition.allowedMisses,
      winnerCount: p.winCondition.winnerCount,
      winnerPercentage: p.winCondition.winnerPercentage,
      teamTargetValue: p.winCondition.teamTargetValue,
      individualMinimumValue: p.winCondition.individualMinimumValue,
    });
    if (ruleErrors.length > 0) return badRequest(res, ruleErrors.join('; '), { errors: ruleErrors });

    const compatErr = checkRewardVerificationCompatibility(p.rewardType, p.verificationMethod);
    if (compatErr) return badRequest(res, compatErr);

    const mod = evaluateModeration({
      title: p.title,
      description: p.description,
      intent: p.creatorIntent,
      category: p.category,
      visibility: p.visibility,
      reward: p.rewardType,
      verification: p.verificationMethod,
      creatorTrustScore: creator.trustScore ?? undefined,
    });
    if (mod.blocked) {
      return res.status(422).json({
        error: 'blocked',
        blockReason: mod.blockReason,
        suggestedAlternative: mod.suggestedAlternative,
      });
    }

    if (p.rewardType === 'WINNER_POOL') {
      if (!p.winnerPool) return badRequest(res, 'winnerPool config required for WINNER_POOL reward');
      const guard = checkWinnerPoolGuardrails(
        {
          entryContributionAmount: p.winnerPool.entryContributionAmount,
          participantMinimum: p.winnerPool.participantMinimum,
          participantMaximum: p.winnerPool.participantMaximum,
          distributionMethod: p.winnerPool.distributionMethod as never,
          payoutConfig: p.winnerPool.payoutConfig,
          termsAccepted: p.winnerPool.termsAccepted,
        },
        {
          visibility: p.visibility,
          intent: p.creatorIntent,
          category: p.category,
          reward: p.rewardType,
          verification: p.verificationMethod,
          winCondition: p.winCondition.type,
          creatorAgeVerified: creator.isAgeVerified ?? false,
          creatorJurisdiction: creator.jurisdiction ?? undefined,
          creatorTrustScore: creator.trustScore ?? undefined,
        },
      );
      if (!guard.ok) return badRequest(res, guard.errors.join('; '), { errors: guard.errors });
    }

    const startAt = new Date(p.startAt);
    const endAt = new Date(p.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return badRequest(res, 'invalid dates');
    if (endAt <= startAt) return badRequest(res, 'endAt must be after startAt');

    const lifecycle = mod.moderationStatus === 'AUTO_APPROVED' ? 'SCHEDULED' : 'PENDING_REVIEW';
    const disputeWindowHours = windowHoursForRisk(mod.riskLevel);

    // Insert challenge + rule + (optional) winnerPool in a single transaction.
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(challenges)
        .values({
          title: p.title,
          description: p.description ?? null,
          createdById: userId,
          isPublic: p.visibility === 'PUBLIC',
          commitmentFee: '0', // legacy column; new flow uses pool tables
          dailyStepGoal: 0, // legacy
          durationDays: Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 86400000)),
          startDate: startAt,
          endDate: endAt,
          prizePool: '0',
          maxParticipants: p.participantLimit ?? p.winnerPool?.participantMaximum ?? null,
          minParticipants: p.minParticipants ?? p.winnerPool?.participantMinimum ?? 2,
          // New PRD columns
          creatorIntent: p.creatorIntent,
          categoryV2: p.category,
          visibility: p.visibility,
          lifecycle,
          riskLevel: mod.riskLevel,
          moderationStatus: mod.moderationStatus,
          rewardType: p.rewardType,
          timezone: p.timezone ?? null,
          startAt,
          endAt,
          disputeWindowHours,
          gracePeriodMinutes: p.gracePeriodMinutes ?? 0,
          allowLateJoin: p.allowLateJoin ?? false,
        })
        .returning({ id: challenges.id });

      if (!created) throw new Error('challenge insert returned no row');
      const challengeId = created.id;

      await tx.insert(challengeRules).values({
        challengeId,
        winConditionType: p.winCondition.type,
        metricType: p.winCondition.metricType ?? null,
        targetValue: p.winCondition.targetValue?.toString() ?? null,
        limitValue: p.winCondition.limitValue?.toString() ?? null,
        frequency: p.winCondition.frequency ?? null,
        requiredCount: p.winCondition.requiredCount ?? null,
        allowedMisses: p.winCondition.allowedMisses ?? 0,
        winnerCount: p.winCondition.winnerCount ?? null,
        winnerPercentage: p.winCondition.winnerPercentage?.toString() ?? null,
        tieBreaker: p.winCondition.tieBreaker ?? null,
        teamTargetValue: p.winCondition.teamTargetValue?.toString() ?? null,
        individualMinimumValue: p.winCondition.individualMinimumValue?.toString() ?? null,
        verificationLevel: p.verificationMethod,
        minConfidenceScore: 0,
      });

      if (p.rewardType === 'WINNER_POOL' && p.winnerPool) {
        await tx.insert(challengeWinnerPools).values({
          challengeId,
          currency: p.winnerPool.currency ?? 'MYR',
          entryContributionAmount: p.winnerPool.entryContributionAmount.toString(),
          distributionMethod: p.winnerPool.distributionMethod as never,
          payoutConfig: p.winnerPool.payoutConfig ?? null,
          participantMinimum: p.winnerPool.participantMinimum,
          participantMaximum: p.winnerPool.participantMaximum,
          disputeWindowHours: p.winnerPool.disputeWindowHours ?? disputeWindowHours,
          autoPayoutAllowed: false,
          manualApprovalRequired: true,
          noWinnerRule: (p.winnerPool.noWinnerRule ?? 'REFUND_ALL') as never,
          termsAcceptedAt: new Date(),
        });
      }

      return { challengeId, lifecycle };
    });

    await logAudit({
      challengeId: result.challengeId,
      action: AUDIT_ACTIONS.CHALLENGE_CREATED,
      actorId: userId,
      actorType: 'USER',
      newValue: {
        title: p.title,
        rewardType: p.rewardType,
        lifecycle: result.lifecycle,
        riskLevel: mod.riskLevel,
        moderationStatus: mod.moderationStatus,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });

    res.status(201).json({
      id: result.challengeId,
      lifecycle: result.lifecycle,
      moderationStatus: mod.moderationStatus,
      riskLevel: mod.riskLevel,
      warnings: mod.warnings,
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges/:id/join
// Join a challenge. For Winner Pool challenges, creates a Stripe payment
// intent and a HELD pool contribution row.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/:id/join', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const userId = req.auth.userId;
    const challengeId = req.params.id;
    if (!challengeId) return badRequest(res, 'missing id');

    const body = (req.body ?? {}) as { acceptedTerms?: boolean };
    if (!body.acceptedTerms) return badRequest(res, 'must accept Winner Pool terms before joining');

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return notFound(res, 'challenge');

    // Challenge joinable?
    if (challenge.lifecycle !== 'SCHEDULED' && challenge.lifecycle !== 'PENDING_REVIEW') {
      return badRequest(res, 'challenge not joinable', { lifecycle: challenge.lifecycle });
    }
    if (challenge.startAt && new Date(challenge.startAt) <= new Date()) {
      if (!challenge.allowLateJoin) return badRequest(res, 'challenge already started');
    }

    // Already a participant?
    const [existing] = await db
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, userId)))
      .limit(1);
    if (existing) return badRequest(res, 'already joined');

    // Participant count cap
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challengeId));
    const currentCount = countRow?.n ?? 0;
    if (challenge.maxParticipants && currentCount >= challenge.maxParticipants) {
      return badRequest(res, 'challenge full');
    }

    // Load Winner Pool config if any
    const [pool] = await db
      .select()
      .from(challengeWinnerPools)
      .where(eq(challengeWinnerPools.challengeId, challengeId))
      .limit(1);

    // Non-WP join is trivial
    if (!pool) {
      const [participant] = await db
        .insert(challengeParticipants)
        .values({
          challengeId,
          userId,
          commitmentPaid: '0',
        })
        .returning();

      await logAudit({
        challengeId,
        action: AUDIT_ACTIONS.PARTICIPANT_JOINED,
        actorId: userId,
        actorType: 'USER',
        newValue: { participantId: participant?.id },
      });

      return res.status(201).json({ participantId: participant?.id, requiresPayment: false });
    }

    // ─── Winner Pool join: create Stripe payment intent + HELD contribution ──
    if (!stripe) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    // Load user's Stripe customer
    const [user] = await db
      .select({
        stripeCustomerId: users.stripeCustomerId,
        stripePaymentMethodId: users.stripePaymentMethodId,
        isAgeVerified: users.isAgeVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return notFound(res, 'user');
    if (!user.isAgeVerified) return badRequest(res, 'age verification required for Winner Pool');
    if (!user.stripeCustomerId || !user.stripePaymentMethodId) {
      return badRequest(res, 'no payment method on file');
    }

    const amountMyr = Number(pool.entryContributionAmount);
    const amountCents = Math.round(amountMyr * 100);

    // Create off-session payment intent with manual capture so we can HOLD.
    // For MVP we use a regular payment_intent (immediate capture) since
    // Stripe Connect/manual-capture-on-customer needs more setup. Money sits
    // on the platform until release. Compliance review may require Connect
    // before production.
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: (pool.currency ?? 'MYR').toLowerCase(),
      customer: user.stripeCustomerId,
      payment_method: user.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'automatic',
      description: `Kaki Winner Pool — challenge ${challengeId}`,
      metadata: { challengeId, userId, kind: 'winner_pool_entry' },
    });

    if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
      return res.status(402).json({
        error: 'payment_failed',
        message: 'Could not collect entry contribution',
        intentStatus: intent.status,
      });
    }

    // Create participant + contribution + bump pool totals in one tx
    const ids = await db.transaction(async (tx) => {
      const [participant] = await tx
        .insert(challengeParticipants)
        .values({
          challengeId,
          userId,
          commitmentPaid: amountMyr.toString(),
          stripePaymentIntentId: intent.id,
        })
        .returning({ id: challengeParticipants.id });

      if (!participant) throw new Error('participant insert returned no row');

      const [contribution] = await tx
        .insert(challengePoolContributions)
        .values({
          winnerPoolId: pool.id,
          challengeId,
          participantId: participant.id,
          userId,
          amount: amountMyr.toString(),
          currency: pool.currency ?? 'MYR',
          paymentReference: intent.id,
          paymentStatus: 'HELD',
          heldAt: new Date(),
        })
        .returning({ id: challengePoolContributions.id });

      // Bump pool totals
      await tx
        .update(challengeWinnerPools)
        .set({
          totalPoolAmount: sql`${challengeWinnerPools.totalPoolAmount} + ${amountMyr}`,
          adjustedPoolAmount: sql`${challengeWinnerPools.adjustedPoolAmount} + ${amountMyr}`,
          updatedAt: new Date(),
        })
        .where(eq(challengeWinnerPools.id, pool.id));

      return { participantId: participant.id, contributionId: contribution?.id };
    });

    await logAudit({
      challengeId,
      action: AUDIT_ACTIONS.POOL_CONTRIBUTION_HELD,
      actorId: userId,
      actorType: 'USER',
      newValue: {
        contributionId: ids.contributionId,
        amount: amountMyr,
        currency: pool.currency,
        paymentIntent: intent.id,
      },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json({
      participantId: ids.participantId,
      contributionId: ids.contributionId,
      paymentIntentId: intent.id,
      amountHeld: amountMyr,
      currency: pool.currency,
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/challenges/:id/submissions/pending-review
// Returns submissions in PENDING_REVIEW for this challenge minus:
//   • the caller's own submissions (cannot peer-review self)
//   • submissions the caller has already reviewed
// Each row carries submitter info + current approval/rejection tallies so the
// reviewer UI can show "1 of 2 approvals" progress.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.get(
  '/:id/submissions/pending-review',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) return unauthorized(res);
      const userId = req.auth.userId;
      const challengeId = req.params.id;
      if (!challengeId) return badRequest(res, 'missing id');

      // Reviewer must be a challenge participant.
      const [participant] = await db
        .select({ id: challengeParticipants.id })
        .from(challengeParticipants)
        .where(
          and(
            eq(challengeParticipants.challengeId, challengeId),
            eq(challengeParticipants.userId, userId),
          ),
        )
        .limit(1);
      if (!participant) return res.status(403).json({ error: 'not_participant' });

      // Submissions already reviewed by this user → exclude.
      const reviewed = await db
        .select({ submissionId: challengePeerReviews.submissionId })
        .from(challengePeerReviews)
        .where(eq(challengePeerReviews.reviewerUserId, userId));
      const reviewedIds = reviewed.map((r) => r.submissionId);

      const filters = [
        eq(challengeSubmissions.challengeId, challengeId),
        eq(challengeSubmissions.verificationStatus, 'PENDING_REVIEW'),
        ne(challengeSubmissions.userId, userId),
      ];
      if (reviewedIds.length > 0) {
        // Drizzle: inArray with negation via SQL fragment.
        filters.push(sql`${challengeSubmissions.id} NOT IN (${sql.join(reviewedIds.map((id) => sql`${id}`), sql`, `)})`);
      }

      const rows = await db
        .select({
          id: challengeSubmissions.id,
          userId: challengeSubmissions.userId,
          submitterName: users.name,
          submitterEmail: users.email,
          submissionType: challengeSubmissions.submissionType,
          evidenceUrl: challengeSubmissions.evidenceUrl,
          metricValue: challengeSubmissions.metricValue,
          submittedAt: challengeSubmissions.submittedAt,
          confidenceScore: challengeSubmissions.confidenceScore,
          forDate: challengeSubmissions.forDate,
          metadata: challengeSubmissions.metadata,
        })
        .from(challengeSubmissions)
        .innerJoin(users, eq(users.id, challengeSubmissions.userId))
        .where(and(...filters))
        .orderBy(desc(challengeSubmissions.submittedAt))
        .limit(50);

      // Tally existing approvals/rejections per submission.
      const subIds = rows.map((r) => r.id);
      const tallies = new Map<string, { approvals: number; rejections: number }>();
      if (subIds.length > 0) {
        const reviews = await db
          .select({
            submissionId: challengePeerReviews.submissionId,
            decision: challengePeerReviews.decision,
          })
          .from(challengePeerReviews)
          .where(inArray(challengePeerReviews.submissionId, subIds));
        for (const r of reviews) {
          const t = tallies.get(r.submissionId) ?? { approvals: 0, rejections: 0 };
          if (r.decision === 'APPROVE') t.approvals += 1;
          else if (r.decision === 'REJECT') t.rejections += 1;
          tallies.set(r.submissionId, t);
        }
      }

      const submissions = rows.map((r) => {
        const t = tallies.get(r.id) ?? { approvals: 0, rejections: 0 };
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          submitterId: r.userId,
          submitterName: r.submitterName ?? r.submitterEmail.split('@')[0],
          submitterInitial: (r.submitterName?.trim() || r.submitterEmail).charAt(0).toUpperCase(),
          submissionType: r.submissionType,
          evidenceUrl: r.evidenceUrl,
          metricValue: r.metricValue ? Number(r.metricValue) : null,
          submittedAt: r.submittedAt.toISOString(),
          confidenceScore: r.confidenceScore,
          forDate: r.forDate ? r.forDate.toISOString().slice(0, 10) : null,
          note: typeof meta.note === 'string' ? (meta.note as string) : null,
          approvals: t.approvals,
          rejections: t.rejections,
          required: PEER_RULES.minimumApprovals,
        };
      });

      res.json({
        submissions,
        rules: {
          requiredApprovals: PEER_RULES.minimumApprovals,
          requiredRejections: PEER_RULES.rejectionThreshold,
          windowHours: PEER_RULES.approvalDeadlineHours,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// GET /api/challenges/:id/my-submissions
// Returns the caller's own submissions for this challenge. Useful for the
// submitter to see "1 of 2 approvals so far" while peer review is in flight.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.get(
  '/:id/my-submissions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) return unauthorized(res);
      const userId = req.auth.userId;
      const challengeId = req.params.id;
      if (!challengeId) return badRequest(res, 'missing id');

      const rows = await db
        .select({
          id: challengeSubmissions.id,
          submissionType: challengeSubmissions.submissionType,
          evidenceUrl: challengeSubmissions.evidenceUrl,
          metricValue: challengeSubmissions.metricValue,
          submittedAt: challengeSubmissions.submittedAt,
          verificationStatus: challengeSubmissions.verificationStatus,
          confidenceScore: challengeSubmissions.confidenceScore,
          forDate: challengeSubmissions.forDate,
          metadata: challengeSubmissions.metadata,
        })
        .from(challengeSubmissions)
        .where(
          and(
            eq(challengeSubmissions.challengeId, challengeId),
            eq(challengeSubmissions.userId, userId),
          ),
        )
        .orderBy(desc(challengeSubmissions.submittedAt))
        .limit(50);

      const subIds = rows.map((r) => r.id);
      const tallies = new Map<string, { approvals: number; rejections: number }>();
      if (subIds.length > 0) {
        const reviews = await db
          .select({
            submissionId: challengePeerReviews.submissionId,
            decision: challengePeerReviews.decision,
          })
          .from(challengePeerReviews)
          .where(inArray(challengePeerReviews.submissionId, subIds));
        for (const r of reviews) {
          const t = tallies.get(r.submissionId) ?? { approvals: 0, rejections: 0 };
          if (r.decision === 'APPROVE') t.approvals += 1;
          else if (r.decision === 'REJECT') t.rejections += 1;
          tallies.set(r.submissionId, t);
        }
      }

      const submissions = rows.map((r) => {
        const t = tallies.get(r.id) ?? { approvals: 0, rejections: 0 };
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          submissionType: r.submissionType,
          evidenceUrl: r.evidenceUrl,
          metricValue: r.metricValue ? Number(r.metricValue) : null,
          submittedAt: r.submittedAt.toISOString(),
          verificationStatus: r.verificationStatus,
          confidenceScore: r.confidenceScore,
          forDate: r.forDate ? r.forDate.toISOString().slice(0, 10) : null,
          note: typeof meta.note === 'string' ? (meta.note as string) : null,
          approvals: t.approvals,
          rejections: t.rejections,
          required: PEER_RULES.minimumApprovals,
        };
      });

      res.json({ submissions });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges/:id/submissions
// Submit proof. Computes confidence + classifies AUTO_APPROVED vs PENDING_REVIEW.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/:id/submissions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const userId = req.auth.userId;
    const challengeId = req.params.id;
    if (!challengeId) return badRequest(res, 'missing id');

    const body = (req.body ?? {}) as {
      submissionType?: string;
      evidenceUrl?: string | null;
      metricValue?: number;
      forDate?: string;
      metadata?: Record<string, unknown>;
      exifOk?: boolean;
      geoMatch?: boolean;
    };
    if (!body.submissionType) return badRequest(res, 'submissionType required');

    const [participant] = await db
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, userId)))
      .limit(1);
    if (!participant) return res.status(403).json({ error: 'not_participant' });

    const [rule] = await db
      .select({ verificationLevel: challengeRules.verificationLevel })
      .from(challengeRules)
      .where(eq(challengeRules.challengeId, challengeId))
      .limit(1);
    if (!rule || !rule.verificationLevel) return badRequest(res, 'challenge missing rule');

    const [user] = await db
      .select({ trustScore: users.trustScore })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const confidence = computeConfidence({
      level: rule.verificationLevel,
      exifOk: body.exifOk,
      geoMatch: body.geoMatch,
      onTime: true,
      userTrustScore: user?.trustScore ?? undefined,
    });
    const outcome = classifySubmission(confidence);

    const [submission] = await db
      .insert(challengeSubmissions)
      .values({
        challengeId,
        participantId: participant.id,
        userId,
        submissionType: body.submissionType,
        evidenceUrl: body.evidenceUrl ?? null,
        metricValue: body.metricValue?.toString() ?? null,
        verificationStatus: outcome === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : 'PENDING_REVIEW',
        confidenceScore: confidence,
        forDate: body.forDate ? new Date(body.forDate) : null,
        metadata: (body.metadata ?? null) as never,
      })
      .returning({ id: challengeSubmissions.id, verificationStatus: challengeSubmissions.verificationStatus });

    await logAudit({
      challengeId,
      action: outcome === 'AUTO_APPROVED' ? AUDIT_ACTIONS.SUBMISSION_AUTO_APPROVED : AUDIT_ACTIONS.SUBMISSION_CREATED,
      actorId: userId,
      actorType: 'USER',
      newValue: { submissionId: submission?.id, confidence, outcome },
    });

    res.status(201).json({
      id: submission?.id,
      verificationStatus: submission?.verificationStatus,
      confidence,
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges/:id/peer-reviews
// Peer approves or rejects another participant's submission.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/:id/peer-reviews', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const userId = req.auth.userId;
    const challengeId = req.params.id;
    if (!challengeId) return badRequest(res, 'missing id');

    const body = (req.body ?? {}) as { submissionId?: string; decision?: 'APPROVE' | 'REJECT'; note?: string };
    if (!body.submissionId) return badRequest(res, 'submissionId required');
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
      return badRequest(res, 'decision must be APPROVE or REJECT');
    }

    // Reviewer must be a challenge participant; cannot self-approve.
    const [submission] = await db
      .select({
        id: challengeSubmissions.id,
        userId: challengeSubmissions.userId,
        challengeId: challengeSubmissions.challengeId,
        submittedAt: challengeSubmissions.submittedAt,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.id, body.submissionId))
      .limit(1);
    if (!submission) return notFound(res, 'submission');
    if (submission.challengeId !== challengeId) return badRequest(res, 'submission/challenge mismatch');
    if (submission.userId === userId && !PEER_RULES.selfApprovalAllowed) {
      return res.status(403).json({ error: 'self_approval_not_allowed' });
    }

    const [reviewerParticipant] = await db
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, userId)))
      .limit(1);
    if (!reviewerParticipant) return res.status(403).json({ error: 'not_participant' });

    // Insert review; ignore dupes via unique index.
    try {
      await db.insert(challengePeerReviews).values({
        submissionId: body.submissionId,
        reviewerUserId: userId,
        decision: body.decision,
        note: body.note ?? null,
      });
    } catch (err) {
      return res.status(409).json({ error: 'already_reviewed' });
    }

    // Tally + decide outcome
    const reviews = await db
      .select({ decision: challengePeerReviews.decision })
      .from(challengePeerReviews)
      .where(eq(challengePeerReviews.submissionId, body.submissionId));
    const approvals = reviews.filter((r) => r.decision === 'APPROVE').length;
    const rejections = reviews.filter((r) => r.decision === 'REJECT').length;
    const hoursSinceSubmission =
      (Date.now() - new Date(submission.submittedAt).getTime()) / (3600 * 1000);
    const outcome = resolvePeerOutcome({ approvals, rejections, selfReviewBlocked: false, hoursSinceSubmission });

    // Update submission status if peer decision is final
    let newStatus: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW' | 'EXPIRED' = 'PENDING_REVIEW';
    if (outcome === 'APPROVED') newStatus = 'APPROVED';
    else if (outcome === 'REJECTED') newStatus = 'REJECTED';
    else if (outcome === 'EXPIRED') newStatus = 'EXPIRED';

    if (newStatus !== 'PENDING_REVIEW') {
      await db
        .update(challengeSubmissions)
        .set({ verificationStatus: newStatus })
        .where(eq(challengeSubmissions.id, body.submissionId));
    }

    await logAudit({
      challengeId,
      action: AUDIT_ACTIONS.PEER_REVIEW_CAST,
      actorId: userId,
      actorType: 'USER',
      newValue: { submissionId: body.submissionId, decision: body.decision, outcome, approvals, rejections },
    });

    res.status(201).json({ approvals, rejections, outcome, submissionStatus: newStatus });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/challenges/:id/disputes
// List disputes on a challenge. Drives the "⚠️ N disputes open" banner on
// challenge detail + the per-dispute status badges. Includes the raiser's
// name and timestamps, ordered newest first.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.get(
  '/:id/disputes',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) return unauthorized(res);
      const challengeId = req.params.id;
      if (!challengeId) return badRequest(res, 'missing id');

      const rows = await db
        .select({
          id: challengeDisputes.id,
          status: challengeDisputes.status,
          disputeReason: challengeDisputes.disputeReason,
          description: challengeDisputes.description,
          raisedBy: challengeDisputes.raisedBy,
          raiserName: users.name,
          raiserEmail: users.email,
          submissionId: challengeDisputes.submissionId,
          participantId: challengeDisputes.participantId,
          createdAt: challengeDisputes.createdAt,
        })
        .from(challengeDisputes)
        .innerJoin(users, eq(users.id, challengeDisputes.raisedBy))
        .where(eq(challengeDisputes.challengeId, challengeId))
        .orderBy(desc(challengeDisputes.createdAt))
        .limit(50);

      const me = req.auth.userId;
      const disputes = rows.map((r) => ({
        id: r.id,
        status: r.status,
        disputeReason: r.disputeReason,
        description: r.description,
        raisedBy: r.raisedBy,
        raiserName: r.raiserName ?? r.raiserEmail.split('@')[0],
        raiserInitial: (r.raiserName?.trim() || r.raiserEmail).charAt(0).toUpperCase(),
        submissionId: r.submissionId,
        participantId: r.participantId,
        createdAt: r.createdAt.toISOString(),
        isMine: r.raisedBy === me,
      }));

      const openCount = disputes.filter(
        (d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW',
      ).length;

      res.json({ disputes, openCount });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /api/challenges/:id/disputes
// Raise a dispute. Locks payout until resolved.
// ────────────────────────────────────────────────────────────────────────────

challengesV2Router.post('/:id/disputes', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) return unauthorized(res);
    const userId = req.auth.userId;
    const challengeId = req.params.id;
    if (!challengeId) return badRequest(res, 'missing id');

    const body = (req.body ?? {}) as {
      disputeReason?: string;
      description?: string;
      submissionId?: string;
      participantId?: string;
    };
    if (!body.disputeReason || !isValidReason(body.disputeReason)) {
      return badRequest(res, 'invalid disputeReason');
    }

    const [challenge] = await db
      .select({ id: challenges.id, endAt: challenges.endAt, lifecycle: challenges.lifecycle, disputeWindowHours: challenges.disputeWindowHours })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);
    if (!challenge) return notFound(res, 'challenge');

    const canRaise = canRaiseDispute({
      challengeEndAt: challenge.endAt,
      challengeLifecycle: challenge.lifecycle,
      disputeWindowHours: challenge.disputeWindowHours,
    });
    if (!canRaise.ok) {
      return res.status(409).json({ error: 'cannot_raise_dispute', reason: canRaise.reason });
    }

    const [dispute] = await db
      .insert(challengeDisputes)
      .values({
        challengeId,
        submissionId: body.submissionId ?? null,
        participantId: body.participantId ?? null,
        raisedBy: userId,
        disputeReason: body.disputeReason,
        description: body.description ?? null,
        status: 'OPEN',
      })
      .returning();

    // Bump lifecycle to DISPUTE_OPEN if it was past ENDED
    if (
      challenge.lifecycle === 'ENDED' ||
      challenge.lifecycle === 'CALCULATING' ||
      challenge.lifecycle === 'LOCKED'
    ) {
      await db
        .update(challenges)
        .set({ lifecycle: 'DISPUTE_OPEN', updatedAt: new Date() })
        .where(eq(challenges.id, challengeId));
    }

    await logAudit({
      challengeId,
      action: AUDIT_ACTIONS.DISPUTE_OPENED,
      actorId: userId,
      actorType: 'USER',
      newValue: { disputeId: dispute?.id, reason: body.disputeReason },
    });

    res.status(201).json({ id: dispute?.id, status: dispute?.status });
  } catch (err) {
    next(err);
  }
});
