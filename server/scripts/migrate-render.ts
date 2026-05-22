import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);
  console.log('Applying migrations to', url.split('@')[1]?.split('/')[0]);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Done.');
  await client.end();
  process.exit(0);
})().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
