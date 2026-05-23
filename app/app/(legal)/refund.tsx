/**
 * Refund Policy — pre-launch draft.
 *
 * The Winner Pool buy-in is the only place money moves on Kaki, so this
 * policy specifically maps each failure mode to a refund treatment.
 * Captures cancelled challenges, voided results, upheld disputes, payment
 * processing errors, and account deletion mid-challenge.
 */

import { Stack } from 'expo-router';

import {
  Bold,
  Bullet,
  Callout,
  LegalScreen,
  P,
  Placeholder,
  Section,
} from '../../components/themeB/legal';

export default function RefundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Refund Policy' }} />
      <LegalScreen title="Refund Policy" lastUpdated="2026-05-23">
        <Callout tone="note">
          Short version: you get a full refund when the challenge can't run as intended (cancelled,
          voided, payment error). You don't get a refund when you join a Winner Pool, miss the
          goal, and the pot goes to other winners — that's the whole game.
        </Callout>

        <Section title="1. When refunds happen automatically">
          <P>
            <Bold>Challenge cancelled before start.</Bold> If
            Kaki cancels the challenge (under-participation, moderation block, fraud flag), every
            joiner's authorisation hold is released. No refund needed — Stripe never captured the
            money.
          </P>
          <P>
            <Bold>You leave before start.</Bold> You can withdraw
            from any challenge up to the moment it starts. Your hold is released immediately.
          </P>
        </Section>

        <Section title="2. When refunds happen after admin review">
          <Bullet>
            <P>
              <Bold>Challenge voided by admin.</Bold> Severe
              fraud, dispute resolution status = RESOLVED_VOID, or platform error. All
              participants are refunded in full within 5 business days.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>Dispute upheld in your favour.</Bold> If your
              dispute is UPHELD, Kaki recalculates winners. If you were unfairly disqualified, your
              share of the pot is restored.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>Payment capture failed for another winner.</Bold> Their share is redistributed pro-rata to the remaining winners.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>No-winner clause triggered.</Bold> If a
              challenge's win condition is never met (e.g. nobody hit the target), the configured
              No-Winner Rule applies. The default is REFUND_ALL — every participant gets their
              buy-in back, minus Stripe fees.
            </P>
          </Bullet>
        </Section>

        <Section title="3. When refunds don't happen">
          <Bullet>
            <P>
              You joined a Winner Pool, the challenge ran cleanly, you missed the goal, and others
              won. Your buy-in is part of the prize pool. This is not refunded.
            </P>
          </Bullet>
          <Bullet>
            <P>
              You forgot the challenge existed. Not a basis for refund — push notifications and
              the home tab show your active challenges.
            </P>
          </Bullet>
          <Bullet>
            <P>
              Your peer review was rejected (2 rejections). The pot stays with verified winners.
            </P>
          </Bullet>
          <Bullet>
            <P>
              You deleted your account mid-challenge. Forfeited buy-ins stay in the pool. Account
              deletion does not auto-refund.
            </P>
          </Bullet>
        </Section>

        <Section title="4. Payment processing errors">
          <P>
            If Stripe rejects the capture at the end of a challenge (expired card, insufficient
            funds, etc.), Kaki marks the buy-in as FAILED. You're not penalised — but you also
            won't win a payout in that challenge until the issue is resolved with your bank.
          </P>
          <P>
            You can update your payment method in Profile → Payment at any time. Retries happen
            automatically for 7 days.
          </P>
        </Section>

        <Section title="5. Chargebacks">
          <P>
            Filing a chargeback against a Winner Pool buy-in you legitimately joined is treated as
            fraud. We will:
          </P>
          <Bullet><P>Contest the chargeback with Stripe.</P></Bullet>
          <Bullet><P>Suspend your account pending resolution.</P></Bullet>
          <Bullet><P>Block re-registration from the same device / payment method.</P></Bullet>
          <P>
            If you genuinely don't recognise a charge, please email{' '}
            <Placeholder>support@kaki.app</Placeholder> first — we'll resolve faster than
            chargebacks can and refund where appropriate.
          </P>
        </Section>

        <Section title="6. Refund timing and method">
          <P>
            Refunds are issued to the original payment method via Stripe. They typically appear
            within:
          </P>
          <Bullet><P>1–2 business days for cancelled holds (no capture happened)</P></Bullet>
          <Bullet><P>5–10 business days for captured-then-refunded amounts</P></Bullet>
          <Bullet>
            <P>
              Cross-border cards may take longer per your issuing bank's policy — out of our
              control.
            </P>
          </Bullet>
        </Section>

        <Section title="7. Stripe fees">
          <P>
            Stripe charges a flat processing fee (~2.9% + RM 1) per buy-in. When a challenge is
            cancelled before capture, no fee applies. When a captured amount is refunded, Stripe's
            policy is to keep their fee — so refunds may be net of <Placeholder>~RM 1.50 per
            transaction</Placeholder>. Kaki absorbs the fee where Kaki caused the cancellation.
          </P>
        </Section>

        <Section title="8. How to request a refund">
          <P>
            For automatic refunds (§1, §2), you don't need to do anything — they happen on the
            challenge's resolution. You'll get an in-app notification when funds move.
          </P>
          <P>
            For anything else, email <Placeholder>support@kaki.app</Placeholder> with:
          </P>
          <Bullet><P>Your account email</P></Bullet>
          <Bullet><P>The challenge name + ID (visible in Profile → Activity)</P></Bullet>
          <Bullet><P>What happened, in your own words</P></Bullet>
          <P>
            We aim to respond within 2 business days. Escalations go to{' '}
            <Placeholder>complaints@kaki.app</Placeholder>.
          </P>
        </Section>

        <Section title="9. Statutory rights">
          <P>
            Nothing in this policy limits your statutory consumer rights under{' '}
            <Placeholder>the Malaysian Consumer Protection Act 1999</Placeholder> or, for EU
            users, the EU Consumer Rights Directive.
          </P>
        </Section>
      </LegalScreen>
    </>
  );
}
