import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';

import { requireAuth } from './requireAuth';
import { db } from '../lib/db';
import { users } from '../db/schema';

/**
 * Admin gate for operator-only routes. Resolves the authenticated user's
 * email and compares it against ADMIN_EMAIL. Set this in server/.env to the
 * email of the human treated as admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      res.status(500).json({
        error: 'server_misconfigured',
        message: 'ADMIN_EMAIL not set — operator routes are disabled.',
      });
      return;
    }
    if (!req.auth?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, req.auth.userId))
        .limit(1);
      if (!user) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      next();
    } catch (err) {
      console.error('[admin-gate] failed to resolve user', err);
      res.status(500).json({ error: 'internal_error' });
    }
  });
}
