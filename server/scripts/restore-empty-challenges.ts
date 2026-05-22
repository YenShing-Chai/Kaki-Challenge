import 'dotenv/config';
import { eq, notExists } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { challenges, challengeParticipants } from '../src/db/schema';
import { addDaysUtc, todayUtc } from '../src/lib/date';

(async () => {
  const orphans = await db
    .select()
    .from(challenges)
    .where(
      eq(challenges.status, 'COMPLETED'),
    );
  const orphansWithoutParts: typeof orphans = [];
  for (const c of orphans) {
    const [{ exists }] = await db
      .select({ exists: notExists(
        db.select().from(challengeParticipants).where(eq(challengeParticipants.challengeId, c.id)),
      ) })
      .from(challenges)
      .where(eq(challenges.id, c.id))
      .limit(1);
    if (exists) orphansWithoutParts.push(c);
  }

  for (const c of orphansWithoutParts) {
    const newStart = addDaysUtc(todayUtc(), 1);
    const newEnd = addDaysUtc(newStart, c.durationDays - 1);
    await db
      .update(challenges)
      .set({ status: 'OPEN', startDate: newStart, endDate: newEnd })
      .where(eq(challenges.id, c.id));
    console.log(
      `Restored ${c.title} (id=${c.id}) → OPEN, ${newStart.toISOString().slice(0, 10)} to ${newEnd.toISOString().slice(0, 10)}`,
    );
  }
  if (orphansWithoutParts.length === 0) console.log('No orphan COMPLETED challenges found.');
  process.exit(0);
})();
