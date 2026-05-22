import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
  stepLogs,
  transactions,
} from '../src/db/schema';

const NEON = process.env.NEON_URL_OLD;
const RENDER = process.env.DATABASE_URL;

if (!NEON || !RENDER) {
  console.error('Need both NEON_URL_OLD and DATABASE_URL in env.');
  process.exit(1);
}

const neonClient = postgres(NEON, { prepare: false, max: 1 });
const renderClient = postgres(RENDER, { prepare: false, max: 1 });
const neon = drizzle(neonClient);
const render = drizzle(renderClient);

async function copy<T extends { id: string }>(
  name: string,
  table: any,
): Promise<void> {
  const rows = (await neon.select().from(table)) as T[];
  console.log(`  ${name}: ${rows.length} rows`);
  if (rows.length === 0) return;
  for (const row of rows) {
    await render.insert(table).values(row as never).onConflictDoNothing();
  }
}

(async () => {
  console.log('Copying Neon → Render');
  // Order matters for FK constraints: users → challenges → participants → progress, logs, transactions
  await copy('User', users);
  await copy('Challenge', challenges);
  await copy('ChallengeParticipant', challengeParticipants);
  await copy('DailyProgress', dailyProgress);
  await copy('StepLog', stepLogs);
  await copy('Transaction', transactions);
  await neonClient.end();
  await renderClient.end();
  console.log('Done.');
  process.exit(0);
})().catch((e) => {
  console.error('Copy failed:', e);
  process.exit(1);
});
