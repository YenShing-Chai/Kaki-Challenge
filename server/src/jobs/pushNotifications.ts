import cron from 'node-cron';
import { and, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';

import { db } from '../lib/db';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
} from '../db/schema';
import { sendPushNotification, sendPushToMany } from '../lib/notifications';
import { localHHMM, todayInTimezone } from '../lib/timezone';

type Slot = 'morning' | 'danger' | 'panic';

async function tick(now: Date = new Date()): Promise<void> {
  const list = await db
    .select({ id: users.id, timezone: users.timezone, expoPushToken: users.expoPushToken })
    .from(users)
    .where(isNotNull(users.expoPushToken));

  for (const u of list) {
    const { hour, minute } = localHHMM(u.timezone, now);
    if (minute !== 0) continue;
    if (hour === 8) await fireSlot(u.id, u.expoPushToken!, u.timezone, 'morning');
    else if (hour === 21) await fireSlot(u.id, u.expoPushToken!, u.timezone, 'danger');
    else if (hour === 23) await fireSlot(u.id, u.expoPushToken!, u.timezone, 'panic');
  }
}

async function fireSlot(userId: string, token: string, timezone: string, slot: Slot): Promise<void> {
  const today = todayInTimezone(timezone);
  const parts = await db
    .select({ part: challengeParticipants, challenge: challenges })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challengeParticipants.challengeId, challenges.id))
    .where(
      and(
        eq(challengeParticipants.userId, userId),
        eq(challengeParticipants.status, 'ACTIVE'),
        lte(challenges.startDate, today),
        gte(challenges.endDate, today),
        inArray(challenges.status, ['OPEN', 'ACTIVE']),
      ),
    );

  for (const { part, challenge } of parts) {
    const [progress] = await db
      .select()
      .from(dailyProgress)
      .where(and(eq(dailyProgress.participantId, part.id), eq(dailyProgress.date, today)))
      .limit(1);
    const completed = progress?.completed ?? false;
    const stepsNeeded = Math.max(
      0,
      challenge.dailyStepGoal - (progress?.stepsAchieved ?? 0),
    );
    const stake = Number(part.commitmentPaid).toFixed(0);

    if (slot === 'morning') {
      const dayIndex =
        Math.floor((today.getTime() - challenge.startDate.getTime()) / 86400000) + 1;
      await sendPushNotification(
        token,
        `Day ${dayIndex} of ${challenge.durationDays} starts now 🏃`,
        `You need ${challenge.dailyStepGoal.toLocaleString()} steps today. $${stake} is on the line.`,
      );
    } else if (slot === 'danger' && !completed) {
      await sendPushNotification(
        token,
        `⚠️ You still need ${stepsNeeded.toLocaleString()} steps`,
        `3 hours left. $${stake} is on the line. Don't lose it.`,
      );
    } else if (slot === 'panic' && !completed) {
      await sendPushNotification(
        token,
        `🚨 1 hour left — ${stepsNeeded.toLocaleString()} steps to go`,
        `Your $${stake} is about to be gone. Move.`,
      );
    }
  }
}

export async function fireSlotForAllNow(slot: Slot): Promise<number> {
  const list = await db
    .select({ id: users.id, timezone: users.timezone, expoPushToken: users.expoPushToken })
    .from(users)
    .where(isNotNull(users.expoPushToken));
  let count = 0;
  for (const u of list) {
    await fireSlot(u.id, u.expoPushToken!, u.timezone, slot);
    count++;
  }
  return count;
}

export async function notifyOnJoin(challengeId: string, joinerUserId: string): Promise<void> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);
  if (!challenge) return;

  const cohort = await db
    .select({ part: challengeParticipants, user: users })
    .from(challengeParticipants)
    .innerJoin(users, eq(challengeParticipants.userId, users.id))
    .where(
      and(
        eq(challengeParticipants.challengeId, challengeId),
        ne(challengeParticipants.userId, joinerUserId),
        eq(challengeParticipants.status, 'ACTIVE'),
      ),
    );

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const eligible = cohort.filter(
    (m) => m.user.expoPushToken && (!m.user.lastJoinNotifyAt || m.user.lastJoinNotifyAt < cutoff),
  );
  if (eligible.length === 0) return;

  const tokens = eligible
    .map((m) => m.user.expoPushToken)
    .filter((t): t is string => Boolean(t));
  const memberCountRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challengeId, challengeId));
  const memberCount = memberCountRows[0]?.c ?? 0;
  await sendPushToMany(
    tokens,
    `Someone just joined ${challenge.title}`,
    `Prize pool is now $${Number(challenge.prizePool).toFixed(2)}. ${memberCount} people are in.`,
  );
  await db
    .update(users)
    .set({ lastJoinNotifyAt: new Date() })
    .where(inArray(users.id, eligible.map((m) => m.user.id)));
}

export function startPushCron(): void {
  cron.schedule('* * * * *', () => {
    tick().catch((err) => {
      console.error('[CRON-PUSH] tick error', err);
    });
  });
  console.log('[kaki] push notification cron started');
}
