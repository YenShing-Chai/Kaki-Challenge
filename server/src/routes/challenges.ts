import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { requireAuth, optionalAuth } from '../middleware/requireAuth';
import { verifyJwt } from '../lib/jwt';
import { requireCreatorOrAdmin } from '../middleware/requireCreatorOrAdmin';
import { fetchCheerInfo } from './cheers';
import { db } from '../lib/db';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
  transactions,
} from '../db/schema';
import { stripe } from '../lib/stripe';
import { addDaysUtc, challengeDays, todayUtc } from '../lib/date';
import { notifyOnJoin } from '../jobs/pushNotifications';
import { joinChallengeLimiter } from '../middleware/rateLimit';
import { effectiveDailyGoal } from '../lib/gameFormat';
import { isValidCategory } from '../lib/categories';

export const challengesRouter = Router();

challengesRouter.post('/create', requireCreatorOrAdmin, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const {
      title,
      description,
      commitmentFee,
      dailyStepGoal,
      durationDays,
      startDate,
      maxParticipants,
      heroImageUrl,
      gameFormat,
      activeStepGoal,
      powerStepGoal,
      weeklyActiveDays,
      weeklyPowerDays,
      weeklyFreeDays,
      category,
      verificationMethod,
      targetDaysComplete,
    } = req.body as {
      title?: string;
      description?: string | null;
      commitmentFee?: number;
      dailyStepGoal?: number;
      durationDays?: number;
      startDate?: string;
      maxParticipants?: number | null;
      heroImageUrl?: string | null;
      gameFormat?: 'DAILY_STREAK' | 'WEEKLY_QUOTA' | 'COMPLETION_COUNT';
      activeStepGoal?: number;
      powerStepGoal?: number;
      weeklyActiveDays?: number;
      weeklyPowerDays?: number;
      weeklyFreeDays?: number;
      category?:
        | 'FITNESS'
        | 'MINDFULNESS'
        | 'READING'
        | 'LEARNING'
        | 'PRODUCTIVITY'
        | 'CREATIVE'
        | 'WELLNESS'
        | 'MONEY'
        | 'SOCIAL'
        | 'OUTDOORS';
      verificationMethod?: 'AUTO_STEPS' | 'PHOTO_PROOF' | 'HONOR_TAP';
      targetDaysComplete?: number;
    };

    if (
      !title ||
      typeof commitmentFee !== 'number' ||
      typeof durationDays !== 'number' ||
      !startDate
    ) {
      res.status(400).json({
        error: 'bad_request',
        message: 'title, commitmentFee, durationDays, startDate required',
      });
      return;
    }
    if (category !== undefined && category !== null && !isValidCategory(category)) {
      res.status(400).json({ error: 'invalid_category' });
      return;
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = addDaysUtc(start, durationDays - 1);

    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(400).json({ error: 'no_admin_user', message: 'Admin user not synced yet.' });
      return;
    }

    const [challenge] = await db
      .insert(challenges)
      .values({
        title,
        description: description ?? null,
        createdById: me.id,
        commitmentFee: String(commitmentFee),
        dailyStepGoal: dailyStepGoal ?? 10000,
        durationDays,
        startDate: start,
        endDate: end,
        maxParticipants: maxParticipants ?? null,
        heroImageUrl: heroImageUrl ?? null,
        gameFormat: gameFormat ?? 'DAILY_STREAK',
        activeStepGoal: activeStepGoal ?? null,
        powerStepGoal: powerStepGoal ?? null,
        weeklyActiveDays: weeklyActiveDays ?? 4,
        weeklyPowerDays: weeklyPowerDays ?? 2,
        weeklyFreeDays: weeklyFreeDays ?? 1,
        category: category ?? null,
        verificationMethod: verificationMethod ?? 'AUTO_STEPS',
        targetDaysComplete: targetDaysComplete ?? null,
      })
      .returning({ id: challenges.id });

    res.json({ challengeId: challenge!.id });
  } catch (err) {
    next(err);
  }
});

