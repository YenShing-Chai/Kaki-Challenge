import { Router } from 'express';
import { eq } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import { users } from '../db/schema';
import { stripe } from '../lib/stripe';

export const paymentsRouter = Router();

async function findMe(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}

paymentsRouter.post('/setup-intent', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth || !stripe) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const user = await findMe(req.auth.userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({
        error: 'no_stripe_customer',
        message: 'Call POST /users/sync first to provision a Stripe customer.',
      });
      return;
    }
    const intent = await stripe.setupIntents.create({
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
    res.json({ clientSecret: intent.client_secret, customerId: user.stripeCustomerId });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post('/save-method', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth || !stripe) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { paymentMethodId } = req.body as { paymentMethodId?: string };
    if (!paymentMethodId) {
      res.status(400).json({ error: 'bad_request', message: 'paymentMethodId required' });
      return;
    }
    const user = await findMe(req.auth.userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'no_stripe_customer' });
      return;
    }
    await stripe.paymentMethods.attach(paymentMethodId, { customer: user.stripeCustomerId });
    await db
      .update(users)
      .set({ stripePaymentMethodId: paymentMethodId })
      .where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.get('/method', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth || !stripe) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const user = await findMe(req.auth.userId);
    if (!user?.stripePaymentMethodId) {
      res.json({ method: null });
      return;
    }
    const pm = await stripe.paymentMethods.retrieve(user.stripePaymentMethodId);
    res.json({
      method: pm.card
        ? {
            last4: pm.card.last4,
            brand: pm.card.brand,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DEV ONLY. Attaches Stripe's free test PaymentMethod (`pm_card_visa`) to the
 * caller's Stripe customer. Lets us validate the full join → hold → capture
 * loop without needing PaymentSheet UI (which requires a custom dev client).
 *
 * In production this route should be removed or gated behind ADMIN_CLERK_ID.
 */
paymentsRouter.post('/dev-attach-test-card', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth || !stripe) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const user = await findMe(req.auth.userId);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'no_stripe_customer' });
      return;
    }
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: { token: 'tok_visa' },
    });
    await stripe.paymentMethods.attach(pm.id, { customer: user.stripeCustomerId });
    await db
      .update(users)
      .set({ stripePaymentMethodId: pm.id })
      .where(eq(users.id, user.id));
    res.json({ paymentMethodId: pm.id });
  } catch (err) {
    next(err);
  }
});
