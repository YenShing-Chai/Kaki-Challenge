/**
 * Stripe Connect Express — payout side of Winner Pool.
 *
 * Kaki sits as the platform in a "separate charges and transfers" model:
 *   - Join flow charges the joiner on Kaki's platform account (already wired
 *     in challengesV2.ts → POST /:id/join).
 *   - Held funds sit in Kaki's Stripe balance until the dispute window
 *     closes and admin approves.
 *   - Release flow (internalWinnerPool.ts) issues a Stripe Transfer to
 *     each winner's connected Express account.
 *
 * Winners onboard via Stripe-hosted onboarding (AccountLink). Mobile opens
 * it in expo-web-browser; we never see KYC data — Stripe handles it.
 *
 * This lib exposes:
 *   - createConnectAccount(user)     → creates Express account, persists ID
 *   - createOnboardingLink(args)     → AccountLink URL for the user to visit
 *   - refreshConnectStatus(userId)   → re-pull from Stripe + update DB
 *   - transferToConnect(args)        → execute payout transfer (idempotent)
 *
 * Compliance notes (see Refund Policy + Privacy):
 *   - Stripe collects KYC. Kaki never stores tax IDs or bank details.
 *   - All transfers carry the Kaki-side payout row ID as Stripe idempotency
 *     key so cron retries don't double-pay.
 */

import { eq } from 'drizzle-orm';

import { db } from './db';
import { users } from '../db/schema';
import { stripe } from './stripe';

// ─── Status mapping ────────────────────────────────────────────────────────

export type ConnectStatus =
  | 'NONE' // no Stripe account yet
  | 'PENDING' // account exists, KYC incomplete
  | 'ACTIVE' // payouts enabled, ready to receive transfers
  | 'RESTRICTED' // Stripe asked for more info
  | 'DISABLED'; // permanently blocked

/**
 * Derive our 5-state status from Stripe's account object. Stripe exposes
 * `details_submitted`, `charges_enabled`, `payouts_enabled`, and a
 * `requirements.disabled_reason` we use to detect a hard block.
 */
export function deriveStatus(account: {
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    disabled_reason?: string | null;
    currently_due?: string[] | null;
  } | null;
}): ConnectStatus {
  if (account.requirements?.disabled_reason) {
    return account.requirements.disabled_reason.startsWith('rejected')
      ? 'DISABLED'
      : 'RESTRICTED';
  }
  if (account.payouts_enabled && account.charges_enabled) return 'ACTIVE';
  if (account.details_submitted) return 'RESTRICTED';
  return 'PENDING';
}

// ─── Account creation ──────────────────────────────────────────────────────

/**
 * Create a new Express account for the user and persist the ID. Idempotent
 * via DB: if the user already has an account ID, return that instead of
 * creating another.
 */
export async function createConnectAccount(args: {
  userId: string;
  email: string;
  country?: string;
}): Promise<{ accountId: string; created: boolean }> {
  if (!stripe) throw new Error('stripe_not_configured');

  const [user] = await db
    .select({ stripeConnectAccountId: users.stripeConnectAccountId })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (user?.stripeConnectAccountId) {
    return { accountId: user.stripeConnectAccountId, created: false };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    country: args.country ?? 'MY',
    email: args.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: {
      kakiUserId: args.userId,
    },
  });

  await db
    .update(users)
    .set({
      stripeConnectAccountId: account.id,
      connectStatus: 'PENDING',
      connectChargesEnabled: false,
      connectPayoutsEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, args.userId));

  return { accountId: account.id, created: true };
}

// ─── Onboarding link ───────────────────────────────────────────────────────

/**
 * Generate a one-shot AccountLink URL the user opens to complete KYC.
 * Links expire after ~5 minutes; clients call refresh-link to re-issue.
 *
 * returnUrl is hit when the user finishes (or thinks they finished).
 * refreshUrl is hit if the link expires mid-flow — Stripe re-routes to
 * regenerate. Both should deep-link back to the app.
 */
