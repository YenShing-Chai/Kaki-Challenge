import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';

import { runDailyResolution } from '../jobs/dailyResolution';
import { fireSlotForAllNow } from '../jobs/pushNotifications';
import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../lib/db';
import { users } from '../db/schema';

export const adminRouter = Router();

function checkSecret(provided: string | undefined): boolean {
  return Boolean(process.env.CRON_SECRET) && provided === process.env.CRON_SECRET;
}

adminRouter.post('/trigger-resolution', async (req, res, next) => {
  try {
    if (!checkSecret(req.header('x-cron-secret'))) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { at } = (req.body ?? {}) as { at?: string };
    await runDailyResolution(at ? new Date(at) : new Date());
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/trigger-notifications', async (req, res, next) => {
  try {
    if (!checkSecret(req.header('x-cron-secret'))) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { type } = (req.body ?? {}) as { type?: 'morning' | 'danger' | 'panic' };
    if (type !== 'morning' && type !== 'danger' && type !== 'panic') {
      res.status(400).json({ error: 'bad_request', message: 'type must be morning|danger|panic' });
      return;
    }
    const fired = await fireSlotForAllNow(type);
    res.json({ ok: true, fired });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/creator-applications', requireAdmin, async (_req, res, next) => {
  try {
    const applications = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        creatorBio: users.creatorBio,
        creatorAppliedAt: users.creatorAppliedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.creatorStatus, 'APPLIED'))
      .orderBy(asc(users.creatorAppliedAt));
    res.json({ applications });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/creator-applications/:userId/approve', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const [user] = await db
      .update(users)
      .set({ creatorStatus: 'APPROVED', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/creator-applications/:userId/reject', requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const [user] = await db
      .update(users)
      .set({ creatorStatus: 'REJECTED', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
