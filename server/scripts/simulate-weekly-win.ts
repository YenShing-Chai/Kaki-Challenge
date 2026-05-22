import 'dotenv/config';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
  transactions,
} from '../src/db/schema';
import { runDailyResolution } from '../src/jobs/dailyResolution';
import { addDaysUtc } from '../src/lib/date';

(async () => {
  const [user] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!user) {
    console.error('No users in DB. Sign up via the app first.');
    process.exit(1);
  }

  const part = await db.query.challengeParticipants.findFirst({
    where: and(
      eq(challengeParticipants.userId, user.id),
      eq(challengeParticipants.status, 'ACTIVE'),
    ),
    with: {
      challenge: true,
      dailyProgress: { orderBy: [asc(dailyProgress.date)] },
    },
    orderBy: [desc(challengeParticipants.joinedAt)],
  });
  if (!part || part.challenge.gameFormat !== 'WEEKLY_QUOTA') {
    console.error(
      `No ACTIVE WEEKLY_QUOTA participation for ${user.email}. Join one in the Discover tab first.`,
    );
    process.exit(1);
  }

  const c = part.challenge;
  console.log(`Simulating weekly win for participant=${part.id} challenge=${c.title}`);
  console.log(
    `  ${c.weeklyPowerDays}P+${c.weeklyActiveDays}A+${c.weeklyFreeDays}F per week, ${Math.ceil(c.durationDays / 7)} weeks`,
  );

  const power = c.powerStepGoal ?? 14000;
  const active = c.activeStepGoal ?? 10000;
  const weeks = Math.ceil(c.durationDays / 7);

  for (let w = 0; w < weeks; w++) {
    const weekStart = addDaysUtc(c.startDate, w * 7);
    for (let d = 0; d < 7; d++) {
      const date = addDaysUtc(weekStart, d);
      const dayProgress = part.dailyProgress.find((p) => p.date.getTime() === date.getTime());
      if (!dayProgress) continue;

      let stepsAchieved: number;
      let dayType: 'POWER' | 'ACTIVE' | 'MISSED';
      let completed: boolean;

      if (d < (c.weeklyPowerDays ?? 0)) {
        stepsAchieved = power;
        dayType = 'POWER';
        completed = true;
      } else if (d < (c.weeklyPowerDays ?? 0) + (c.weeklyActiveDays ?? 0)) {
        stepsAchieved = active;
        dayType = 'ACTIVE';
        completed = true;
      } else {
        stepsAchieved = 0;
        dayType = 'MISSED';
        completed = false;
      }

      await db
        .update(dailyProgress)
        .set({ stepsAchieved, dayType, completed, syncedAt: new Date() })
        .where(eq(dailyProgress.id, dayProgress.id));
    }
  }
  console.log(`  filled ${part.dailyProgress.length} day(s)`);

  for (let w = 0; w < weeks; w++) {
    const weekEnd = addDaysUtc(c.startDate, (w + 1) * 7 - 1);
    const at = new Date(addDaysUtc(weekEnd, 1).getTime());
    at.setUTCMinutes(1);
    console.log(`  running resolution at ${at.toISOString()} (end of week ${w + 1})`);
    await runDailyResolution(at, { onlyChallengeId: c.id });
  }

  const final = await db.query.challengeParticipants.findFirst({
    where: eq(challengeParticipants.id, part.id),
    with: { challenge: true },
  });
  const [payoutTx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), eq(transactions.type, 'PRIZE_PAYOUT')))
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  console.log('\n=== FINAL STATE ===');
  console.log(`  participant status: ${final?.status}`);
  console.log(`  challenge status: ${final?.challenge.status}`);
  if (payoutTx) {
    console.log(`  prize payout: $${Number(payoutTx.amount).toFixed(2)} (${payoutTx.description})`);
  } else {
    console.log('  no payout transaction found');
  }

  void challenges;
  process.exit(0);
})();