// Public list of joinable / active challenges.
challengesRouter.get('/', async (_req, res, next) => {
  try {
    const list = await db.query.challenges.findMany({
      where: inArray(challenges.status, ['OPEN', 'ACTIVE']),
      orderBy: [asc(challenges.startDate)],
      with: { participants: { columns: { id: true } } },
    });
    res.json({
      challenges: list.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        isPublic: c.isPublic,
        commitmentFee: Number(c.commitmentFee),
        dailyStepGoal: c.dailyStepGoal,
        durationDays: c.durationDays,
        startDate: c.startDate.toISOString().slice(0, 10),
        endDate: c.endDate.toISOString().slice(0, 10),
        status: c.status,
        prizePool: Number(c.prizePool),
        maxParticipants: c.maxParticipants,
        participantCount: c.participants.length,
        heroImageUrl: c.heroImageUrl,
        gameFormat: c.gameFormat,
        activeStepGoal: c.activeStepGoal,
        powerStepGoal: c.powerStepGoal,
        weeklyActiveDays: c.weeklyActiveDays,
        weeklyPowerDays: c.weeklyPowerDays,
        weeklyFreeDays: c.weeklyFreeDays,
        category: c.category,
        verificationMethod: c.verificationMethod,
        targetDaysComplete: c.targetDaysComplete,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Public detail. If the request includes a valid Clerk token, also include
// `userParticipation`.
challengesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.id, id),
      with: {
        participants: {
          with: {
            user: { columns: { id: true, name: true, avatarUrl: true } },
          },
        },
        winnerPool: true,
        createdBy: { columns: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!challenge) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const qualifiedCount = challenge.participants.filter(
      (p) => p.status === 'ACTIVE' || p.status === 'QUALIFIED',
    ).length;

    let userParticipation:
      | {
          id: string;
          status: string;
          dailyProgress: Array<{
            date: string;
            stepsAchieved: number;
            goalSteps: number;
            completed: boolean;
            dayType: string | null;
          }>;
        }
      | null = null;

    const header = req.header('authorization') ?? req.header('Authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (bearer) {
      try {
        const payload = verifyJwt(bearer);
        if (!payload) throw new Error('invalid token');
        const [me] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, payload.sub))
          .limit(1);
        if (me) {
          const myPart = challenge.participants.find((p) => p.userId === me.id);
          if (myPart) {
            const progress = await db
              .select()
              .from(dailyProgress)
              .where(eq(dailyProgress.participantId, myPart.id))
              .orderBy(asc(dailyProgress.date));
            userParticipation = {
              id: myPart.id,
              status: myPart.status,
              dailyProgress: progress.map((p) => ({
                date: p.date.toISOString().slice(0, 10),
                stepsAchieved: p.stepsAchieved,
                goalSteps: p.goalSteps,
                completed: p.completed,
                dayType: p.dayType,
              })),
            };
          }
        }
      } catch {
        // ignore — anonymous read
      }
    }

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        isPublic: challenge.isPublic,
        commitmentFee: Number(challenge.commitmentFee),
        dailyStepGoal: challenge.dailyStepGoal,
        durationDays: challenge.durationDays,
        startDate: challenge.startDate.toISOString().slice(0, 10),
        endDate: challenge.endDate.toISOString().slice(0, 10),
        status: challenge.status,
        prizePool: Number(challenge.prizePool),
        maxParticipants: challenge.maxParticipants,
        minParticipants: challenge.minParticipants,
        participantCount: challenge.participants.length,
        qualifiedCount,
        heroImageUrl: challenge.heroImageUrl,
        gameFormat: challenge.gameFormat,
        activeStepGoal: challenge.activeStepGoal,
        powerStepGoal: challenge.powerStepGoal,
        weeklyActiveDays: challenge.weeklyActiveDays,
        weeklyPowerDays: challenge.weeklyPowerDays,
        weeklyFreeDays: challenge.weeklyFreeDays,
        category: challenge.category,
        verificationMethod: challenge.verificationMethod,
        targetDaysComplete: challenge.targetDaysComplete,
        // ── New PRD v2 fields ─────────────────────────────────────────
        creatorIntent: challenge.creatorIntent,
        categoryV2: challenge.categoryV2,
        visibility: challenge.visibility,
        lifecycle: challenge.lifecycle,
        rewardType: challenge.rewardType,
        riskLevel: challenge.riskLevel,
        moderationStatus: challenge.moderationStatus,
        startAt: challenge.startAt?.toISOString() ?? null,
        endAt: challenge.endAt?.toISOString() ?? null,
        createdByName: challenge.createdBy?.name ?? null,
        createdByAvatar: challenge.createdBy?.avatarUrl ?? null,
        winnerPool: challenge.winnerPool
          ? {
              entryContributionAmount: Number(challenge.winnerPool.entryContributionAmount),
              currency: challenge.winnerPool.currency,
              distributionMethod: challenge.winnerPool.distributionMethod,
              participantMinimum: challenge.winnerPool.participantMinimum,
              participantMaximum: challenge.winnerPool.participantMaximum,
              totalPoolAmount: Number(challenge.winnerPool.totalPoolAmount),
              netPoolAmount: Number(challenge.winnerPool.netPoolAmount),
              payoutStatus: challenge.winnerPool.payoutStatus,
              manualApprovalRequired: challenge.winnerPool.manualApprovalRequired,
            }
          : null,
        participants: challenge.participants.slice(0, 4).map((p) => ({
          userId: p.userId,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
          status: p.status,
        })),
        userParticipation,
      },
    });
  } catch (err) {
    next(err);
  }
});

