/**
 * Admin hub — review queues.
 *
 * Single screen that fans out into:
 *   - challenges in PENDING_REVIEW (this task — #135)
 *   - submissions in PENDING_REVIEW (peer-review timed out → admin)
 *   - disputes in OPEN/UNDER_REVIEW
 *   - Winner Pool payouts ON_HOLD waiting for approval (#136)
 *
 * Gated by ADMIN_EMAIL on the server. Mobile profile only links here when
 * `isAdmin` is true.
 */

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BCard, BEmpty, BPill, ScreenHeader } from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  creatorIntent: string | null;
  visibility: string | null;
  rewardType: string | null;
  riskLevel: string | null;
  moderationReason: string | null;
  creatorName: string;
  creatorEmail: string;
  creatorTrustScore: number | null;
  createdAt: string;
};

type SubmissionRow = {
  id: string;
  challengeId: string;
  challengeTitle: string;
  submitterName: string;
  submitterEmail: string;
  submissionType: string;
  evidenceUrl: string | null;
  metricValue: number | null;
  submittedAt: string;
  confidenceScore: number;
};

type DisputeRow = {
  id: string;
  challengeId: string;
  challengeTitle: string;
  status: string;
  disputeReason: string;
  description: string | null;
  raiserName: string;
  raiserEmail: string;
  createdAt: string;
};

type PayoutRow = {
  poolId: string;
  challengeId: string;
  title: string;
  netPool: string | null;
  currency: string;
  payoutStatus: string;
  lifecycle: string | null;
};

type Tab = 'challenges' | 'submissions' | 'disputes' | 'payouts';

