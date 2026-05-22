import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from '../db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Use one connection in dev, more in prod. prepare:false is recommended for
// Neon's PgBouncer pooler and similar pooled hosts.
const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === 'production' ? 10 : 3,
});

export const db = drizzle(client, { schema });
export { schema };
