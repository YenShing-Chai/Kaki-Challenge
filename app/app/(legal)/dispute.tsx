/**
 * Dispute Policy — pre-launch draft.
 *
 * Mirrors the server-side dispute lifecycle (server/src/lib/disputes.ts)
 * and the mobile dispute UI (app/app/dispute/[id].tsx). Reads as the
 * formal user-facing version of the same state machine.
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

export default function DisputePolicyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Dispute Policy' }} />
      <LegalScreen title="Dispute Policy" lastUpdated="2026-05-23">
        <Callout tone="note">
          Disputes exist to catch things that the automated system + peer reviewers miss. Filing
          one pauses the payout until an admin reviews. Be specific — vague disputes are dismissed.
        </Callout>

        <Section title="1. Who can file">
          <P>Any participant in a challenge can file a dispute on that challenge.</P>
          <P>
            Non-participants and outside observers cannot — please email{' '}
            <Placeholder>support@kaki.app</Placeholder> instead.
          </P>
        </Section>

        <Section title="2. When you can file">
          <P>
            The dispute window opens when the challenge ends and stays open for a duration that
            scales with the challenge's risk classification (PRD §5):
          </P>
          <Bullet><P>LOW risk → 24 hours</P></Bullet>
          <Bullet><P>MEDIUM risk → 48 hours</P></Bullet>
          <Bullet><P>HIGH risk → 72 hours</P></Bullet>
          <P>
            After the window closes, the result is final and payouts release on the next cron tick.
          </P>
        </Section>

        <Section title="3. Valid grounds">
          <Bullet><P><Bold>FAKE_PROOF</Bold> — submission photo is stolen, staged, or AI-generated.</P></Bullet>
          <Bullet><P><Bold>WRONG_SCORE</Bold> — automated score is wrong; numbers don't reconcile.</P></Bullet>
          <Bullet><P><Bold>LATE_SUBMISSION</Bold> — proof submitted after the deadline but accepted.</P></Bullet>
          <Bullet><P><Bold>RULE_VIOLATION</Bold> — participant broke the rules set by the challenge creator.</P></Bullet>
          <Bullet><P><Bold>DUPLICATE_PROOF</Bold> — same photo used for multiple days.</P></Bullet>
          <Bullet><P><Bold>UNSAFE_BEHAVIOR</Bold> — challenge or proof involved harm to self or others.</P></Bullet>
          <Bullet><P><Bold>OTHER</Bold> — describe in the note. Less common, slower to resolve.</P></Bullet>
        </Section>

        <Section title="4. How to file">
          <P>From the challenge detail screen, tap "Something off? Raise a dispute". Then:</P>
          <Bullet><P>Pick a reason (above).</P></Bullet>
          <Bullet><P>Write a description of at least 10 characters. Be specific — dates, photos, names.</P></Bullet>
          <Bullet><P>Submit. The dispute is created in OPEN status and the payout is locked.</P></Bullet>
        </Section>

        <Section title="5. What happens after you file">
          <P>The dispute moves through these states:</P>
          <Bullet>
            <P>
              <Bold>OPEN</Bold> → admin queue. Triage within{' '}
              <Placeholder>48 hours</Placeholder>.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>UNDER_REVIEW</Bold> → admin is investigating.
              May reach out to you or the affected participant for more info.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>UPHELD</Bold> → dispute granted. Winners
              recalculate. The offending participant may be disqualified; severe cases lower trust
              score.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>REJECTED</Bold> → dispute dismissed. Original
              result stands.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>WITHDRAWN</Bold> → you pulled it back before
              resolution.
            </P>
          </Bullet>
          <Bullet>
            <P>
              <Bold>RESOLVED_VOID</Bold> → challenge voided
              entirely. All participants refunded.
            </P>
          </Bullet>
        </Section>

        <Section title="6. SLA">
          <P>
            We aim to resolve disputes within 7 business days of filing. Cross-border or
            evidence-heavy cases may take longer; we'll update you in-app.
          </P>
        </Section>

        <Section title="7. False or vexatious disputes">
          <P>Filing disputes that are clearly without merit damages your trust score:</P>
          <Bullet><P>One rejected dispute → minor trust drop, warning.</P></Bullet>
          <Bullet><P>Three rejected disputes in 30 days → dispute privileges suspended for 60 days.</P></Bullet>
          <Bullet><P>Pattern of bad faith → account suspension.</P></Bullet>
          <P>
            Genuine disputes that are dismissed (insufficient evidence, not bad faith) do not
            penalise you.
          </P>
        </Section>

        <Section title="8. Appeals">
          <P>
            If you disagree with a dispute resolution, you may appeal once by emailing{' '}
            <Placeholder>complaints@kaki.app</Placeholder> within 14 days. A different admin
            reviews. Appeals decisions are final on the Kaki side — your statutory remedies remain
            unaffected.
          </P>
        </Section>

        <Section title="9. Privacy of dispute content">
          <P>
            Dispute descriptions and resolution notes are visible only to Kaki admins and the
            parties directly involved. They are not shown to the wider challenge participants and
            are retained per the Privacy Policy's record-keeping window (7 years where AML
            applies; otherwise deletable on request).
          </P>
        </Section>

        <Section title="10. Contact">
          <P>
            <Placeholder>disputes@kaki.app</Placeholder> — first line.{' '}
            <Placeholder>complaints@kaki.app</Placeholder> — escalations and appeals.
          </P>
        </Section>
      </LegalScreen>
    </>
  );
}