challengesRouter.post('/:id/join', requireAuth, joinChallengeLimiter, async (req, res, next) => {
  try {
    if (!req.auth || !stripe) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }

    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.id, id),
      with: { participants: { columns: { id: true } } },
    });
    if (!challenge) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (challenge.status !== 'OPEN') {
      res.status(400).json({ error: 'challenge_closed', message: 'Challenge no longer accepting joiners' });
      return;
    }
    if (challenge.maxParticipants && challenge.participants.length >= challenge.maxParticipants) {
      res.status(400).json({ error: 'challenge_full' });
      return;
    }

    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    if (!me.stripeCustomerId || !me.stripePaymentMethodId) {
      res.status(402).json({
        error: 'No payment method saved',
        code: 'NO_PAYMENT_METHOD',
      });
      return;
    }

    const [already] = await db
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(
        and(eq(challengeParticipants.challengeId, id), eq(challengeParticipants.userId, me.id)),
      )
      .limit(1);
    if (already) {
      res.json({ participantId: already.id, prizePool: Number(challenge.prizePool) });
      return;
    }

    const commitmentCents = Math.round(Number(challenge.commitmentFee) * 100);
    const intent = await stripe.paymentIntents.create({
      amount: commitmentCents,
      currency: 'usd',
      customer: me.stripeCustomerId,
      payment_method: me.stripePaymentMethodId,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: { userId: me.id, challengeId: id },
    });

    const days = challengeDays(challenge.startDate, challenge.durationDays);

    const result = await db.transaction(async (tx) => {
      const [participant] = await tx
        .insert(challengeParticipants)
        .values({
          challengeId: id,
          userId: me.id,
          commitmentPaid: String(challenge.commitmentFee),
          stripePaymentIntentId: intent.id,
        })
        .returning();

      await tx.insert(dailyProgress).values(
        days.map((date) => ({
          participantId: participant!.id,
          date,
          goalSteps: effectiveDailyGoal(challenge),
        })),
      );
      await tx
        .update(challenges)
        .set({ prizePool: sql`${challenges.prizePool} + ${challenge.commitmentFee}` })
        .where(eq(challenges.id, id));
      await tx.insert(transactions).values({
        userId: me.id,
        type: 'COMMITMENT_HOLD',
        amount: String(challenge.commitmentFee),
        stripePaymentIntentId: intent.id,
        description: `Joined ${challenge.title}`,
      });
      return participant;
    });

    const [updated] = await db
      .select({ prizePool: challenges.prizePool })
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);

    void notifyOnJoin(id, me.id).catch((err) => {
      console.warn('[push] join notify failed', err);
    });

    res.json({
      participantId: result!.id,
      prizePool: updated ? Number(updated.prizePool) : 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Mark a day as completed for HONOR_TAP and PHOTO_PROOF challenges.
 */
challengesRouter.post('/:id/tap-done', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const { date, photoUrl } = req.body as { date?: string; photoUrl?: string };

    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (challenge.verificationMethod === 'AUTO_STEPS') {
      res.status(400).json({
        error: 'wrong_verification',
        message: 'Use /steps/sync for AUTO_STEPS challenges.',
      });
      return;
    }
    if (challenge.verificationMethod === 'PHOTO_PROOF' && !photoUrl) {
      res.status(400).json({
        error: 'photo_required',
        message: 'photoUrl is required for PHOTO_PROOF challenges.',
      });
      return;
    }
    const [part] = await db
      .select()
      .from(challengeParticipants)
      .where(
        and(eq(challengeParticipants.challengeId, id), eq(challengeParticipants.userId, me.id)),
      )
      .limit(1);
    if (!part || part.status !== 'ACTIVE') {
      res.status(400).json({ error: 'not_active_participant' });
      return;
    }
    const day = date ? new Date(`${date}T00:00:00.000Z`) : todayUtc();
    if (day < challenge.startDate || day > challenge.endDate) {
      res.status(400).json({ error: 'date_out_of_range' });
      return;
    }
    const [existing] = await db
      .select({ id: dailyProgress.id })
      .from(dailyProgress)
      .where(
        and(eq(dailyProgress.participantId, part.id), eq(dailyProgress.date, day)),
      )
      .limit(1);

    if (existing) {
      await db
        .update(dailyProgress)
        .set({
          completed: true,
          proofPhotoUrl: photoUrl ?? null,
          proofSubmittedAt: new Date(),
          syncedAt: new Date(),
        })
        .where(eq(dailyProgress.id, existing.id));
    } else {
      await db.insert(dailyProgress).values({
        participantId: part.id,
        date: day,
        stepsAchieved: 0,
        goalSteps: 0,
        completed: true,
        proofPhotoUrl: photoUrl ?? null,
        proofSubmittedAt: new Date(),
      });
    }
    res.json({ ok: true, progress: { date: day.toISOString().slice(0, 10), completed: true } });
  } catch (err) {
    next(err);
  }
});

