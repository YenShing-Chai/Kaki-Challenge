/**
 * Privacy Policy — pre-launch draft.
 *
 * Updated for v2 universal challenges + Winner Pool. Covers photo proof,
 * peer review notes, dispute descriptions, EXIF metadata, optional geo
 * matching, and Stripe Connect payouts. PDPA-style (Malaysia) baseline;
 * GDPR carve-outs noted where they differ.
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

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <LegalScreen title="Privacy Policy" lastUpdated="2026-05-23">
        <Section title="1. Who handles your data">
          <P>
            <Placeholder>Your Co. Sdn. Bhd.</Placeholder>, the data controller, decides how your
            personal data is processed. Data processors on our behalf:
          </P>
          <Bullet><P>Stripe (payments + Stripe Connect payouts)</P></Bullet>
          <Bullet><P>Render (server hosting)</P></Bullet>
          <Bullet><P>Render Postgres (database)</P></Bullet>
          <Bullet><P>Expo Push Notifications (notifications)</P></Bullet>
          <Bullet>
            <P>
              <Placeholder>S3 / Cloudflare R2</Placeholder> for photo evidence (when image uploads
              ship)
            </P>
          </Bullet>
        </Section>

        <Section title="2. What we collect — account">
          <Bullet><P>Email address and display name (you provide)</P></Bullet>
          <Bullet><P>Hashed password (we use bcrypt; we never store plaintext)</P></Bullet>
          <Bullet><P>Timezone (auto-detected from device, used to schedule daily resets)</P></Bullet>
          <Bullet><P>Optional push notification token</P></Bullet>
          <Bullet>
            <P>
              Payment method tokenised by Stripe — Kaki never sees full card numbers, CVC, or
              expiry
            </P>
          </Bullet>
        </Section>

        <Section title="3. What we collect — challenges">
          <Bullet><P>Challenges you create, join, and submit proof for</P></Bullet>
          <Bullet><P>Step counts (single integer per day) from HealthKit / Health Connect</P></Bullet>
          <Bullet><P>Photo proofs you upload, plus EXIF metadata (date taken, optional geo)</P></Bullet>
          <Bullet><P>Notes you attach to submissions or peer reviews</P></Bullet>
          <Bullet><P>Dispute descriptions you write</P></Bullet>
          <Bullet>
            <P>
              Confidence scores (0–100) we compute internally — derived from EXIF, geo match, and
              your trust score
            </P>
          </Bullet>
        </Section>

        <Section title="4. What we don't collect">
          <Bullet><P>GPS location in the background</P></Bullet>
          <Bullet><P>Heart rate, sleep, or any Health/Fit data beyond a daily step total</P></Bullet>
          <Bullet><P>Microphone, camera roll, or contacts (unless you explicitly add a photo)</P></Bullet>
          <Bullet><P>Browsing history or analytics outside the app</P></Bullet>
          <Bullet>
            <P>
              <Placeholder>No third-party advertising trackers. Confirm before launch — verify the
              Expo build is free of Facebook SDK, AppsFlyer, etc.</Placeholder>
            </P>
          </Bullet>
        </Section>

        <Section title="5. Who can see what">
          <Bullet><P>Your challenge participations are visible to other participants in that challenge.</P></Bullet>
          <Bullet>
            <P>
              Photo proofs in peer-review challenges are visible to other participants while voting
              and to Kaki admins for moderation.
            </P>
          </Bullet>
          <Bullet>
            <P>
              Dispute descriptions and notes are visible only to Kaki admins and the affected
              party. They are not shown to the general challenge participants.
            </P>
          </Bullet>
          <Bullet>
            <P>
              Your name, avatar, and public stats (challenges won, current streak) appear on
              public profile pages at <Placeholder>kaki.app/u/[your-id]</Placeholder>. You can opt
              out in Profile → Settings.
            </P>
          </Bullet>
        </Section>

        <Section title="6. How payment data is handled">
          <P>
            All payment data flows directly through Stripe. We never see, store, or transmit your
            full card number, CVC, or expiry. Stripe is PCI-DSS Level 1 certified.
          </P>
          <P>
            For Winner Pool payouts, you'll be asked to connect a Stripe Connect Express account.
            Stripe collects the KYC information required by{' '}
            <Placeholder>BNM and Stripe Malaysia</Placeholder> directly — Kaki never sees those
            documents. We only store your Stripe account ID and payout amounts.
          </P>
        </Section>

        <Section title="7. Photo proof retention">
          <P>
            Photos you upload as challenge proof are retained for:
          </P>
          <Bullet><P>The duration of the challenge</P></Bullet>
          <Bullet><P>Plus 90 days after challenge end, in case of late-filed disputes</P></Bullet>
          <Bullet><P>Plus 7 years for any submission tied to a Winner Pool payout — required for AML record-keeping</P></Bullet>
          <Callout tone="warn">
            <Placeholder>Confirm the 7-year window with Malaysian AMLA / FSA. May differ for
            EU users under GDPR Art. 17 right-to-erasure where AML retention doesn't apply.</Placeholder>
          </Callout>
        </Section>

        <Section title="8. Your rights">
          <Bullet><P>Access — download all data we hold on you (request via support email).</P></Bullet>
          <Bullet>
            <P>Correction — edit your display name and timezone in-app; email us for anything else.</P>
          </Bullet>
          <Bullet>
            <P>
              Deletion — Profile → Account → Delete account removes user record, step logs,
              challenge participations, and your Stripe customer within 30 days.{' '}
              <Placeholder>Submissions tied to AML retention are kept for 7 years after which they
              are also deleted.</Placeholder>
            </P>
          </Bullet>
          <Bullet>
            <P>
              Portability — we'll provide a JSON export of your data within 30 days of your written
              request.
            </P>
          </Bullet>
          <Bullet>
            <P>
              Objection — you can object to processing for marketing purposes (we currently don't
              do any).
            </P>
          </Bullet>
        </Section>

        <Section title="9. Children">
          <P>
            Kaki is for 18+. If we learn we've collected data from anyone under 18, we'll delete
            it immediately. Contact us if you believe a minor has registered.
          </P>
        </Section>

        <Section title="10. International transfers">
          <P>
            Our servers run on Render in <Placeholder>Singapore (ap-southeast-1)</Placeholder>.
            Stripe processes payments in <Placeholder>Singapore + Ireland</Placeholder>. If you're
            in the EU, your data may transfer outside the EEA under Standard Contractual Clauses.
          </P>
        </Section>

        <Section title="11. Security">
          <P>
            All traffic is HTTPS. Database backups are encrypted at rest. Passwords are bcrypt-
            hashed. We rotate JWT signing keys quarterly.
          </P>
          <P>
            If we suffer a breach affecting your personal data, we'll notify you within 72 hours
            by email and in-app banner — and within whatever shorter window your jurisdiction
            requires.
          </P>
        </Section>

        <Section title="12. Changes">
          <P>
            We'll notify you of material changes via in-app banner and email at least 14 days
            before they take effect.
          </P>
        </Section>

        <Section title="13. Contact">
          <P>
            Privacy questions, data requests, or complaints:{' '}
            <Placeholder>privacy@kaki.app</Placeholder>.
          </P>
          <P>
            <Placeholder>Designated Data Protection Officer — name + contact here once
            appointed.</Placeholder>
          </P>
        </Section>
      </LegalScreen>
    </>
  );
}
