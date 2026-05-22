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

import { apiRequest } from '../../lib/api';
import { colors, radius, shadow } from '../../lib/theme';

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
      const [meRes, activity, { method }, heatmap, achievements] = await Promise.all([
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
      ]);
      setData({
        user: meRes.user,
        stats: activity.stats,
        method,
        isAdmin: meRes.isAdmin,
        canCreateChallenges: meRes.canCreateChallenges,
        heatmap,
        achievements,
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
          <ActivityIndicator />
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Profile</Text>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user?.name ?? email}</Text>
            <Text style={styles.email}>{email}</Text>
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          </View>
        </View>

        {data.heatmap ? <Heatmap data={data.heatmap} /> : null}

        {data.achievements ? <Achievements data={data.achievements} /> : null}

        <Section title="Challenge Stats">
          <Row label="Challenges entered" value={String(entered)} />
          <Row label="Challenges won" value={`${data.stats.won}  (${winRate}%)`} />
          <Row label="Current streak" value={`${user?.currentStreak ?? 0}${(user?.currentStreak ?? 0) > 0 ? ' 🔥' : ''}`} />
          <Row label="Longest streak" value={`${user?.longestStreak ?? 0} 🔥`} />
          <Row label="Total earned" value={`$${totalWon.toFixed(2)}`} />
          <Row label="Total lost" value={`$${totalLost.toFixed(2)}`} />
          <Row label="Net" value={`${net >= 0 ? '+' : ''}$${net.toFixed(2)}`} bold />
        </Section>

        <Section title="Settings">
          <Row label="Timezone" value={user?.timezone ?? '—'} />
          <Toggle
            label="Morning kickoff"
            value={notif.morning}
            onChange={(v) => setNotif((n) => ({ ...n, morning: v }))}
          />
          <Toggle
            label="Danger zone warning"
            value={notif.danger}
            onChange={(v) => setNotif((n) => ({ ...n, danger: v }))}
          />
          <Toggle
            label="Last hour panic"
            value={notif.panic}
            onChange={(v) => setNotif((n) => ({ ...n, panic: v }))}
          />
          <Toggle
            label="Social join alerts"
            value={notif.social}
            onChange={(v) => setNotif((n) => ({ ...n, social: v }))}
          />
          <Text style={styles.note}>Notification toggles are local for now — server-side preferences land in v1.1.</Text>
        </Section>

        <Section title="Payment">
          {data.method ? (
            <Row
              label="Card on file"
              value={`${data.method.brand.toUpperCase()} •••• ${data.method.last4}  Exp ${String(data.method.expMonth).padStart(2, '0')}/${String(data.method.expYear).slice(-2)}`}
            />
          ) : (
            <Row label="Card on file" value="None" />
          )}
          <Pressable
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
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>{data.method ? 'Replace test card (dev)' : 'Attach test card (dev)'}</Text>
          </Pressable>
        </Section>

        <Section title="Legal">
          <Pressable onPress={() => router.push('/(legal)/privacy')} style={styles.linkRow}>
            <Text style={styles.linkRowText}>Privacy Policy</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(legal)/terms')} style={styles.linkRow}>
            <Text style={styles.linkRowText}>Terms of Service</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </Section>

        <Section title="Creator">
          {data.canCreateChallenges ? (
            <Pressable
              onPress={() => router.push('/admin/create-challenge')}
              style={styles.linkRow}
            >
              <Text style={styles.linkRowText}>
                {data.isAdmin ? '⚡ Create challenge (admin)' : '⚡ Create challenge'}
              </Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ) : data.user?.creatorStatus === 'APPLIED' ? (
            <Row label="Application status" value="Pending review" />
          ) : data.user?.creatorStatus === 'REJECTED' ? (
            <Row label="Application status" value="Rejected" />
          ) : (
            <Pressable
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
              style={styles.linkRow}
            >
              <Text style={styles.linkRowText}>Become a creator</Text>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          )}
        </Section>

        <Section title="Account">
          <Pressable onPress={() => signOut()} style={styles.linkRow}>
            <Text style={styles.linkRowText}>Sign out</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Pressable onPress={() => setShowDelete(true)} style={styles.linkRow}>
            <Text style={[styles.linkRowText, { color: '#b91c1c' }]}>Delete account</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </Section>
      </ScrollView>

      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>
              This will delete your user record, step logs, transactions, and Stripe customer. You
              can't undo this. Type{' '}
              <Text style={{ fontWeight: '700' }}>DELETE</Text> below to confirm.
            </Text>
            <TextInput
              placeholder="DELETE"
              autoCapitalize="characters"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              style={styles.input}
            />
            {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => {
                  setShowDelete(false);
                  setDeleteConfirm('');
                  setDeleteError(null);
                }}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  (pressed || deleting) && { opacity: 0.85 },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Delete forever</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Heatmap({ data }: { data: HeatmapData }) {
  // Group days into weeks. The grid reads top→bottom = Sun..Sat, left→right = oldest..newest.
  // We pad the front so column 0 starts on a Sunday.
  const weeks = useMemo(() => {
    const firstDay = data.days[0];
    if (!firstDay) return [] as Array<Array<{ date: string; count: number } | null>>;
    const first = new Date(`${firstDay.date}T00:00:00Z`);
    const firstDow = first.getUTCDay(); // 0..6
    const padded: Array<{ date: string; count: number } | null> = [];
    for (let i = 0; i < firstDow; i++) padded.push(null);
    padded.push(...data.days);
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: Array<Array<{ date: string; count: number } | null>> = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  }, [data.days]);

  // Find month label positions: show label at the column where a new month starts.
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
    <View style={hmStyles.wrap}>
      <View style={hmStyles.heroRow}>
        <View style={hmStyles.heroItem}>
          <Text style={hmStyles.heroValue}>
            {data.crossStreak}
            {data.crossStreak > 0 ? ' 🔥' : ''}
          </Text>
          <Text style={hmStyles.heroLabel}>Day streak</Text>
        </View>
        <View style={hmStyles.heroDivider} />
        <View style={hmStyles.heroItem}>
          <Text style={hmStyles.heroValue}>{data.totalActiveDays}</Text>
          <Text style={hmStyles.heroLabel}>Active days</Text>
        </View>
        <View style={hmStyles.heroDivider} />
        <View style={hmStyles.heroItem}>
          <Text style={hmStyles.heroValue}>{data.longestCrossStreak}</Text>
          <Text style={hmStyles.heroLabel}>Longest</Text>
        </View>
      </View>

      <Text style={hmStyles.sectionTitle}>Activity (past year)</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        <View>
          {/* Month labels */}
          <View style={{ height: 14, flexDirection: 'row' }}>
            {weeks.map((_, idx) => {
              const ml = monthLabels.find((l) => l.col === idx);
              return (
                <View
                  key={`m${idx}`}
                  style={{ width: cellSize + cellGap, alignItems: 'flex-start' }}
                >
                  {ml ? <Text style={hmStyles.monthLabel}>{ml.label}</Text> : null}
                </View>
              );
            })}
          </View>
          {/* Grid */}
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

      <View style={hmStyles.legendRow}>
        <Text style={hmStyles.legendLabel}>Less</Text>
        {[0, 1, 2, 3].map((lvl) => (
          <View
            key={lvl}
            style={[hmStyles.legendCell, { backgroundColor: cellColor(lvl === 0 ? 0 : lvl) }]}
          />
        ))}
        <Text style={hmStyles.legendLabel}>More</Text>
      </View>
    </View>
  );
}

