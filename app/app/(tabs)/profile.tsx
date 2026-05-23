/**
 * Profile — Direction B reskin.
 *
 * Cream bg, chunky offset cards, orange avatar, heatmap recoloured
 * to the orange/green ladder. Logic (delete account, creator apply,
 * test-card attach) is unchanged from legacy build.
 */

import { useAuth, useUser } from '../../lib/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BButton,
  BCard,
  BPill,
  BRow,
  BSection,
  ScreenHeader,
} from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type ProfileData = {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    timezone: string;
    currentStreak: number;
    longestStreak: number;
    totalWon: string;
    totalLost: string;
    creatorStatus: 'NONE' | 'APPLIED' | 'APPROVED' | 'REJECTED';
    createdAt: string;
  } | null;
  stats: {
    won: number;
    lost: number;
    earned: number;
  };
  method: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  isAdmin: boolean;
  canCreateChallenges: boolean;
  heatmap: HeatmapData | null;
  achievements: AchievementsResponse | null;
  payouts: { connected: boolean; status: string } | null;
};

type HeatmapData = {
  days: Array<{ date: string; count: number }>;
  crossStreak: number;
  longestCrossStreak: number;
  totalActiveDays: number;
  categories: Array<{ key: string; count: number }>;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  current: number;
  unlocked: boolean;
};

type AchievementsResponse = {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
};