// Public leaderboard.
challengesRouter.get('/:id/participants', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const today = todayUtc();
    const parts = await db.query.challengeParticipants.findMany({
      where: eq(challengeParticipants.challengeId, id),
      with: {
        user: { columns: { id: true, name: true, email: true, avatarUrl: true } },
        dailyProgress: true,
      },
    });

    type Row = {
      userId: string;
      name: string;
      avatarInitial: string;
      status: string;
      todaySteps: number;
      todayGoal: number;
      todayCompleted: boolean;
      daysCompleted: number;
      daysTotal: number;
      commitmentPaid: number;
      todayProgressId: string | null;
      todayCheerCount: number;
      todayCheerByViewer: boolean;
    };

    // Resolve viewer for cheer state.
    let viewerId: string | null = null;
    if (req.auth) {
      const [me] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, req.auth.userId))
        .limit(1);
      viewerId = me?.id ?? null;
    }

    // Collect today's dailyProgress ids and fetch cheers in batch.
    const todayProgressIds: string[] = [];
    for (const p of parts) {
      const t = p.dailyProgress.find((d) => d.date.getTime() === today.getTime());
      if (t && t.completed) todayProgressIds.push(t.id);
    }
    const cheerInfo = await fetchCheerInfo(todayProgressIds, viewerId);

    const rows: Row[] = parts.map((p) => {
      const todayProgress = p.dailyProgress.find((d) => d.date.getTime() === today.getTime());
      const daysCompleted = p.dailyProgress.filter((d) => d.completed).length;
      const display = p.user.name?.trim() || p.user.email.split('@')[0] || 'User';
      const tpid = todayProgress?.id ?? null;
      return {
        userId: p.userId,
        name: display,
        avatarInitial: display.charAt(0).toUpperCase(),
        status: p.status,
        todaySteps: todayProgress?.stepsAchieved ?? 0,
        todayGoal: todayProgress?.goalSteps ?? challenge.dailyStepGoal,
        todayCompleted: todayProgress?.completed ?? false,
        daysCompleted,
        daysTotal: challenge.durationDays,
        commitmentPaid: Number(p.commitmentPaid),
        todayProgressId: tpid,
        todayCheerCount: tpid ? cheerInfo.count.get(tpid) ?? 0 : 0,
        todayCheerByViewer: tpid ? cheerInfo.viewer.has(tpid) : false,
      };
    });

    const statusRank = (s: string) => (s === 'ACTIVE' ? 0 : s === 'QUALIFIED' ? 1 : 2);
    rows.sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;
      return b.todaySteps - a.todaySteps;
    });

    res.json({ rows });
  } catch (err) {
    next(err);
  }
});

// Convenience: caller's active participations.
challengesRouter.get('/me/active', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.json({ participations: [] });
      return;
    }
    const parts = await db.query.challengeParticipants.findMany({
      where: and(
        eq(challengeParticipants.userId, me.id),
        eq(challengeParticipants.status, 'ACTIVE'),
      ),
      with: {
        challenge: true,
        dailyProgress: { orderBy: [asc(dailyProgress.date)] },
      },
    });
    const today = todayUtc();
    res.json({
      participations: parts.map((p) => ({
        id: p.id,
        status: p.status,
        challenge: {
          id: p.challenge.id,
          title: p.challenge.title,
          dailyStepGoal: p.challenge.dailyStepGoal,
          durationDays: p.challenge.durationDays,
          startDate: p.challenge.startDate.toISOString().slice(0, 10),
          endDate: p.challenge.endDate.toISOString().slice(0, 10),
          prizePool: Number(p.challenge.prizePool),
          commitmentFee: Number(p.challenge.commitmentFee),
          status: p.challenge.status,
          gameFormat: p.challenge.gameFormat,
          activeStepGoal: p.challenge.activeStepGoal,
          powerStepGoal: p.challenge.powerStepGoal,
          weeklyActiveDays: p.challenge.weeklyActiveDays,
          weeklyPowerDays: p.challenge.weeklyPowerDays,
          weeklyFreeDays: p.challenge.weeklyFreeDays,
          category: p.challenge.category,
          verificationMethod: p.challenge.verificationMethod,
          targetDaysComplete: p.challenge.targetDaysComplete,
        },
        todayProgress: p.dailyProgress.find((d) => d.date.getTime() === today.getTime()) ?? null,
        dailyProgress: p.dailyProgress.map((d) => ({
          date: d.date.toISOString().slice(0, 10),
          stepsAchieved: d.stepsAchieved,
          goalSteps: d.goalSteps,
          completed: d.completed,
          dayType: d.dayType,
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

void desc; // Reserved for future date-sort use.
