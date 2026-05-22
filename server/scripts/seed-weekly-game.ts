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
      title: '6-Week Active Game',
      description:
        'Hit 4 Active days (10k+) and 2 Power days (14k+) every week for 6 weeks. 1 free day per week. Miss the quota → out.',
      commitmentFee: 40,
      activeStepGoal: 10000,
      powerStepGoal: 14000,
      durationDays: 42,
      weeklyActiveDays: 4,
      weeklyPowerDays: 2,
      weeklyFreeDays: 1,
      startInDays: 1,
    },
    {
      title: '4-Week Starter Game',
      description: 'Lighter weekly mix — 3 Active (8k+) and 1 Power (12k+). 3 free days. 4 weeks.',
      commitmentFee: 20,
      activeStepGoal: 8000,
      powerStepGoal: 12000,
      durationDays: 28,
      weeklyActiveDays: 3,
      weeklyPowerDays: 1,
      weeklyFreeDays: 3,
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
        dailyStepGoal: v.activeStepGoal,
        durationDays: v.durationDays,
        startDate: start,
        endDate: end,
        gameFormat: 'WEEKLY_QUOTA',
        activeStepGoal: v.activeStepGoal,
        powerStepGoal: v.powerStepGoal,
        weeklyActiveDays: v.weeklyActiveDays,
        weeklyPowerDays: v.weeklyPowerDays,
        weeklyFreeDays: v.weeklyFreeDays,
        category: 'FITNESS',
      })
      .returning({ id: challenges.id });
    console.log(
      `Seeded weekly: ${v.title} — id=${challenge!.id} fee=$${v.commitmentFee} ${v.activeStepGoal}/${v.powerStepGoal} steps · ${v.weeklyPowerDays}P+${v.weeklyActiveDays}A+${v.weeklyFreeDays}F × ${Math.ceil(v.durationDays / 7)}wk, start=${start.toISOString().slice(0, 10)}`,
    );
  }

  process.exit(0);
})();
