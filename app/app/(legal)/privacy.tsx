import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Privacy Policy</Text>
        <Text style={styles.meta}>Last updated 2026-05-21</Text>

        <Section title="What we collect">
          <P>• Your email address (via Clerk)</P>
          <P>• Your daily step count (a single integer per day)</P>
          <P>• Your payment method, stored by Stripe — we never see card numbers</P>
        </Section>

        <Section title="What we don't collect">
          <P>• GPS location</P>
          <P>• Health conditions or medical data</P>
          <P>• Raw sensor data, heart rate, sleep, or any other Health/Fit metric beyond daily step total</P>
        </Section>

        <Section title="How step data is used">
          <P>
            Solely to determine whether you completed a challenge day. Steps are stored as a single
            integer per calendar day. We never share, sell, or analyse step data for any other purpose.
          </P>
        </Section>

        <Section title="Payment data">
          <P>
            All payment processing goes through Stripe. We never see, store, or transmit your full
            card number, CVC, or expiration. Stripe is PCI-DSS Level 1 certified.
          </P>
        </Section>

        <Section title="Data deletion">
          <P>
            Deleting your account from Profile → Account → Delete account removes your user record,
            step logs, challenge participations, and Stripe customer within 30 days.
          </P>
        </Section>

        <Section title="Contact">
          <P>For data requests, email support@doandearn.example (placeholder — wire your real support email before launch).</P>
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
