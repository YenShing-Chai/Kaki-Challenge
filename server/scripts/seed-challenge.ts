import 'dotenv/config';
import { asc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { users, challenges } from '../src/db/schema';
import { addDaysUtc, todayUtc } from '../src/lib/date';

(async () => {
  const [admin] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!admin) {
    console.error('No users in DB — sign up first via the app.');
    process.exit(1);
  }

  const today = todayUtc();

  const variants = [
    {
      title: 'Quick Cash',
      description: 'A short, sharp 3-day sprint. Low commitment, fast turnaround.',
      commitmentFee: 10,
      dailyStepGoal: 5000,
      durationDays: 3,
      startInDays: 1,
    },
    {
      title: 'Big Pot',
      description: 'For the serious walker. 5 days, 12k a day. The pool gets fat.',
      commitmentFee: 50,
      dailyStepGoal: 12000,
      durationDays: 5,
      startInDays: 2,
    },
    {
      title: 'Streak Starter',
      description: 'Build a habit. 7 days, 8k steps. Mid-stakes commitment.',
      commitmentFee: 20,
      dailyStepGoal: 8000,
      durationDays: 7,
      startInDays: 1,
    },
  ];

  for (const v of variants) {
    const start = addDaysUtc(today, v.startInDays);
    const end = addDaysUtc(start, v.durationDays - 1);

    const [existing] = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(eq(challenges.title, v.title))
      .limit(1);
    if (existing) {
      console.log(`Skipped (already exists): ${v.title} — id=${existing.id}`);
      continue;
    }

    const [challenge] = await db
      .insert(challenges)
      .values({
        title: v.title,
        description: v.description,
        createdById: admin.id,
        commitmentFee: String(v.commitmentFee),
        dailyStepGoal: v.dailyStepGoal,
        durationDays: v.durationDays,
        startDate: start,
        endDate: end,
        category: 'FITNESS',
      })
      .returning({ id: challenges.id });
    console.log(
      `Seeded: ${v.title} — id=${challenge!.id} fee=$${v.commitmentFee} ${v.dailyStepGoal} steps × ${v.durationDays}d, start=${start.toISOString().slice(0, 10)}`,
    );
  }

  process.exit(0);
})();
