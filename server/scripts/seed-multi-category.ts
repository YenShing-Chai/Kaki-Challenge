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
      title: "Reader's Club",
      description:
        '30 days, read for 30 minutes daily. Snap a photo of the page. Complete 25 of 30 days to qualify.',
      commitmentFee: 25,
      durationDays: 30,
      targetDaysComplete: 25,
      category: 'READING' as const,
      verificationMethod: 'PHOTO_PROOF' as const,
      gameFormat: 'COMPLETION_COUNT' as const,
      startInDays: 1,
    },
    {
      title: 'Morning Meditate',
      description: '21 days of meditation. Just tap done. Complete 18 of 21 days to qualify.',
      commitmentFee: 15,
      durationDays: 21,
      targetDaysComplete: 18,
      category: 'MINDFULNESS' as const,
      verificationMethod: 'HONOR_TAP' as const,
      gameFormat: 'COMPLETION_COUNT' as const,
      startInDays: 1,
    },
    {
      title: 'No-Spend Month',
      description: '30 days, no discretionary purchases. Honor system. Complete 28 of 30 days.',
      commitmentFee: 50,
      durationDays: 30,
      targetDaysComplete: 28,
      category: 'MONEY' as const,
      verificationMethod: 'HONOR_TAP' as const,
      gameFormat: 'COMPLETION_COUNT' as const,
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
        dailyStepGoal: 0,
        durationDays: v.durationDays,
        startDate: start,
        endDate: end,
        category: v.category,
        verificationMethod: v.verificationMethod,
        gameFormat: v.gameFormat,
        targetDaysComplete: v.targetDaysComplete,
      })
      .returning({ id: challenges.id });
    console.log(
      `Seeded: ${v.title} [${v.category} · ${v.verificationMethod} · ${v.gameFormat}] target=${v.targetDaysComplete}/${v.durationDays} id=${challenge!.id}`,
    );
  }

  process.exit(0);
})();