export default function ProfileTab() {
  const { signOut, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState({ morning: true, danger: true, panic: true, social: true });
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [meRes, activity, { method }, heatmap, achievements, payouts] = await Promise.all([
        apiRequest<{ user: ProfileData['user']; isAdmin: boolean; canCreateChallenges: boolean }>(
          '/users/me',
          { token },
        ),
        apiRequest<{ stats: { won: number; lost: number; earned: number } }>(
          '/users/me/activity',
          { token },
        ),
        apiRequest<{ method: ProfileData['method'] }>('/payments/method', { token }),
        apiRequest<HeatmapData>('/users/me/heatmap', { token }).catch(() => null),
        apiRequest<AchievementsResponse>('/users/me/achievements', { token }).catch(() => null),
        apiRequest<{ connected: boolean; status: string }>('/api/stripe-connect/status', {
          token,
        }).catch(() => null),
      ]);
      setData({
        user: meRes.user,
        stats: activity.stats,
        method,
        isAdmin: meRes.isAdmin,
        canCreateChallenges: meRes.canCreateChallenges,
        heatmap,
        achievements,
        payouts,
      });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, []),
  );

  const onDelete = async () => {
    if (deleteConfirm !== 'DELETE') {
      setDeleteError('Type DELETE in caps to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      await apiRequest('/users/me', { method: 'DELETE', token });
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colorsB.orange} />
        </View>
      </SafeAreaView>
    );
  }

  const user = data.user;
  const email = user?.email ?? clerkUser?.email ?? '—';
  const initial = (user?.name?.trim() || email).charAt(0).toUpperCase();
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const totalWon = Number(user?.totalWon ?? 0);
  const totalLost = Number(user?.totalLost ?? 0);
  const net = totalWon - totalLost;
  const entered = data.stats.won + data.stats.lost;
  const winRate = entered > 0 ? Math.round((data.stats.won / entered) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader eyebrow="Profile" highlight="You" after="✦" />

        <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
          {/* Identity card */}
          <BCard large style={styles.identityCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{user?.name ?? email}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <BPill label={`Member since ${memberSince}`} tone="neutral" size="sm" />
                {data.isAdmin ? <BPill label="ADMIN" tone="ink" size="sm" /> : null}
              </View>
            </View>
          </BCard>

          {data.heatmap ? <Heatmap data={data.heatmap} /> : null}

          {data.achievements ? <Achievements data={data.achievements} /> : null}

          {/* Challenge stats */}
          <BSection title="Challenge stats">
            <BCard>
              <BRow label="Challenges entered" value={String(entered)} />
              <BRow label="Challenges won" value={`${data.stats.won} (${winRate}%)`} />
              <BRow
                label="Current streak"
                value={`${user?.currentStreak ?? 0}${(user?.currentStreak ?? 0) > 0 ? ' 🔥' : ''}`}
              />
              <BRow label="Longest streak" value={`${user?.longestStreak ?? 0} 🔥`} />
              <BRow label="Total earned" value={`$${totalWon.toFixed(2)}`} />
              <BRow label="Total lost" value={`$${totalLost.toFixed(2)}`} />
              <BRow label="Net" value={`${net >= 0 ? '+' : ''}$${net.toFixed(2)}`} bold />
            </BCard>
          </BSection>

          {/* Settings */}
          <BSection title="Settings">
            <BCard>
              <BRow label="Timezone" value={user?.timezone ?? '—'} />
              <ToggleRow
                label="Morning kickoff"
                value={notif.morning}
                onChange={(v) => setNotif((n) => ({ ...n, morning: v }))}
              />
              <ToggleRow
                label="Danger zone warning"
                value={notif.danger}
                onChange={(v) => setNotif((n) => ({ ...n, danger: v }))}
              />
              <ToggleRow
                label="Last hour panic"
                value={notif.panic}
                onChange={(v) => setNotif((n) => ({ ...n, panic: v }))}
              />
              <ToggleRow
                label="Social join alerts"
                value={notif.social}
                onChange={(v) => setNotif((n) => ({ ...n, social: v }))}
              />
              <Text style={styles.note}>
                Notification toggles are local for now — server-side preferences land in v1.1.
              </Text>
            </BCard>
          </BSection>

          {/* Payment */}
          <BSection title="Payment">
            <BCard>
              <BRow
                label="Card on file"
                value={
                  data.method
                    ? `${data.method.brand.toUpperCase()} •••• ${data.method.last4}  Exp ${String(
                        data.method.expMonth,
                      ).padStart(2, '0')}/${String(data.method.expYear).slice(-2)}`
                    : 'None'
                }
              />
              <BRow
                label="💸 Payouts (Stripe Connect)"
                value={payoutsRowValue(data.payouts)}
                onPress={() => router.push('/payouts' as never)}
              />
              <BButton
                label={data.method ? 'Replace test card (dev)' : 'Attach test card (dev)'}
                tone="paper"
                small
                onPress={async () => {
                  try {
                    const token = await getToken();
                    await apiRequest('/payments/dev-attach-test-card', { method: 'POST', token });
                    await load();
                    Alert.alert('Updated', 'Test card attached.');
                  } catch (err) {
                    Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
                  }
                }}
                style={{ marginTop: spacingB.md, alignSelf: 'flex-start' }}
              />
            </BCard>
          </BSection>

          {/* Legal */}
          <BSection title="Legal">
            <BCard>
              <BRow label="Terms of Service" onPress={() => router.push('/(legal)/terms')} />
              <BRow label="Privacy Policy" onPress={() => router.push('/(legal)/privacy')} />
              <BRow label="Refund Policy" onPress={() => router.push('/(legal)/refund' as never)} />
              <BRow
                label="Dispute Policy"
                onPress={() => router.push('/(legal)/dispute' as never)}
              />
            </BCard>
          </BSection>

          {/* Creator */}
          <BSection title="Creator">
            <BCard>
              {data.isAdmin ? (
                <BRow
                  label="🛡️ Review queue"
                  onPress={() => router.push('/admin/queue' as never)}
                />
              ) : null}
              {data.canCreateChallenges ? (
                <BRow
                  label={data.isAdmin ? '⚡ Create challenge (admin)' : '⚡ Create challenge'}
                  onPress={() => router.push('/admin/create-challenge')}
                />
              ) : data.user?.creatorStatus === 'APPLIED' ? (
                <BRow label="Application status" value="Pending review" />
              ) : data.user?.creatorStatus === 'REJECTED' ? (
                <BRow label="Application status" value="Rejected" />
              ) : (
                <BRow
                  label="Become a creator"
                  onPress={async () => {
                    try {
                      const token = await getToken();
                      await apiRequest('/users/me/apply-creator', {
                        method: 'POST',
                        token,
                        body: {},
                      });
                      await load();
                      Alert.alert('Submitted', 'Your application is under review.');
                    } catch (err) {
                      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                />
              )}
            </BCard>
          </BSection>

          {/* Account */}
          <BSection title="Account">
            <BCard>
              <BRow label="Sign out" onPress={() => signOut()} />
              <BRow label="Delete account" danger onPress={() => setShowDelete(true)} />
            </BCard>
          </BSection>
        </View>
      </ScrollView>

      <Modal
        visible={showDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDelete(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>
              This will delete your user record, step logs, transactions, and Stripe customer. You
              can't undo this. Type <Text style={{ fontWeight: '900' }}>DELETE</Text> below to confirm.
            </Text>
            <TextInput
              placeholder="DELETE"
              autoCapitalize="characters"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              style={styles.input}
              placeholderTextColor={colorsB.inkFaint}
            />
            {deleteError ? (
              <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{deleteError}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacingB.sm }}>
              <BButton
                label="Cancel"
                tone="paper"
                onPress={() => {
                  setShowDelete(false);
                  setDeleteConfirm('');
                  setDeleteError(null);
                }}
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={onDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  (pressed || deleting) && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator color={colorsB.paper} />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete forever</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Heatmap (recoloured to B palette) ────────────────────────────────────

function Heatmap({ data }: { data: HeatmapData }) {
  const weeks = useMemo(() => {
    const firstDay = data.days[0];
    if (!firstDay) return [] as Array<Array<{ date: string; count: number } | null>>;
    const first = new Date(`${firstDay.date}T00:00:00Z`);
    const firstDow = first.getUTCDay();
    const padded: Array<{ date: string; count: number } | null> = [];
    for (let i = 0; i < firstDow; i++) padded.push(null);
    padded.push(...data.days);
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: Array<Array<{ date: string; count: number } | null>> = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  }, [data.days]);

  const monthLabels = useMemo(() => {
    const labels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    weeks.forEach((col, idx) => {
      const firstReal = col.find((c) => c !== null);
      if (!firstReal) return;
      const m = new Date(`${firstReal.date}T00:00:00Z`).getUTCMonth();
      if (m !== lastMonth) {
        labels.push({
          col: idx,
          label: new Date(`${firstReal.date}T00:00:00Z`).toLocaleString('en-US', {
            month: 'short',
            timeZone: 'UTC',
          }),
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  const cellSize = 11;
  const cellGap = 3;

  return (
    <BCard large>
      <View style={styles.hmHeroRow}>
        <View style={styles.hmHeroItem}>
          <Text style={styles.hmHeroValue}>
            {data.crossStreak}
            {data.crossStreak > 0 ? ' 🔥' : ''}
          </Text>
          <Text style={styles.hmHeroLabel}>Day streak</Text>
        </View>
        <View style={styles.hmDivider} />
        <View style={styles.hmHeroItem}>
          <Text style={styles.hmHeroValue}>{data.totalActiveDays}</Text>
          <Text style={styles.hmHeroLabel}>Active days</Text>
        </View>
        <View style={styles.hmDivider} />
        <View style={styles.hmHeroItem}>
          <Text style={styles.hmHeroValue}>{data.longestCrossStreak}</Text>
          <Text style={styles.hmHeroLabel}>Longest</Text>
        </View>
      </View>

      <Text style={[typeB.eyebrow, { marginTop: spacingB.lg, marginBottom: spacingB.sm }]}>
        Activity · past year
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        <View>
          <View style={{ height: 14, flexDirection: 'row' }}>
            {weeks.map((_, idx) => {
              const ml = monthLabels.find((l) => l.col === idx);
              return (
                <View key={`m${idx}`} style={{ width: cellSize + cellGap, alignItems: 'flex-start' }}>
                  {ml ? <Text style={styles.hmMonthLabel}>{ml.label}</Text> : null}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {weeks.map((col, idx) => (
              <View key={`c${idx}`} style={{ marginRight: cellGap }}>
                {col.map((cell, r) => (
                  <View
                    key={`c${idx}-r${r}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 2,
                      marginBottom: cellGap,
                      backgroundColor: cellColor(cell?.count ?? 0),
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.hmLegendRow}>
        <Text style={styles.hmLegendLabel}>Less</Text>
        {[0, 1, 2, 3].map((lvl) => (
          <View
            key={lvl}
            style={[styles.hmLegendCell, { backgroundColor: cellColor(lvl === 0 ? 0 : lvl) }]}
          />
        ))}
        <Text style={styles.hmLegendLabel}>More</Text>
      </View>
    </BCard>
  );
}

function cellColor(count: number) {
  if (count <= 0) return colorsB.bgWarm;
  if (count === 1) return '#fbd5b0'; // light orange
  if (count === 2) return '#ff8c5a'; // medium orange
  return colorsB.orange;
}

// ─── Achievements grid ────────────────────────────────────────────────────

function Achievements({ data }: { data: AchievementsResponse }) {
  const sorted = useMemo(() => {
    const unlocked = data.achievements.filter((a) => a.unlocked);
    const inProgress = data.achievements
      .filter((a) => !a.unlocked && a.current > 0)
      .sort((a, b) => b.current / b.target - a.current / a.target);
    const locked = data.achievements.filter((a) => !a.unlocked && a.current === 0);
    return [...unlocked, ...inProgress, ...locked];
  }, [data.achievements]);

  return (
    <BSection
      title="Achievements"
      right={
        <Text style={styles.achCount}>
          {data.unlockedCount} / {data.totalCount}
        </Text>
      }
    >
      <View style={styles.achGrid}>
        {sorted.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </View>
    </BSection>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const pct = a.target > 0 ? Math.min(1, a.current / a.target) : 0;
  return (
    <View style={[styles.achCard, !a.unlocked && styles.achCardLocked]}>
      <Text style={[styles.achEmoji, !a.unlocked && styles.achEmojiLocked]}>{a.emoji}</Text>
      <Text
        style={[styles.achTitle, !a.unlocked && styles.achTitleLocked]}
        numberOfLines={1}
      >
        {a.title}
      </Text>
      <Text style={styles.achDesc} numberOfLines={2}>
        {a.description}
      </Text>
      {a.unlocked ? (
        <View style={styles.achUnlockedBadge}>
          <Text style={styles.achUnlockedText}>UNLOCKED</Text>
        </View>
      ) : (
        <View style={{ width: '100%', gap: 4 }}>
          <View style={styles.achProgressTrack}>
            <View style={[styles.achProgressFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={styles.achProgressText}>
            {a.current} / {a.target}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────

// Stripe Connect status → short summary string for the Profile row.
function payoutsRowValue(payouts: ProfileData['payouts']): string {
  if (!payouts || !payouts.connected) return 'Not set up';
  if (payouts.status === 'ACTIVE') return 'Active ✓';
  if (payouts.status === 'PENDING') return 'Finish onboarding';
  if (payouts.status === 'RESTRICTED') return 'Action required';
  if (payouts.status === 'DISABLED') return 'Disabled';
  return payouts.status;
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <BRow
      label={label}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: colorsB.orange, false: colorsB.line }}
          thumbColor={colorsB.paper}
        />
      }
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  identityCard: {
    flexDirection: 'row',
    gap: spacingB.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowsB.card,
  },
  avatarText: { color: colorsB.paper, fontWeight: '900', fontSize: 24 },
  name: { fontWeight: '900', fontSize: 18, color: colorsB.ink, letterSpacing: -0.3 },
  email: { color: colorsB.inkSoft, fontSize: 12, fontWeight: '700' },

  note: {
    color: colorsB.inkFaint,
    fontSize: 11,
    fontStyle: 'italic',
    paddingTop: spacingB.sm,
    fontWeight: '600',
  },

  // Delete modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingB.xl,
  },
  modalCard: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.xl,
    gap: spacingB.md,
    width: '100%',
    ...shadowsB.cardLg,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.3 },
  modalBody: { color: colorsB.inkSoft, lineHeight: 20, fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingHorizontal: spacingB.lg,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '900',
    color: colorsB.ink,
    backgroundColor: colorsB.bg,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: colorsB.orangeDeep,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowsB.card,
  },
  deleteBtnText: { color: colorsB.paper, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  // Heatmap styles
  hmHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorsB.orangeSoft,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  hmHeroItem: { flex: 1, alignItems: 'center', gap: 2 },
  hmDivider: { width: 1.5, height: 32, backgroundColor: colorsB.ink, opacity: 0.18 },
  hmHeroValue: { fontSize: 22, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.3 },
  hmHeroLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  hmMonthLabel: { fontSize: 9, color: colorsB.inkFaint, fontWeight: '700' },
  hmLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
    marginTop: spacingB.sm,
  },
  hmLegendCell: { width: 11, height: 11, borderRadius: 2 },
  hmLegendLabel: { fontSize: 10, color: colorsB.inkFaint, marginHorizontal: 2, fontWeight: '700' },

  // Achievement card
  achCount: { fontSize: 12, fontWeight: '900', color: colorsB.orange },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achCard: {
    width: '31%',
    backgroundColor: colorsB.paper,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colorsB.orange,
    ...shadowsB.card,
  },
  achCardLocked: {
    backgroundColor: colorsB.bgWarm,
    borderColor: colorsB.line,
    shadowOpacity: 0,
    elevation: 0,
  },
  achEmoji: { fontSize: 28 },
  achEmojiLocked: { opacity: 0.4 },
  achTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colorsB.ink,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  achTitleLocked: { color: colorsB.inkSoft },
  achDesc: {
    fontSize: 10,
    color: colorsB.inkFaint,
    textAlign: 'center',
    lineHeight: 13,
    minHeight: 26,
    fontWeight: '600',
  },
  achUnlockedBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colorsB.greenSoft,
    borderWidth: 1,
    borderColor: colorsB.green,
  },
  achUnlockedText: {
    fontSize: 9,
    fontWeight: '900',
    color: colorsB.green,
    letterSpacing: 0.8,
  },
  achProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colorsB.line,
    overflow: 'hidden',
  },
  achProgressFill: { height: '100%', backgroundColor: colorsB.orange },
  achProgressText: {
    fontSize: 9,
    color: colorsB.inkFaint,
    textAlign: 'center',
    fontWeight: '900',
  },
});
