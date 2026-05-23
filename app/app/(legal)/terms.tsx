/**
 * Terms of Service — pre-launch draft.
 *
 * Covers the v2 universal challenge platform (PRD §14) and the Winner Pool
 * cash-stakes module (Winner Pool PRD). All placeholder text in yellow is
 * yours to fill in with counsel — especially jurisdiction, regulator
 * notices, and the no-gambling characterisation if you're running this
 * in markets where peer-to-peer wagering is restricted.
 */

import { Stack } from 'expo-router';

import {
  Bullet,
  Callout,
  LegalScreen,
  P,
  Placeholder,
  Section,
} from '../../components/themeB/legal';

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      <LegalScreen title="Terms of Service" lastUpdated="2026-05-23">
        <Section title="1. Who we are">
          <P>
            Kaki is a peer-challenge platform operated by{' '}
            <Placeholder>Your Co. Sdn. Bhd.</Placeholder> ("Kaki", "we", "us"). By creating an
            account or joining a challenge, you agree to these Terms.
          </P>
        </Section>

        <Section title="2. Eligibility">
          <P>You must be 18 years or older to use Kaki. By signing up you confirm that you are.</P>
          <P>
            Kaki is not available in jurisdictions where peer-to-peer pooling of money for
            commitment goals is restricted. See <Placeholder>region list</Placeholder> for
            availability.
          </P>
        </Section>

        <Section title="3. The product">
          <P>
            Kaki lets you create or join challenges with friends, teammates, or strangers. A
            challenge has a goal (steps, days completed, photo submissions, etc.), a window of
            time, a verification method, and a reward type.
          </P>
          <P>Reward types currently supported:</P>
          <Bullet><P>Brag-rights only — no money changes hands.</P></Bullet>
          <Bullet>
            <P>
              <P>Winner Pool — every joiner contributes a fixed buy-in (RM 1–50, capped at RM 500
              total per pool); winners split the pot.</P>
            </P>
          </Bullet>
          <Bullet>
            <P>Discount, voucher, points (issued by the challenge creator, not by Kaki).</P>
          </Bullet>
        </Section>

        <Section title="4. Winner Pool — how money flows">
          <P>
            When you join a Winner Pool challenge, Stripe places an authorisation hold on your
            saved payment method for the buy-in amount. Funds are not yet transferred — they're
            ring-fenced until the challenge ends.
          </P>
          <P>
            At the end of the challenge, after the dispute window closes (see §8), Kaki captures
            the holds and pays out to winners via Stripe Connect. Payouts land in winners' Stripe
            balances within <Placeholder>3–5 business days</Placeholder>.
          </P>
          <Callout tone="note">
            Kaki does not take a percentage of the pool. Stripe's processing fees are deducted
            from the gross pool before split — this is a flat ~2.9% + RM 1 per transaction, set
            by Stripe, not by us.
          </Callout>
        </Section>

        <Section title="5. Not gambling, not investment">
          <P>
            Kaki is a commitment-device product. Pools are funded entirely by participant buy-ins
            among a closed group. Kaki does not contribute money, does not take a percentage, and
            does not set odds. Each challenge is a fixed-pool agreement among participants.
          </P>
          <P>
            Nothing on Kaki is financial, medical, or fitness advice. Outcomes are not guaranteed.
          </P>
          <Callout tone="warn">
            <Placeholder>Confirm with Malaysian regulators (BNM / SC) that this characterisation
            holds under the Common Gaming Houses Act 1953 before launch. Add explicit regulator
            language here if required.</Placeholder>
          </Callout>
        </Section>

        <Section title="6. Verifying your wins">
          <P>
            Every challenge has a verification method (PRD §7). The stronger the method, the more
            you can stake. The seven levels are:
          </P>
          <Bullet><P>Self-declaration — honor tap (no money allowed).</P></Bullet>
          <Bullet><P>Auto-data — HealthKit / Health Connect / Stripe.</P></Bullet>
          <Bullet><P>Photo + EXIF — date, time, optional geo.</P></Bullet>
          <Bullet><P>Peer verification — 2 other participants must approve.</P></Bullet>
          <Bullet><P>Manual review — Kaki staff or trusted reviewers.</P></Bullet>
          <Bullet><P>Third-party API — e.g. Strava, MyFitnessPal.</P></Bullet>
          <Bullet><P>Hybrid — combination of the above.</P></Bullet>
          <P>
            We compute a confidence score on every submission. Anything below 75 goes to peer
            review. If peers can't reach 2-of-2 within 24 hours, Kaki admins make the call.
          </P>
        </Section>

        <Section title="7. Honest play">
          <P>By using Kaki you agree to:</P>
          <Bullet><P>Submit only proof from activities you actually completed yourself.</P></Bullet>
          <Bullet><P>Not collude with peers to approve fake proofs.</P></Bullet>
          <Bullet><P>Not use bots, step shakers, or other simulators.</P></Bullet>
          <Bullet><P>Not run challenges that promote harm, hate, or illegal activity.</P></Bullet>
          <P>
            Each violation lowers your trust score. Trust scores under{' '}
            <Placeholder>40</Placeholder> are restricted from cash pools; under{' '}
            <Placeholder>20</Placeholder> are suspended entirely.
          </P>
        </Section>

        <Section title="8. Disputes">
          <P>
            After a challenge ends, any participant has a dispute window (24h / 48h / 72h
            depending on risk level) to raise concerns. Payouts are locked while any dispute on
            the challenge is open.
          </P>
          <P>See our separate Dispute Policy for the full procedure and admin SLA.</P>
        </Section>

        <Section title="9. Refunds">
          <P>
            Refund eligibility depends on what failed. The Refund Policy covers each case:
            cancelled challenge, voided result, dispute upheld, payment processing error, account
            deletion mid-challenge.
          </P>
        </Section>

        <Section title="10. User-generated content">
          <P>
            You retain ownership of challenge titles, descriptions, and submission photos you
            upload. You grant Kaki a worldwide, non-exclusive licence to display them within the
            app to other participants and admins for the purpose of running and moderating the
            challenge.
          </P>
          <P>
            We may remove content that violates §7 or that gets flagged by our moderation pipeline
            (PRD §5).
          </P>
        </Section>

        <Section title="11. Cancellation">
          <P>
            You can leave a challenge before its start date for a full refund of any hold. After
            start, leaving forfeits your buy-in (it stays in the pool).
          </P>
          <P>
            Kaki may cancel a challenge that fails to reach minimum participants, breaches §7, or
            is flagged for fraud. All buy-ins are refunded in cancellation cases.
          </P>
        </Section>

        <Section title="12. Account suspension">
          <P>
            We may suspend or terminate your account for repeated trust score violations, fraud,
            payment chargebacks, or court order. We'll give you 7 days notice except for fraud or
            legal compulsion.
          </P>
        </Section>

        <Section title="13. Limitation of liability">
          <P>
            Kaki provides the platform "as is". To the maximum extent permitted by law, our
            aggregate liability to you in any 12-month period is capped at the greater of (a)
            <Placeholder>RM 200</Placeholder> or (b) the total fees you paid Kaki in that period.
          </P>
          <P>
            We are not liable for indirect, incidental, or consequential damages — including lost
            buy-ins where the loss resulted from your own missed verification.
          </P>
        </Section>

        <Section title="14. Changes to these terms">
          <P>
            We'll notify you of material changes via in-app banner and email at least 14 days
            before they take effect. Continued use after that constitutes acceptance.
          </P>
        </Section>

        <Section title="15. Governing law">
          <P>
            These Terms are governed by the laws of <Placeholder>Malaysia</Placeholder>. Disputes
            between you and Kaki are subject to the exclusive jurisdiction of the courts of{' '}
            <Placeholder>Kuala Lumpur</Placeholder>.
          </P>
        </Section>

        <Section title="16. Contact">
          <P>
            Questions, complaints, or legal notices:{' '}
            <Placeholder>support@kaki.app</Placeholder>.
          </P>
        </Section>
      </LegalScreen>
    </>
  );
}
