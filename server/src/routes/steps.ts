import { Router } from 'express';
import { and, eq, gte, lte } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import {
  users,
  stepLogs,
  challengeParticipants,
  challenges,
  dailyProgress,
} from '../db/schema';
import { todayUtc } from '../lib/date';
import { stepsSyncLimiter } from '../middleware/rateLimit';
import { classifyDay, effectiveDailyGoal } from '../lib/gameFormat';

export const stepsRouter = Router();

async function upsertStepLog(userId: string, day: Date, stepsCount: number, manual: boolean) {
  const [existing] = await db
    .select({ id: stepLogs.id })
    .from(stepLogs)
    .where(and(eq(stepLogs.userId, userId), eq(stepLogs.date, day)))
    .limit(1);
  if (existing) {
    await db
      .update(stepLogs)
      .set({ stepsCount, manualEntry: manual, syncedAt: new Date() })
      .where(eq(stepLogs.id, existing.id));
  } else {
    await db
      .insert(stepLogs)
      .values({ userId, date: day, stepsCount, manualEntry: manual });
  }
}

async function upsertDailyProgress(
  participantId: string,
  day: Date,
  stepsCount: number,
  goalSteps: number,
  completed: boolean,
  dayType: 'POWER' | 'ACTIVE' | 'FREE' | 'MISSED' | null,
) {
  const [existing] = await db
    .select({ id: dailyProgress.id })
    .from(dailyProgress)
    .where(and(eq(dailyProgress.participantId, participantId), eq(dailyProgress.date, day)))
    .limit(1);
  if (existing) {
    await db
      .update(dailyProgress)
      .set({ stepsAchieved: stepsCount, completed, dayType, syncedAt: new Date() })
      .where(eq(dailyProgress.id, existing.id));
  } else {
    await db.insert(dailyProgress).values({
      participantId,
      date: day,
      stepsAchieved: stepsCount,
      goalSteps,
      completed,
      dayType,
    });
  }
}

async function findActiveParts(userId: string, day: Date) {
  const rows = await db
    .select({ part: challengeParticipants, challenge: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challengeParticipants.challengeId, challenges.id))
    .where(
      and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.status, 'ACTIVE'),
        lte(challenges.startDate, day),
        gte(challenges.endDate, day),
      ),
    );
  return rows;
}

stepsRouter.post('/manual', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { stepsCount, date } = req.body as { stepsCount?: number; date?: string };
    if (typeof stepsCount !== 'number' || stepsCount < 0) {
      res.status(400).json({ error: 'bad_request', message: 'stepsCount required' });
      return;
    }
    const day = date ? new Date(`${date}T00:00:00.000Z`) : todayUtc();
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    await upsertStepLog(me.id, day, stepsCount, true);
    const rows = await findActiveParts(me.id, day);
    for (const { part, challenge } of rows) {
      const goalSteps = effectiveDailyGoal(challenge);
      const completed = stepsCount >= goalSteps;
      const dayType = classifyDay(challenge, stepsCount);
      await upsertDailyProgress(part.id, day, stepsCount, goalSteps, completed, dayType);
    }
    res.json({ ok: true, stepsCount, manualEntry: true });
  } catch (err) {
    next(err);
  }
});

stepsRouter.post('/sync', requireAuth, stepsSyncLimiter, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { stepsCount, date } = req.body as { stepsCount?: number; date?: string };
    if (typeof stepsCount !== 'number' || stepsCount < 0) {
      res.status(400).json({ error: 'bad_request', message: 'stepsCount required' });
      return;
    }
    const day = date ? new Date(`${date}T00:00:00.000Z`) : todayUtc();

    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }

    await upsertStepLog(me.id, day, stepsCount, false);

    const rows = await findActiveParts(me.id, day);
    const activeParticipations: Array<{
      challengeId: string;
      stepsNeeded: number;
      completed: boolean;
    }> = [];

    for (const { part, challenge } of rows) {
      const goalSteps = effectiveDailyGoal(challenge);
      const completed = stepsCount >= goalSteps;
      const dayType = classifyDay(challenge, stepsCount);
      await upsertDailyProgress(part.id, day, stepsCount, goalSteps, completed, dayType);
      activeParticipations.push({
        challengeId: part.challengeId,
        stepsNeeded: Math.max(0, goalSteps - stepsCount),
        completed,
      });
    }

    res.json({ stepsCount, activeParticipations });
  } catch (err) {
    next(err);
  }
});
