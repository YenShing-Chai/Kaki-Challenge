import 'dotenv/config';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import {
  users,
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
  if (!part) {
    console.error(
      `No ACTIVE participation for ${user.email}. Join a challenge in the Discover tab first.`,
    );
    process.exit(1);
  }

  console.log(`Simulating win for participant=${part.id} challenge=${part.challenge.title}`);
  console.log(
    `  start=${part.challenge.startDate.toISOString().slice(0, 10)} end=${part.challenge.endDate.toISOString().slice(0, 10)} stake=$${Number(part.commitmentPaid).toFixed(2)}`,
  );

  for (const day of part.dailyProgress) {
    await db
      .update(dailyProgress)
      .set({ stepsAchieved: day.goalSteps, completed: true, syncedAt: new Date() })
      .where(eq(dailyProgress.id, day.id));
  }
  console.log(`  marked ${part.dailyProgress.length} day(s) completed`);

  const firstRun = addDaysUtc(part.challenge.startDate, 1);
  const lastRun = addDaysUtc(part.challenge.endDate, 1);
  for (let d = firstRun; d.getTime() <= lastRun.getTime(); d = addDaysUtc(d, 1)) {
    const at = new Date(d.getTime());
    at.setUTCMinutes(1);
    console.log(`  running resolution at ${at.toISOString()}`);
    await runDailyResolution(at, { onlyChallengeId: part.challenge.id });
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
    console.log(
      `  prize payout: $${Number(payoutTx.amount).toFixed(2)} (${payoutTx.description})`,
    );
  } else {
    console.log('  no payout transaction found');
  }

  process.exit(0);
})();