function cellColor(count: number) {
  if (count <= 0) return '#EDEDED';
  if (count === 1) return '#A7E0AF';
  if (count === 2) return '#5FBB6D';
  return colors.primary;
}

const hmStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  heroItem: { flex: 1, alignItems: 'center', gap: 2 },
  heroDivider: { width: 1, height: 32, backgroundColor: colors.mintDark },
  heroValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  monthLabel: { fontSize: 9, color: colors.textFaint, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  legendCell: { width: 11, height: 11, borderRadius: 2 },
  legendLabel: { fontSize: 10, color: colors.textFaint, marginHorizontal: 2 },
});

function Achievements({ data }: { data: AchievementsResponse }) {
  // Show unlocked first, then locked but in-progress (current > 0), then locked-zero.
  const sorted = useMemo(() => {
    const unlocked = data.achievements.filter((a) => a.unlocked);
    const inProgress = data.achievements
      .filter((a) => !a.unlocked && a.current > 0)
      .sort((a, b) => b.current / b.target - a.current / a.target);
    const locked = data.achievements.filter((a) => !a.unlocked && a.current === 0);
    return [...unlocked, ...inProgress, ...locked];
  }, [data.achievements]);

  return (
    <View style={achStyles.wrap}>
      <View style={achStyles.headerRow}>
        <Text style={achStyles.sectionTitle}>Achievements</Text>
        <Text style={achStyles.count}>
          {data.unlockedCount} / {data.totalCount}
        </Text>
      </View>
      <View style={achStyles.grid}>
        {sorted.map((a) => (
          <AchievementCard key={a.id} a={a} />
        ))}
      </View>
    </View>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const pct = a.target > 0 ? Math.min(1, a.current / a.target) : 0;
  return (
    <View style={[achStyles.card, !a.unlocked && achStyles.cardLocked]}>
      <Text style={[achStyles.emoji, !a.unlocked && achStyles.emojiLocked]}>{a.emoji}</Text>
      <Text
        style={[achStyles.title, !a.unlocked && achStyles.titleLocked]}
        numberOfLines={1}
      >
        {a.title}
      </Text>
      <Text style={achStyles.desc} numberOfLines={2}>
        {a.description}
      </Text>
      {a.unlocked ? (
        <View style={achStyles.unlockedBadge}>
          <Text style={achStyles.unlockedBadgeText}>UNLOCKED</Text>
        </View>
      ) : (
        <View style={{ width: '100%', gap: 4 }}>
          <View style={achStyles.progressTrack}>
            <View style={[achStyles.progressFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={achStyles.progressText}>
            {a.current} / {a.target}
          </Text>
        </View>
      )}
    </View>
  );
}

const achStyles = StyleSheet.create({
  wrap: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  count: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '31%',
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadow.card,
  },
  cardLocked: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  emoji: { fontSize: 28 },
  emojiLocked: { opacity: 0.35 },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  titleLocked: { color: colors.textMuted },
  desc: {
    fontSize: 10,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 13,
    minHeight: 26,
  },
  unlockedBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  unlockedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressText: {
    fontSize: 9,
    color: colors.textFaint,
    textAlign: 'center',
    fontWeight: '700',
  },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, gap: 20, paddingBottom: 60 },
  eyebrow: { color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  identityCard: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3FA84E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 22 },
  name: { fontWeight: '700', fontSize: 18 },
  email: { color: '#666', fontSize: 13 },
  memberSince: { color: '#888', fontSize: 12 },

  section: { gap: 10 },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { color: '#555', fontSize: 14, flex: 1 },
  rowValue: { color: '#111', fontWeight: '600', fontSize: 14 },
  note: { color: '#888', fontSize: 12, fontStyle: 'italic', paddingTop: 4 },

  linkBtn: { paddingVertical: 10, alignItems: 'flex-start' },
  linkText: { color: '#0066cc', fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkRowText: { fontSize: 15, fontWeight: '500' },
  chev: { color: '#bbb', fontSize: 24, fontWeight: '300' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 14, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalBody: { color: '#444', lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
  },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: '#f0f0f0' },
  modalBtnSecondaryText: { color: '#111', fontWeight: '600' },
  modalBtnDanger: { backgroundColor: '#b91c1c' },
  modalBtnDangerText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c' },
});
