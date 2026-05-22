import 'dotenv/config';
import { asc } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { dailyProgress } from '../src/db/schema';

(async () => {
  const list = await db.query.challenges.findMany({
    with: {
      participants: {
        with: {
          user: { columns: { email: true } },
          dailyProgress: { orderBy: [asc(dailyProgress.date)] },
        },
      },
    },
  });
  for (const c of list) {
    console.log(`\n${c.title} (${c.id})`);
    console.log(
      `  start=${c.startDate.toISOString().slice(0, 10)} end=${c.endDate.toISOString().slice(0, 10)} status=${c.status} pool=$${Number(c.prizePool).toFixed(2)}`,
    );
    if (c.participants.length === 0) {
      console.log('  participants: (none)');
    }
    for (const p of c.participants) {
      console.log(`  - ${p.user.email} status=${p.status} pi=${p.stripePaymentIntentId ?? '-'}`);
      for (const d of p.dailyProgress) {
        console.log(
          `      ${d.date.toISOString().slice(0, 10)}: ${d.stepsAchieved}/${d.goalSteps} completed=${d.completed}`,
        );
      }
    }
  }
  process.exit(0);
})();
