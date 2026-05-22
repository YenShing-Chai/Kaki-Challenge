import { eq, desc } from 'drizzle-orm';

import { db } from './db';
import { users, dailyProgress, challengeParticipants } from '../db/schema';
import { addDaysUtc, todayUtc } from './date';

/**
 * A "streak day" is a calendar day where the user had at least one ACTIVE-window
 * challenge participation AND completed it that day. Walk back from yesterday;
 * stop at the first non-streak day.
 *
 * Returns the updated currentStreak and longestStreak (also persisted on User).
 */
export async function recalculateStreak(
  userId: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  const rows = await db
    .select({
      date: dailyProgress.date,
      completed: dailyProgress.completed,
    })
    .from(dailyProgress)
    .innerJoin(
      challengeParticipants,
      eq(dailyProgress.participantId, challengeParticipants.id),
    )
    .where(eq(challengeParticipants.userId, userId))
    .orderBy(desc(dailyProgress.date));

  // Map date → was-completed (any participation that day succeeding counts).
  const byDate = new Map<string, boolean>();
  for (const d of rows) {
    const key = d.date.toISOString().slice(0, 10);
    byDate.set(key, byDate.get(key) || d.completed);
  }

  let currentStreak = 0;
  let cursor = addDaysUtc(todayUtc(), -1);
  // Bound the walk to a year so a corrupted DB never loops forever.
  for (let i = 0; i < 366; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (byDate.get(key) === true) {
      currentStreak++;
      cursor = addDaysUtc(cursor, -1);
    } else {
      break;
    }
  }

  const [user] = await db
    .select({ longestStreak: users.longestStreak })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const longestStreak = Math.max(user?.longestStreak ?? 0, currentStreak);

  await db
    .update(users)
    .set({ currentStreak, longestStreak })
    .where(eq(users.id, userId));

  return { currentStreak, longestStreak };
}