export default function AdminQueueScreen() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('challenges');
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      const [a, b, c, d] = await Promise.all([
        apiRequest<{ queue: ChallengeRow[] }>('/admin/challenges/review-queue', { token }).catch(
          () => ({ queue: [] as ChallengeRow[] }),
        ),
        apiRequest<{ queue: SubmissionRow[] }>('/admin/submissions/review-queue', { token }).catch(
          () => ({ queue: [] as SubmissionRow[] }),
        ),
        apiRequest<{ queue: DisputeRow[] }>('/admin/disputes/queue', { token }).catch(
          () => ({ queue: [] as DisputeRow[] }),
        ),
        apiRequest<{ queue: PayoutRow[] }>('/admin/winner-pool/payout-queue', { token }).catch(
          () => ({ queue: [] as PayoutRow[] }),
        ),
      ]);
      setChallenges(a.queue);
      setSubmissions(b.queue);
      setDisputes(c.queue);
      setPayouts(d.queue);
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
        <Text style={styles.headerTitle}>ADMIN</Text>
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
        <ScreenHeader eyebrow="Review queue" highlight="Triage" after="✦" />

        <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
          {error ? (
            <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
          ) : null}

          {/* Tab counts grid */}
          <View style={styles.tabRow}>
            <CountTile
              label="Challenges"
              count={challenges.length}
              active={tab === 'challenges'}
              onPress={() => setTab('challenges')}
            />
            <CountTile
              label="Submissions"
              count={submissions.length}
              active={tab === 'submissions'}
              onPress={() => setTab('submissions')}
            />
          </View>
          <View style={styles.tabRow}>
            <CountTile
              label="Disputes"
              count={disputes.length}
              active={tab === 'disputes'}
              onPress={() => setTab('disputes')}
            />
            <CountTile
              label="Payouts"
              count={payouts.length}
              active={tab === 'payouts'}
              onPress={() => setTab('payouts')}
            />
          </View>

          {/* Selected tab content */}
          {tab === 'challenges' ? (
            challenges.length === 0 ? (
              <BEmpty emoji="✓" title="Challenge queue clear" body="Nothing pending review." />
            ) : (
              <View style={{ gap: spacingB.lg }}>
                {challenges.map((c) => (
                  <ChallengeQueueCard
                    key={c.id}
                    row={c}
                    onPress={() => router.push(`/admin/challenge/${c.id}` as never)}
                  />
                ))}
              </View>
            )
          ) : null}

          {tab === 'submissions' ? (
            submissions.length === 0 ? (
              <BEmpty
                emoji="✓"
                title="Submission queue clear"
                body="No timed-out peer reviews need admin override."
              />
            ) : (
              <View style={{ gap: spacingB.lg }}>
                {submissions.map((s) => (
                  <SubmissionQueueCard
                    key={s.id}
                    row={s}
                    onPress={() =>
                      router.push(`/admin/challenge/${s.challengeId}` as never)
                    }
                  />
                ))}
              </View>
            )
          ) : null}

          {tab === 'disputes' ? (
            disputes.length === 0 ? (
              <BEmpty emoji="✓" title="Dispute queue clear" body="No active disputes." />
            ) : (
              <View style={{ gap: spacingB.lg }}>
                {disputes.map((d) => (
                  <DisputeQueueCard
                    key={d.id}
                    row={d}
                    onPress={() =>
                      router.push(`/admin/challenge/${d.challengeId}` as never)
                    }
                  />
                ))}
              </View>
            )
          ) : null}

          {tab === 'payouts' ? (
            payouts.length === 0 ? (
              <BEmpty
                emoji="✓"
                title="Payout queue clear"
                body="No Winner Pool payouts waiting on approval."
              />
            ) : (
              <View style={{ gap: spacingB.lg }}>
                {payouts.map((p) => (
                  <PayoutQueueCard
                    key={p.poolId}
                    row={p}
                    onPress={() =>
                      router.push(`/admin/challenge/${p.challengeId}` as never)
                    }
                  />
                ))}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tiles + Cards ────────────────────────────────────────────────────────

function CountTile({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const tone = count > 0 ? 'orange' : 'neutral';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.countTile,
        active && styles.countTileActive,
        pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
      ]}
    >
      <Text style={[styles.countLabel, active && { color: colorsB.paper }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Text style={[styles.countNum, active && { color: colorsB.yellow }]}>{count}</Text>
        {count > 0 && !active ? <BPill label="todo" tone={tone} size="sm" /> : null}
      </View>
    </Pressable>
  );
}

function ChallengeQueueCard({
  row,
  onPress,
}: {
  row: ChallengeRow;
  onPress: () => void;
}) {
  const riskTone =
    row.riskLevel === 'HIGH'
      ? 'orange'
      : row.riskLevel === 'MEDIUM'
        ? 'yellow'
        : row.riskLevel === 'PROHIBITED'
          ? 'orange'
          : 'green';
  const isWinnerPool = row.rewardType === 'WINNER_POOL';
  return (
    <BCard onPress={onPress} large>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <BPill label={row.riskLevel ?? 'LOW'} tone={riskTone} size="sm" />
      </View>
      {row.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {row.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <BPill label={row.creatorIntent ?? '—'} tone="neutral" size="sm" />
        <BPill label={row.visibility ?? '—'} tone="neutral" size="sm" />
        {row.category ? <BPill label={row.category} tone="neutral" size="sm" /> : null}
        {isWinnerPool ? <BPill label="💰 PAID" tone="orange" size="sm" /> : null}
      </View>

      <View style={styles.byline}>
        <Text style={styles.bylineLabel}>By</Text>
        <Text style={styles.bylineName}>{row.creatorName}</Text>
        <Text style={styles.bylineMeta}>
          · trust {row.creatorTrustScore ?? '—'} · {formatAge(row.createdAt)}
        </Text>
      </View>

      {row.moderationReason ? (
        <Text style={styles.modReason} numberOfLines={2}>
          🚧 {row.moderationReason}
        </Text>
      ) : null}
    </BCard>
  );
}

function SubmissionQueueCard({
  row,
  onPress,
}: {
  row: SubmissionRow;
  onPress: () => void;
}) {
  return (
    <BCard onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.submitterName}'s proof
        </Text>
        <BPill label={`${row.confidenceScore}%`} tone={row.confidenceScore >= 50 ? 'yellow' : 'orange'} size="sm" />
      </View>
      <Text style={styles.cardSub} numberOfLines={1}>
        on "{row.challengeTitle}" · {row.submissionType.toLowerCase()}
      </Text>
      <Text style={styles.byline}>
        <Text style={styles.bylineMeta}>{formatAge(row.submittedAt)}</Text>
      </Text>
    </BCard>
  );
}

function DisputeQueueCard({ row, onPress }: { row: DisputeRow; onPress: () => void }) {
  return (
    <BCard onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.disputeReason.replace(/_/g, ' ')}
        </Text>
        <BPill label={row.status} tone="orange" size="sm" />
      </View>
      <Text style={styles.cardSub} numberOfLines={1}>
        on "{row.challengeTitle}"
      </Text>
      {row.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          "{row.description}"
        </Text>
      ) : null}
      <View style={styles.byline}>
        <Text style={styles.bylineLabel}>By</Text>
        <Text style={styles.bylineName}>{row.raiserName}</Text>
        <Text style={styles.bylineMeta}>· {formatAge(row.createdAt)}</Text>
      </View>
    </BCard>
  );
}

function PayoutQueueCard({ row, onPress }: { row: PayoutRow; onPress: () => void }) {
  return (
    <BCard onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <BPill label={row.payoutStatus} tone="orange" size="sm" />
      </View>
      <View style={styles.payoutAmount}>
        <Text style={styles.payoutLabel}>Net pool</Text>
        <Text style={styles.payoutValue}>
          {row.currency} {Number(row.netPool ?? 0).toFixed(2)}
        </Text>
      </View>
      <Text style={styles.bylineMeta}>Lifecycle · {row.lifecycle ?? '—'}</Text>
    </BCard>
  );
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },

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

  tabRow: { flexDirection: 'row', gap: spacingB.md },
  countTile: {
    flex: 1,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    ...shadowsB.card,
  },
  countTileActive: { backgroundColor: colorsB.ink },
  countLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.inkSoft,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  countNum: {
    fontSize: 30,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -1,
  },

  // Card
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingB.md,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.3,
  },
  cardSub: { fontSize: 12, color: colorsB.inkSoft, fontWeight: '700', marginTop: 2 },
  cardDesc: { fontSize: 13, color: colorsB.inkSoft, fontWeight: '600', marginTop: 6, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: spacingB.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacingB.md },
  bylineLabel: { fontSize: 10, color: colorsB.inkFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  bylineName: { fontSize: 12, color: colorsB.ink, fontWeight: '900' },
  bylineMeta: { fontSize: 11, color: colorsB.inkFaint, fontWeight: '700' },
  modReason: {
    fontSize: 11,
    color: colorsB.orangeDeep,
    fontWeight: '800',
    marginTop: spacingB.sm,
    backgroundColor: colorsB.orangeSoft,
    borderRadius: radiusB.control,
    padding: spacingB.sm,
    lineHeight: 15,
  },

  payoutAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: spacingB.md,
  },
  payoutLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.inkFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  payoutValue: { fontSize: 22, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.4 },
});
