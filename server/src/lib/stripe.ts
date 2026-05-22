import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
  console.warn(
    '[kaki] STRIPE_SECRET_KEY is not set — payment routes will return 500.',
  );
}

export const stripe = secret ? new Stripe(secret) : null;
