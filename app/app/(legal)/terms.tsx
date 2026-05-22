import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Terms of Service</Text>
        <Text style={styles.meta}>Last updated 2026-05-21</Text>

        <Section title="The forfeit mechanic">
          <P>
            When you join a challenge, you authorise Stripe to hold your commitment fee on your saved
            card. If you complete every day's step goal, the hold is released. If you miss any day,
            your commitment fee is captured and joins the prize pool for the winners.
          </P>
        </Section>

        <Section title="No refunds on forfeited stakes">
          <P>
            By joining a challenge you agree that missing a step goal results in your commitment fee
            being captured. We do not refund forfeited stakes.
          </P>
        </Section>

        <Section title="Not a gambling platform">
          <P>
            Kaki is a commitment-device fitness product. Prize pools are funded entirely by
            participant commitments — Kaki does not contribute money to or take a percentage from
            the pool. Each challenge is a fixed-pool agreement among participants to reward
            consistent walkers from the commitments of those who miss days.
          </P>
        </Section>

        <Section title="Prize payouts">
          <P>
            Payouts may take 3–5 business days to process. Payouts are issued to the payment method
            you have on file.
          </P>
        </Section>

        <Section title="Step data source">
          <P>
            Step counts must originate from Apple Health (iOS) or Google Health Connect (Android).
            Manual entries are accepted but are flagged in your activity history and may be reviewed.
          </P>
        </Section>

        <Section title="Cancellation by Kaki">
          <P>
            Kaki reserves the right to cancel a challenge that fails to reach its minimum
            participant count. If a challenge is cancelled, all participants receive a full refund of
            their commitment hold (no charge).
          </P>
        </Section>

        <Section title="Eligibility">
          <P>You must be 18 years or older to use Kaki.</P>
        </Section>

        <Section title="Governing law">
          <P>
            These terms are governed by the laws of [your jurisdiction]. Update this section with a
            lawyer's input before launch.
          </P>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 10, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  p: { fontSize: 15, color: '#333', lineHeight: 22 },
  meta: { color: '#888', fontSize: 13, marginBottom: 12 },
});
