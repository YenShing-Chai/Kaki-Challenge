import type { NextFunction, Request, Response } from 'express';

import { requireAuth } from './requireAuth';

/**
 * Admin gate for operator-only routes. Requires the authenticated user's Clerk
 * ID to match the ADMIN_CLERK_ID env var. Set this to your own Clerk user ID
 * (visible in the Clerk dashboard) to seed challenges.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const admin = process.env.ADMIN_CLERK_ID;
    if (!admin) {
      res.status(500).json({
        error: 'server_misconfigured',
        message: 'ADMIN_CLERK_ID not set — operator routes are disabled.',
      });
      return;
    }
    if (req.auth?.userId !== admin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  });
}
