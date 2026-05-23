/**
 * Stripe Connect Express — mobile-facing endpoints.
 *
 * Mounted under /api/stripe-connect/* (see index.ts). All endpoints require
 * an authenticated user; one user can only act on their own Connect account.
 *
 * Endpoints:
 *   GET  /status              → current snapshot (status, requirements)
 *   POST /onboard             → create account if needed + return AccountLink URL
 *   POST /refresh-status      → re-pull from Stripe + update DB
 *   POST /refresh-link        → re-issue AccountLink URL (called when refresh_url hit)
 *
 * The actual onboarding happens in Stripe-hosted browser — the mobile app
 * just opens the returned URL with expo-web-browser.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import { users } from '../db/schema';
import {
  createConnectAccount,
  createOnboardingLink,
  refreshConnectStatus,
} from '../lib/stripeConnect';

export const stripeConnectRouter = Router();

// Where Stripe sends the user when they finish (or hit refresh) on the
// onboarding flow. These are deep links into the app; configure via env so
// dev/prod can differ. Fallbacks below are sensible for Expo dev client.
const CONNECT_RETURN_URL =
  process.env.STRIPE_CONNECT_RETURN_URL ?? 'kaki://profile/payouts?status=done';
const CONNECT_REFRESH_URL =
  process.env.STRIPE_CONNECT_REFRESH_URL ?? 'kaki://profile/payouts?status=refresh';

// ────────────────────────────────────────────────────────────────────────────
// GET /api/stripe-connect/status
// ────────────────────────────────────────────────────────────────────────────

stripeConnectRouter.get(
  '/status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const [user] = await db
        .select({
          accountId: users.stripeConnectAccountId,
          status: users.connectStatus,
          chargesEnabled: users.connectChargesEnabled,
          payoutsEnabled: users.connectPayoutsEnabled,
          requirementsDue: users.connectRequirementsDue,
          onboardedAt: users.connectOnboardedAt,
        })
        .from(users)
        .where(eq(users.id, req.auth.userId))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.json({
        connected: Boolean(user.accountId),
        status: user.status,
        chargesEnabled: user.chargesEnabled,
        payoutsEnabled: user.payoutsEnabled,
        requirementsDue: user.requirementsDue ?? [],
        onboardedAt: user.onboardedAt?.toISOString() ?? null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /api/stripe-connect/onboard
// Creates the Express account if it doesn't exist, then returns an
// AccountLink URL for the user to complete onboarding.
// ────────────────────────────────────────────────────────────────────────────

stripeConnectRouter.post(
  '/onboard',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const [user] = await db
        .select({ email: users.email, jurisdiction: users.jurisdiction })
        .from(users)
        .where(eq(users.id, req.auth.userId))
        .limit(1);
      if (!user) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const { accountId, created } = await createConnectAccount({
        userId: req.auth.userId,
        email: user.email,
        country: user.jurisdiction ?? 'MY',
      });

      const url = await createOnboardingLink({
        accountId,
        returnUrl: CONNECT_RETURN_URL,
        refreshUrl: CONNECT_REFRESH_URL,
      });

      res.json({ accountId, url, created });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /api/stripe-connect/refresh-status
// Re-pull the account state from Stripe + update DB. Mobile calls this
// after the WebBrowser session returns (whether the user completed flow
// or not — Stripe tells us).
// ────────────────────────────────────────────────────────────────────────────

stripeConnectRouter.post(
  '/refresh-status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const snapshot = await refreshConnectStatus(req.auth.userId);
      if (!snapshot) {
        res.status(404).json({ error: 'no_connect_account' });
        return;
      }
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /api/stripe-connect/refresh-link
// Re-issue an AccountLink URL when the previous one expired (Stripe's
// refresh_url hits this). Returns a brand new URL the app should open.
// ────────────────────────────────────────────────────────────────────────────

stripeConnectRouter.post(
  '/refresh-link',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const [user] = await db
        .select({ accountId: users.stripeConnectAccountId })
        .from(users)
        .where(eq(users.id, req.auth.userId))
        .limit(1);
      if (!user?.accountId) {
        res.status(404).json({ error: 'no_connect_account' });
        return;
      }
      const url = await createOnboardingLink({
        accountId: user.accountId,
        returnUrl: CONNECT_RETURN_URL,
        refreshUrl: CONNECT_REFRESH_URL,
      });
      res.json({ url });
    } catch (err) {
      next(err);
    }
  },
);
