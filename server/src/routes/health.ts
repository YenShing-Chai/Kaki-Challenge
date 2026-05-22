import { Router } from 'express';
import { sql } from 'drizzle-orm';

import { db } from '../lib/db';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let dbStatus: 'connected' | 'error' = 'connected';
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = 'error';
  }
  res.json({ status: 'ok', db: dbStatus });
});
