/**
 * Payouts — Stripe Connect onboarding.
 *
 * Status of the user's Stripe Connect Express account. Anyone can join
 * Winner Pool challenges without one (joining = paying in), but to
 * RECEIVE a payout you need an active Connect account.
 *
 * Flow:
 *   1. User taps "Connect Stripe" → POST /api/stripe-connect/onboard
 *      returns a Stripe-hosted onboarding URL.
 *   2. App opens the URL in expo-web-browser. Stripe handles KYC.
 *   3. When the browser session closes (user finished or hit X), we POST
 *      /api/stripe-connect/refresh-status to re-pull and update the DB.
 *   4. Status badge updates to ACTIVE once Stripe verifies.
 */

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BCard, BPill, ScreenHeader } from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type ConnectStatus =
  | 'NONE'
  | 'PENDING'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'DISABLED';

type StatusResponse = {
  connected: boolean;
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  onboardedAt: string | null;
};

export default function PayoutsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      const status = await apiRequest<StatusResponse>('/api/stripe-connect/status', { token });
      setData(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, []),
  );

  const onboard = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const token = await getToken();
      const { url } = await apiRequest<{ url: string }>('/api/stripe-connect/onboard', {
        method: 'POST',
        token,
      });

      // Open Stripe-hosted onboarding in an in-app browser. The browser
      // closes when the user finishes or backs out — either way we re-pull
      // status when control returns.
      const result = await WebBrowser.openBrowserAsync(url, {
        dismissButtonStyle: 'close',
        // iOS only — Android ignores this safely.
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
      void result;

      // Refresh once we're back.
      try {
        const token2 = await getToken();
        await apiRequest('/api/stripe-connect/refresh-status', { method: 'POST', token: token2 });
      } catch {
        // If Stripe is still chewing through verification, the refresh
        // may 404 momentarily — fall through to load() below which is
        // tolerant.
      }
      await load();
    } catch (err) {
      Alert.alert('Could not start onboarding', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={colorsB.orange} />
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = describe(data?.status ?? 'NONE');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>PAYOUTS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colorsB.orange}
          />
        }
      >
        <ScreenHeader eyebrow="Receive payouts" highlight="Get paid" after="💸" />

        <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
          {error ? (
            <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
          ) : null}

          {/* Status hero */}
          <View style={[styles.statusHero, { backgroundColor: statusInfo.heroBg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BPill label={data?.status ?? 'NONE'} tone={statusInfo.pillTone} size="sm" />
              {data?.chargesEnabled ? <BPill label="CHARGES ✓" tone="green" size="sm" /> : null}
              {data?.payoutsEnabled ? <BPill label="PAYOUTS ✓" tone="green" size="sm" /> : null}
            </View>
            <Text style={[styles.statusTitle, { color: statusInfo.heroFg }]}>
              {statusInfo.title}
            </Text>
            <Text style={[styles.statusBody, { color: statusInfo.heroFg }]}>
              {statusInfo.body}
            </Text>
          </View>

          {/* Requirements due, if any */}
          {data && data.requirementsDue.length > 0 ? (
            <BCard>
              <Text style={typeB.eyebrow}>Stripe wants</Text>
              <View style={{ gap: 4, marginTop: spacingB.sm }}>
                {data.requirementsDue.map((req) => (
                  <Text key={req} style={styles.req}>
                    • {humaniseRequirement(req)}
                  </Text>
                ))}
              </View>
            </BCard>
          ) : null}

          {/* CTA */}
          <Pressable
            onPress={onboard}
            disabled={opening || data?.status === 'ACTIVE'}
            style={({ pressed }) => [
              styles.cta,
              (opening || data?.status === 'ACTIVE') && { opacity: 0.5 },
              pressed && !opening && data?.status !== 'ACTIVE' && {
                transform: [{ translateX: 2 }, { translateY: 2 }],
                shadowOpacity: 0,
              },
            ]}
          >
            {opening ? (
              <ActivityIndicator color={colorsB.paper} />
            ) : (
              <Text style={styles.ctaText}>{ctaLabel(data?.status ?? 'NONE')}</Text>
            )}
          </Pressable>

          {/* Info card */}
          <BCard>
            <Text style={typeB.eyebrow}>How payouts work</Text>
            <Text style={styles.infoText}>
              Kaki uses Stripe Connect to send Winner Pool earnings to your bank account. We never
              see your bank details — Stripe handles all KYC.
            </Text>
            <Text style={styles.infoText}>
              Payouts release after the challenge ends and the dispute window closes — typically
              3–5 business days from the end date.
            </Text>
          </BCard>

          {data?.onboardedAt ? (
            <Text style={styles.footer}>
              Onboarded {new Date(data.onboardedAt).toLocaleDateString('en-GB')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Display helpers ──────────────────────────────────────────────────────

function describe(status: ConnectStatus): {
  title: string;
  body: string;
  pillTone: 'orange' | 'yellow' | 'green' | 'neutral';
  heroBg: string;
  heroFg: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        title: "You're set up",
        body: "We'll send Winner Pool payouts straight to your connected account.",
        pillTone: 'green',
        heroBg: colorsB.greenSoft,
        heroFg: colorsB.green,
      };
    case 'PENDING':
      return {
        title: 'Finish onboarding',
        body: "Stripe still needs a few details before you can receive payouts.",
        pillTone: 'yellow',
        heroBg: colorsB.bgWarm,
        heroFg: colorsB.ink,
      };
    case 'RESTRICTED':
      return {
        title: 'Stripe needs more info',
        body: 'Add the requirements below to keep your account active.',
        pillTone: 'orange',
        heroBg: colorsB.orangeSoft,
        heroFg: colorsB.orangeDeep,
      };
    case 'DISABLED':
      return {
        title: 'Account disabled',
        body: 'Stripe has restricted this account. Contact support to investigate.',
        pillTone: 'orange',
        heroBg: colorsB.orangeSoft,
        heroFg: colorsB.orangeDeep,
      };
    case 'NONE':
    default:
      return {
        title: 'Not connected yet',
        body: "Connect Stripe to receive Winner Pool payouts. Takes about 2 minutes.",
        pillTone: 'neutral',
        heroBg: colorsB.bgWarm,
        heroFg: colorsB.ink,
      };
  }
}

function ctaLabel(status: ConnectStatus): string {
  switch (status) {
    case 'ACTIVE':
      return '✓ Connected';
    case 'PENDING':
    case 'RESTRICTED':
      return 'Continue onboarding →';
    case 'DISABLED':
      return 'Contact support';
    case 'NONE':
    default:
      return 'Connect Stripe →';
  }
}

// Translate Stripe's machine codes ("individual.id_number", "tos_acceptance.date")
// into copy a user can act on.
function humaniseRequirement(code: string): string {
  const map: Record<string, string> = {
    'individual.first_name': 'First name',
    'individual.last_name': 'Last name',
    'individual.dob.day': 'Date of birth',
    'individual.dob.month': 'Date of birth',
    'individual.dob.year': 'Date of birth',
    'individual.id_number': 'National ID / IC',
    'individual.address.line1': 'Home address',
    'individual.address.postal_code': 'Postcode',
    'individual.address.city': 'City',
    'external_account': 'Bank account or debit card',
    'tos_acceptance.date': 'Accept Stripe\'s terms',
    'business_profile.url': 'Business URL (or social profile)',
    'business_profile.mcc': 'Business category',
    'individual.verification.document': 'ID document upload',
  };
  return map[code] ?? code.replace(/_/g, ' ').replace(/\./g, ' · ');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 60 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingB.lg,
    paddingTop: 4,
    paddingBottom: spacingB.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '900', color: colorsB.ink },
  headerTitle: { fontSize: 11, fontWeight: '900', color: colorsB.orange, letterSpacing: 2 },

  // Status hero
  statusHero: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.lg,
    gap: spacingB.sm,
    ...shadowsB.card,
  },
  statusTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  statusBody: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  // Requirements
  req: { fontSize: 13, color: colorsB.ink, fontWeight: '600' },

  // CTA
  cta: {
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  ctaText: { color: colorsB.paper, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },

  // Info
  infoText: {
    fontSize: 12,
    color: colorsB.inkSoft,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },

  footer: {
    fontSize: 11,
    color: colorsB.inkFaint,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacingB.sm,
  },
});
