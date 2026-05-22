import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '../lib/db';
import { users } from '../db/schema';
import { signJwt } from '../lib/jwt';
import { stripe } from '../lib/stripe';

export const authRouter = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Cheap check — real validation happens at signup via Stripe (and humans).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
    hasCompletedOnboarding: u.hasCompletedOnboarding,
    createdAt: u.createdAt.toISOString(),
  };
}

authRouter.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ error: 'bad_email' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'weak_password', message: 'Min 8 chars.' });
      return;
    }
    const normalizedEmail = normalizeEmail(email);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: 'email_taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Optionally provision a Stripe customer up front so payment flows work.
    let stripeCustomerId: string | null = null;
    if (stripe) {
      try {
        const created = await stripe.customers.create({
          email: normalizedEmail,
          name: name ?? undefined,
        });
        stripeCustomerId = created.id;
      } catch (err) {
        console.warn('[auth/signup] stripe customer create failed', err);
      }
    }

    const [created] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        stripeCustomerId,
      })
      .returning();
    if (!created) {
      res.status(500).json({ error: 'insert_failed' });
      return;
    }

    const token = signJwt(created.id);
    res.json({ token, user: sanitizeUser(created) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/signin', async (req, res, next) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (!user || !user.passwordHash) {
      // Don't leak which side failed.
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const token = signJwt(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});