export async function createOnboardingLink(args: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string> {
  if (!stripe) throw new Error('stripe_not_configured');
  const link = await stripe.accountLinks.create({
    account: args.accountId,
    type: 'account_onboarding',
    return_url: args.returnUrl,
    refresh_url: args.refreshUrl,
  });
  return link.url;
}

// ─── Status refresh ────────────────────────────────────────────────────────

export interface ConnectStatusSnapshot {
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  detailsSubmitted: boolean;
}

/**
 * Pull the latest Stripe account state and update the user row. Called:
 *   - when the mobile app returns from the onboarding browser session
 *   - by the admin "refresh status" tool
 *   - lazily before any transfer in release-payout
 */
export async function refreshConnectStatus(userId: string): Promise<ConnectStatusSnapshot | null> {
  if (!stripe) throw new Error('stripe_not_configured');

  const [user] = await db
    .select({ accountId: users.stripeConnectAccountId, connectOnboardedAt: users.connectOnboardedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.accountId) return null;

  const account = await stripe.accounts.retrieve(user.accountId);
  const status = deriveStatus(account);
  const requirementsDue = account.requirements?.currently_due ?? [];

  // First time the account reaches ACTIVE → stamp connectOnboardedAt so we
  // can show "Member since" copy and audit when KYC cleared.
  const newlyActive = status === 'ACTIVE' && !user.connectOnboardedAt;

  await db
    .update(users)
    .set({
      connectStatus: status,
      connectChargesEnabled: account.charges_enabled ?? false,
      connectPayoutsEnabled: account.payouts_enabled ?? false,
      connectRequirementsDue: requirementsDue as never,
      ...(newlyActive ? { connectOnboardedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return {
    status,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    requirementsDue,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

// ─── Transfer execution ────────────────────────────────────────────────────

export interface TransferArgs {
  /** Kaki payout row id — used as Stripe idempotency key. */
  payoutId: string;
  /** Destination Connect account. */
  destinationAccountId: string;
  /** Cents. e.g. RM 25.00 → 2500. */
  amountCents: number;
  currency: string;
  /** For Stripe's metadata blob — easier debugging in the dashboard. */
  challengeId: string;
  userId: string;
}

export interface TransferResult {
  transferId: string;
  amount: number;
  currency: string;
}

/**
 * Issue a Stripe Transfer from Kaki's platform balance to the winner's
 * connected account. Idempotent — calling twice with the same payoutId
 * is safe (Stripe deduplicates server-side).
 */
export async function transferToConnect(args: TransferArgs): Promise<TransferResult> {
  if (!stripe) throw new Error('stripe_not_configured');

  const transfer = await stripe.transfers.create(
    {
      amount: args.amountCents,
      currency: args.currency.toLowerCase(),
      destination: args.destinationAccountId,
      description: `Kaki payout · ${args.payoutId}`,
      metadata: {
        kakiPayoutId: args.payoutId,
        challengeId: args.challengeId,
        userId: args.userId,
      },
    },
    { idempotencyKey: `kaki-payout-${args.payoutId}` },
  );

  return {
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
  };
}

// ─── Convenience: can this user receive? ───────────────────────────────────

/**
 * Cheap gate for the release-payout flow. Refreshes status before checking
 * so we don't transfer to a stale ACTIVE that Stripe has since restricted.
 */
export async function canReceivePayouts(userId: string): Promise<{
  ok: boolean;
  reason?: string;
  accountId?: string;
}> {
  const snapshot = await refreshConnectStatus(userId);
  if (!snapshot) return { ok: false, reason: 'no_connect_account' };
  if (!snapshot.payoutsEnabled) return { ok: false, reason: 'payouts_disabled' };
  if (snapshot.status !== 'ACTIVE') return { ok: false, reason: `status_${snapshot.status.toLowerCase()}` };

  const [user] = await db
    .select({ accountId: users.stripeConnectAccountId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.accountId) return { ok: false, reason: 'no_connect_account' };
  return { ok: true, accountId: user.accountId };
}
