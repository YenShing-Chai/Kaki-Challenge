import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';

import { requireAuth } from './requireAuth';
import { db } from '../lib/db';
import { users } from '../db/schema';

/**
 * Permits the request if the caller is the admin OR has CreatorStatus=APPROVED.
 * Used to gate POST /challenges/create.
 */
export function requireCreatorOrAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, async () => {
    if (!req.auth?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const [me] = await db
      .select({ email: users.email, creatorStatus: users.creatorStatus })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (adminEmail && me?.email.toLowerCase() === adminEmail) {
      next();
      return;
    }
    if (me?.creatorStatus === 'APPROVED') {
      next();
      return;
    }
    res.status(403).json({
      error: 'forbidden',
      message: 'Only admin or approved creators can do this.',
    });
  });
}
