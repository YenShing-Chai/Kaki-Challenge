/**
 * Winner Pool — Join flow (Direction B "Playful Buddy").
 *
 * 4-screen progressive flow when a friend taps "Join" on a cash pool challenge.
 *   J1 — Challenge preview (pool stats + entry amount)
 *   J2 — Terms acceptance (what you win / what you risk)
 *   J3 — Payment (Stripe-held entry)
 *   J4 — Confirmation (squad status)
 *
 * Hits POST /api/challenges/:id/join. Stripe payment is collected by the
 * server's existing customer-on-file flow — the user must have a card
 * already on their account.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton, Lead, SecondaryLink, Title, TopNav } from '../../components/create/primitives';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type StepN = 1 | 2 | 3 | 4;

type ChallengePreview = {
  id: string;
  title: string;
  description?: string | null;
  createdByName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  durationDays?: number | null;
  rewardType?: string;
  visibility?: string;
  participantCount?: number;
  maxParticipants?: number;
  minParticipants?: number;
  winnerPool?: {
    entryContributionAmount: number;
    currency: string;
    distributionMethod: string;
    participantMaximum: number;
    totalPoolAmount: number;
  } | null;
  // shared/inviter avatar info
  creatorInitial?: string;
};

export default function JoinChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [step, setStep] = useState<StepN>(1);
  const [preview, setPreview] = useState<ChallengePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Terms acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);

  // Submission
  const [paying, setPaying] = useState(false);
  const [held, setHeld] = useState<{ contributionId: string; amount: number; currency: string } | null>(null);

  const loadPreview = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const token = await getToken();
      // Use the legacy GET /challenges/:id (still works for both old + new shape)
      const data = await apiRequest<{ challenge: ChallengePreview }>(`/challenges/${id}`, { token });
      setPreview(data.challenge);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function onPayAndJoin() {
    if (!id) return;
    setPaying(true);
    try {
      const token = await getToken();
      const result = await apiRequest<{
        participantId: string;
        contributionId: string;
        amountHeld: number;
        currency: string;
      }>(`/api/challenges/${id}/join`, {
        method: 'POST',
        token,
        body: { acceptedTerms: true },
      });
      setHeld({
        contributionId: result.contributionId,
        amount: result.amountHeld,
        currency: result.currency,
      });
      setStep(4);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Payment failed';
      const friendly = parseErrorMessage(raw);
      Alert.alert("Couldn't collect entry", friendly);
    } finally {
      setPaying(false);
    }
  }

  function onBack() {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as StepN);
  }

  function onAdvance() {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) onPayAndJoin();
    else if (step === 4) router.replace(`/challenge/${id}` as never);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colorsB.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !preview) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colorsB.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={[typeB.body, { color: colorsB.orangeDeep, textAlign: 'center' }]}>
            {error ?? "Challenge not found"}
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={[typeB.body, { textDecorationLine: 'underline' }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isWP = preview.rewardType === 'WINNER_POOL' && !!preview.winnerPool;
  const entry = preview.winnerPool?.entryContributionAmount ?? 0;
  const currency = preview.winnerPool?.currency ?? 'MYR';

  return (
    <View style={{ flex: 1, backgroundColor: colorsB.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TopNav step={step} total={4} onBack={onBack} isClose={step === 1} rightPill={joinPill(step)} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacingB.xl }}>
          {step === 1 && (
            <JoinStep1 preview={preview} isWP={isWP} entry={entry} currency={currency} />
          )}
          {step === 2 && (
            <JoinStep2
              entry={entry}
              currency={currency}
              acceptedTerms={acceptedTerms}
              setAcceptedTerms={setAcceptedTerms}
              confirmedAge={confirmedAge}
              setConfirmedAge={setConfirmedAge}
            />
          )}
          {step === 3 && <JoinStep3 entry={entry} currency={currency} />}
          {step === 4 && <JoinStep4 entry={held?.amount ?? entry} currency={currency} preview={preview} />}
        </ScrollView>

        <CtaButton
          label={ctaLabel(step, isWP, entry, currency, paying)}
          variant={step === 4 ? 'green' : 'orange'}
          disabled={(step === 2 && (!acceptedTerms || !confirmedAge)) || paying}
          loading={paying}
          onPress={onAdvance}
        />
        {step === 1 && (
          <SecondaryLink label="see full rules" onPress={() => Alert.alert('Full rules', preview.description ?? 'No extra rules.')} />
        )}
        {step === 4 && (
          <SecondaryLink label="view challenge" onPress={() => router.replace(`/challenge/${id}` as never)} />
        )}
        <View style={{ height: spacingB.lg }} />
      </SafeAreaView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Screens
// ════════════════════════════════════════════════════════════════════════

function JoinStep1({
  preview,
  isWP,
  entry,
  currency,
}: {
  preview: ChallengePreview;
  isWP: boolean;
  entry: number;
  currency: string;
}) {
  const inviterInitial = preview.createdByName?.charAt(0).toUpperCase() ?? 'K';
  const inviterName = preview.createdByName ?? 'Someone';
  const totalSoFar = preview.winnerPool?.totalPoolAmount ?? 0;
  const maxPool = entry * (preview.winnerPool?.participantMaximum ?? 0);
  const joinedCount = preview.participantCount ?? 0;
  const cap = preview.maxParticipants ?? preview.winnerPool?.participantMaximum ?? 0;

  return (
    <View style={{ padding: spacingB.lg }}>
      {isWP && (
        <View style={s.joinBanner}>
          <Text style={s.joinBannerText}>💸 CASH POOL CHALLENGE</Text>
        </View>
      )}

      <Title before="" highlight="Game on" after="!" />
      <Lead>You've been invited to a challenge.</Lead>

      <View style={s.joinHero}>
        <View style={s.inviteRow}>
          <View style={s.inviterAvatar}>
            <Text style={{ color: colorsB.paper, fontWeight: '900' }}>{inviterInitial}</Text>
          </View>
          <Text style={s.inviterText}>
            <Text style={{ fontWeight: '900' }}>{inviterName}</Text> invited you
          </Text>
        </View>
        <Text style={s.challengeName}>{preview.title}</Text>
        <View style={s.metaRow}>
          {preview.durationDays && (
            <Pill text={`📅 ${preview.durationDays} days`} />
          )}
          {preview.visibility && <Pill text={`🔒 ${labelVisibility(preview.visibility)}`} />}
        </View>
      </View>

      {isWP && (
        <View style={s.statGrid}>
          <StatTile label="Entry" value={`${currency} ${entry}`} sub="held until end" />
          <StatTile label="Pool so far" value={`${currency} ${totalSoFar}`} sub={`${joinedCount} of ${cap} joined`} />
          <StatTile label="Max prize" value={`${currency} ${maxPool}`} sub="if all join" />
          <StatTile label="Split" value="🤝 All" sub="completers split" />
        </View>
      )}

      {preview.startAt && (
        <View style={s.startsCard}>
          <Text style={s.startsText}>
            Starts <Text style={{ fontWeight: '900', color: colorsB.ink }}>{formatDate(preview.startAt)}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

function JoinStep2({
  entry,
  currency,
  acceptedTerms,
  setAcceptedTerms,
  confirmedAge,
  setConfirmedAge,
}: {
  entry: number;
  currency: string;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
  confirmedAge: boolean;
  setConfirmedAge: (v: boolean) => void;
}) {
  return (
    <View style={{ padding: spacingB.lg }}>
      <Title before="Before you" highlight="join" />
      <Lead>Real money — make sure you're in.</Lead>

      <View style={s.moneyBanner}>
        <View style={s.mbIcon}>
          <Text style={{ fontSize: 16 }}>💸</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.mbMsg}>{currency} {entry} will be charged now</Text>
          <Text style={s.mbSub}>Held by Stripe · refunded if cancelled</Text>
        </View>
      </View>

      <View style={[s.whatBlock, s.whatBlockWin]}>
        <Text style={[s.whatHead, { color: colorsB.green }]}>✓ You win if you</Text>
        <BulletPoint color={colorsB.green}>Complete the challenge requirements</BulletPoint>
        <BulletPoint color={colorsB.green}>Get a share of the pool</BulletPoint>
        <BulletPoint color={colorsB.green}>Build a streak on your profile</BulletPoint>
      </View>

      <View style={[s.whatBlock, s.whatBlockRisk]}>
        <Text style={[s.whatHead, { color: colorsB.orangeDeep }]}>⚠️ You lose if you</Text>
        <BulletPoint color={colorsB.orange}>Miss your target or fail too many days</BulletPoint>
        <BulletPoint color={colorsB.orange}>Cancel after the challenge starts</BulletPoint>
        <BulletPoint color={colorsB.orange}>Get disqualified for cheating</BulletPoint>
      </View>

      <CheckRow
        checked={confirmedAge}
        onPress={() => setConfirmedAge(!confirmedAge)}
        text="I'm 18+ &amp; understand this is real money"
      />
      <CheckRow
        checked={acceptedTerms}
        onPress={() => setAcceptedTerms(!acceptedTerms)}
        text="I've read the"
        bold="Winner Pool Terms"
      />
    </View>
  );
}

function JoinStep3({ entry, currency }: { entry: number; currency: string }) {
  return (
    <View style={{ padding: spacingB.lg }}>
      <Title before="Pay" highlight={`${currency} ${entry}`} after="to join" />
      <Lead>Held by Stripe until the challenge ends.</Lead>

      <View style={s.paySummary}>
        <PayRow label="Pool entry" value={`${currency} ${entry.toFixed(2)}`} />
        <PayRow label="Platform fee" value={`${currency} 0.00`} />
        <View style={s.payDivider} />
        <PayRow label="Total today" value={`${currency} ${entry.toFixed(2)}`} bold />
      </View>

      <Text style={s.paySection}>Payment method</Text>
      <View style={s.payMethod}>
        <View style={s.cardIcon}>
          <Text style={{ color: colorsB.yellow, fontSize: 10, fontWeight: '900' }}>VISA</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.payMethodName}>•••• 4242</Text>
          <Text style={s.payMethodSub}>Default · exp 12/27</Text>
        </View>
        <View style={s.payDot} />
      </View>

      <Text style={s.secureNote}>🔒 256-bit secured · held by Stripe</Text>
    </View>
  );
}

function JoinStep4({
  entry,
  currency,
  preview,
}: {
  entry: number;
  currency: string;
  preview: ChallengePreview;
}) {
  const joined = (preview.participantCount ?? 0) + 1;
  const min = preview.minParticipants ?? 2;
  const needed = Math.max(0, min - joined);

  return (
    <View style={{ padding: spacingB.lg }}>
      <View style={s.celebration}>
        <Text style={s.bigEmoji}>🎉</Text>
        <Text style={s.celebrationTitle}>You're in!</Text>
        <Text style={s.celebrationSub}>{preview.title}</Text>
      </View>

      <View style={s.heldCard}>
        <Text style={s.heldLabel}>Your entry</Text>
        <Text style={s.heldAmount}>{currency} {entry.toFixed(2)}</Text>
        <Text style={s.heldStatus}>held by Stripe</Text>
      </View>

      <View style={s.squadStatus}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '900' }}>
            Squad <Text style={{ fontSize: 10, color: colorsB.inkSoft, fontWeight: '600' }}>{joined} of {min} min</Text>
          </Text>
          <View style={s.progressPill}>
            <Text style={s.progressPillText}>
              {needed === 0 ? '🚀 ready to start' : `need ${needed} more`}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.nextSteps}>
        <Text style={s.nextStepsHead}>What's next</Text>
        <NextStep>1h heads-up before challenge starts</NextStep>
        <NextStep>Daily nudges during the challenge</NextStep>
        <NextStep>Results &amp; payout within 24h of finish</NextStep>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Small components
// ════════════════════════════════════════════════════════════════════════

function Pill({ text }: { text: string }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillText}>{text}</Text>
    </View>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  );
}

function BulletPoint({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3, gap: 8 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginTop: 7 }} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: colorsB.ink, flex: 1, lineHeight: 16 }}>{children}</Text>
    </View>
  );
}

function NextStep({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 2, gap: 6 }}>
      <Text style={{ color: colorsB.orange, fontWeight: '900', fontSize: 12 }}>→</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colorsB.ink, flex: 1, lineHeight: 16 }}>{children}</Text>
    </View>
  );
}

function PayRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colorsB.inkSoft }}>{label}</Text>
      <Text style={[{ fontSize: 12, fontWeight: '800', color: colorsB.ink }, bold && { fontSize: 14, fontWeight: '900' }]}>{value}</Text>
    </View>
  );
}

function CheckRow({ checked, onPress, text, bold }: { checked: boolean; onPress: () => void; text: string; bold?: string }) {
  return (
    <Pressable onPress={onPress} style={s.checkRow}>
      <View style={[s.checkBox, checked && s.checkBoxChecked]}>
        {checked && <Text style={s.checkMark}>✓</Text>}
      </View>
      <Text style={s.checkText}>
        {text}
        {bold && <> <Text style={{ fontWeight: '900' }}>{bold}</Text></>}
      </Text>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════

function ctaLabel(step: StepN, isWP: boolean, entry: number, currency: string, paying: boolean): string {
  if (paying) return 'Processing…';
  switch (step) {
    case 1: return isWP ? `Join the pool · ${currency} ${entry} →` : 'Join challenge →';
    case 2: return 'Continue to payment →';
    case 3: return `Pay & join →`;
    case 4: return 'Invite more friends →';
  }
}

function joinPill(step: StepN) {
  const labels = { 1: 'INVITE', 2: 'QUICK CHECK', 3: 'PAY ENTRY', 4: "✓ YOU'RE IN" } as const;
  const isFinal = step === 4;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: isFinal ? colorsB.green : colorsB.inkSoft }}>
        {labels[step]}
      </Text>
    </View>
  );
}

function labelVisibility(v: string): string {
  if (v === 'PRIVATE') return 'Invite';
  if (v === 'GROUP') return 'Group';
  if (v === 'PUBLIC') return 'Public';
  return v;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

function parseErrorMessage(raw: string): string {
  const m = raw.match(/\d{3}:\s*(.+)$/);
  if (!m) return raw;
  try {
    const body = JSON.parse(m[1] ?? '{}');
    return body.message || raw;
  } catch {
    return m[1] ?? raw;
  }
}

// ════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // Step 1
  joinBanner: {
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    ...shadowsB.card,
  },
  joinBannerText: { color: colorsB.paper, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  joinHero: {
    backgroundColor: colorsB.paper,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 18,
    padding: 14,
    marginVertical: 12,
    ...shadowsB.heroOrange,
  },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  inviterAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colorsB.green,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviterText: { fontSize: 11, fontWeight: '700', color: colorsB.inkSoft },
  challengeName: { fontSize: 18, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.4, marginBottom: 6, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: colorsB.ink },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  statTile: {
    width: '48.5%',
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    padding: 11,
    ...shadowsB.card,
  },
  statLabel: {
    fontSize: 9.5,
    color: colorsB.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
    marginBottom: 2,
  },
  statValue: { fontSize: 16, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.4 },
  statSub: { fontSize: 9, color: colorsB.inkSoft, marginTop: 1, fontWeight: '600' },

  startsCard: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
    ...shadowsB.card,
  },
  startsText: { fontSize: 11, fontWeight: '700', color: colorsB.inkSoft },

  // Step 2
  moneyBanner: {
    backgroundColor: colorsB.orange,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    ...shadowsB.card,
  },
  mbIcon: {
    width: 32,
    height: 32,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mbMsg: { fontSize: 12, fontWeight: '900', color: colorsB.paper },
  mbSub: { fontSize: 10.5, fontWeight: '600', color: colorsB.orangeSoft, marginTop: 2 },

  whatBlock: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
    ...shadowsB.card,
  },
  whatBlockWin: {},
  whatBlockRisk: {},
  whatHead: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 12,
    marginBottom: 8,
    ...shadowsB.card,
  },
  checkBox: {
    width: 22,
    height: 22,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: colorsB.green, borderColor: colorsB.green },
  checkMark: { color: colorsB.paper, fontSize: 13, fontWeight: '900' },
  checkText: { fontSize: 11.5, fontWeight: '700', color: colorsB.ink, lineHeight: 16, flex: 1 },

  // Step 3 — payment
  paySummary: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...shadowsB.card,
  },
  payDivider: {
    height: 2,
    backgroundColor: colorsB.line,
    marginVertical: 6,
    borderRadius: 1,
  },
  paySection: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colorsB.inkSoft,
    marginBottom: 6,
  },
  payMethod: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadowsB.card,
  },
  cardIcon: {
    width: 36,
    height: 26,
    backgroundColor: colorsB.ink,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payMethodName: { fontSize: 12.5, fontWeight: '800', color: colorsB.ink },
  payMethodSub: { fontSize: 10, fontWeight: '600', color: colorsB.inkSoft },
  payDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colorsB.orange, borderWidth: 2, borderColor: colorsB.ink },
  secureNote: {
    textAlign: 'center',
    fontSize: 10.5,
    color: colorsB.inkSoft,
    fontWeight: '600',
    marginBottom: 4,
  },

  // Step 4 — confirmation
  celebration: { alignItems: 'center', marginBottom: 16 },
  bigEmoji: { fontSize: 64, marginBottom: 4 },
  celebrationTitle: { fontSize: 26, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.5 },
  celebrationSub: { fontSize: 12, fontWeight: '700', color: colorsB.inkSoft, marginTop: 2 },

  heldCard: {
    backgroundColor: colorsB.green,
    borderWidth: 2.5,
    borderColor: colorsB.ink,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  heldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colorsB.paper, marginBottom: 2 },
  heldAmount: { fontSize: 30, fontWeight: '900', color: colorsB.paper, letterSpacing: -0.8 },
  heldStatus: { fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 4 },

  squadStatus: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    ...shadowsB.card,
  },
  progressPill: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.green,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
  },
  progressPillText: { fontSize: 10, fontWeight: '800', color: '#1f3a1d' },

  nextSteps: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colorsB.ink,
    borderRadius: 12,
    padding: 11,
  },
  nextStepsHead: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colorsB.inkSoft,
    marginBottom: 5,
  },
});
