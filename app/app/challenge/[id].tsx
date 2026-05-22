import { useAuth } from '../../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
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

import { apiRequest } from '../../lib/api';
import { formatDateRange } from '../../lib/time';
import {
  CategoryKey,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  colors,
  radius,
  shadow,
} from '../../lib/theme';

type GameFormat = 'DAILY_STREAK' | 'WEEKLY_QUOTA' | 'COMPLETION_COUNT';

type ChallengeDetail = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  commitmentFee: number;
  dailyStepGoal: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  prizePool: number;
  maxParticipants: number | null;
  participantCount: number;
  qualifiedCount: number;
  heroImageUrl: string | null;
  gameFormat: GameFormat;
  activeStepGoal: number | null;
  powerStepGoal: number | null;
  weeklyActiveDays: number | null;
  weeklyPowerDays: number | null;
  weeklyFreeDays: number | null;
  category: CategoryKey | null;
  verificationMethod: 'AUTO_STEPS' | 'PHOTO_PROOF' | 'HONOR_TAP';
  targetDaysComplete: number | null;
  participants: Array<{
    userId: string;
    name: string | null;
    avatarUrl: string | null;
    status: string;
  }>;
  userParticipation: { id: string; status: string } | null;
};

type Method = { last4: string; brand: string } | null;
type LeaderboardRow = {
  userId: string;
  name: string;
  avatarInitial: string;
  status: 'ACTIVE' | 'QUALIFIED' | 'ELIMINATED';
  todaySteps: number;
  todayGoal: number;
  todayCompleted: boolean;
  daysCompleted: number;
  daysTotal: number;
  commitmentPaid: number;
  todayProgressId: string | null;
  todayCheerCount: number;
  todayCheerByViewer: boolean;
};

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [method, setMethod] = useState<Method>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const [{ challenge: c }, { method: m }, { rows: r }, { user }] = await Promise.all([
        apiRequest<{ challenge: ChallengeDetail }>(`/challenges/${id}`, { token }),
        apiRequest<{ method: Method }>('/payments/method', { token }),
        // Pass token so backend can determine viewer for cheer state.
        apiRequest<{ rows: LeaderboardRow[] }>(`/challenges/${id}/participants`, { token }),
        apiRequest<{ user: { id: string } | null }>('/users/me', { token }),
      ]);
      setChallenge(c);
      setMethod(m);
      setRows(r);
      setMeId(user?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => { void load(); }, [load]);

  const attachTestCard = async () => {
    setAttaching(true);
    setError(null);
    try {
      const token = await getToken();
      await apiRequest('/payments/dev-attach-test-card', { method: 'POST', token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach test card');
    } finally {
      setAttaching(false);
    }
  };

  const join = async () => {
    if (!id) return;
    setJoining(true);
    setError(null);
    try {
      const token = await getToken();
      await apiRequest(`/challenges/${id}/join`, { method: 'POST', token });
      Alert.alert('Joined!', "You're in. Check the Home tab for your challenge card.");
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setJoining(false);
    }
  };

  const toggleCheer = async (progressId: string, currentlyCheered: boolean) => {
    // Optimistic.
    setRows((prev) =>
      prev.map((r) =>
        r.todayProgressId === progressId
          ? {
              ...r,
              todayCheerByViewer: !currentlyCheered,
              todayCheerCount: r.todayCheerCount + (currentlyCheered ? -1 : 1),
            }
          : r,
      ),
    );
    try {
      const token = await getToken();
      await apiRequest(`/daily-progress/${progressId}/cheer`, {
        method: currentlyCheered ? 'DELETE' : 'POST',
        token,
      });
    } catch (err) {
      // Rollback.
      setRows((prev) =>
        prev.map((r) =>
          r.todayProgressId === progressId
            ? {
                ...r,
                todayCheerByViewer: currentlyCheered,
                todayCheerCount: r.todayCheerCount + (currentlyCheered ? 1 : -1),
              }
            : r,
        ),
      );
      void err;
    }
  };

  const [marking, setMarking] = useState(false);
  const markDone = async () => {
    if (!id || marking) return;
    setMarking(true);
    setError(null);
    try {
      const token = await getToken();
      await apiRequest(`/challenges/${id}/tap-done`, { method: 'POST', token, body: {} });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark done');
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const alreadyIn = Boolean(challenge.userParticipation);
  const canJoin = challenge.status === 'OPEN' && !alreadyIn;
  const isWeekly = challenge.gameFormat === 'WEEKLY_QUOTA';
  const isCompletion = challenge.gameFormat === 'COMPLETION_COUNT';
  const weeks = Math.ceil(challenge.durationDays / 7);
  const stepsK = Math.round(challenge.dailyStepGoal / 1000);
  const gradient = categoryGradient(challenge.category);
  const catLabel = challenge.category ? categoryLabel[challenge.category] : 'General';
  const catEm = challenge.category ? categoryEmoji[challenge.category] : '🎯';

  const verifLabel = {
    AUTO_STEPS: 'Auto-steps',
    PHOTO_PROOF: 'Photo proof',
    HONOR_TAP: 'Honor tap',
  }[challenge.verificationMethod];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerBack}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <View
            style={[
              styles.statusPill,
              { backgroundColor: alreadyIn ? colors.successBg : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: alreadyIn ? colors.success : colors.warn },
              ]}
            >
              {alreadyIn
                ? `🟢 ${challenge.userParticipation?.status}`
                : challenge.status === 'OPEN'
                  ? '🟡 OPEN'
                  : '🔵 ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Category badge */}
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>
            {catEm} {catLabel} · {challenge.durationDays} days · {verifLabel}
          </Text>
        </View>

        <Text style={styles.title}>{challenge.title}</Text>
        {challenge.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
        <Text style={styles.dates}>{formatDateRange(challenge.startDate, challenge.endDate)}</Text>

        {/* Prize-pool hero */}
        <LinearGradient
          colors={gradient as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.poolHero}
        >
          <Text style={styles.poolLabel}>Prize pool</Text>
          <Text style={styles.poolValue}>${challenge.prizePool.toFixed(0)}</Text>
          <Text style={styles.poolSub}>
            {challenge.participantCount} {challenge.participantCount === 1 ? 'player' : 'players'} ·{' '}
            {isCompletion
              ? `Hit ${challenge.targetDaysComplete ?? '?'} of ${challenge.durationDays} days to share`
              : isWeekly
                ? `${weeks} weeks · weekly quota to qualify`
                : 'Complete all days to qualify'}
          </Text>
        </LinearGradient>

        {/* Quick stats */}
        <View style={styles.statRow}>
          <Stat label="Stake" value={`$${challenge.commitmentFee.toFixed(0)}`} />
          <Stat label="Players" value={String(challenge.participantCount)} />
          {isWeekly ? (
            <Stat label="Format" value={`${weeks}wk`} />
          ) : isCompletion ? (
            <Stat
              label="Target"
              value={`${challenge.targetDaysComplete}/${challenge.durationDays}`}
            />
          ) : (
            <Stat label="Steps" value={`${stepsK}k`} />
          )}
          <Stat label="Length" value={`${challenge.durationDays}d`} />
        </View>

        {/* Weekly tier breakdown */}
        {isWeekly && challenge.activeStepGoal && challenge.powerStepGoal ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your weekly mix</Text>
            <TierRow
              icon="⚡"
              count={challenge.weeklyPowerDays ?? 0}
              label="Power"
              goal={`${challenge.powerStepGoal.toLocaleString()} steps`}
              tint={colors.power}
            />
            <TierRow
              icon="✓"
              count={challenge.weeklyActiveDays ?? 0}
              label="Active"
              goal={`${challenge.activeStepGoal.toLocaleString()} steps`}
              tint={colors.primary}
            />
            <TierRow
              icon="🌙"
              count={challenge.weeklyFreeDays ?? 0}
              label="Free"
              goal="rest day"
              tint="#9CA3AF"
            />
          </View>
        ) : null}

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Step
            n={1}
            title={`Commit $${challenge.commitmentFee.toFixed(0)}`}
            body="Held on your card. Joins the pot."
          />
          {challenge.verificationMethod === 'AUTO_STEPS' ? (
            <Step
              n={2}
              title={
                isWeekly
                  ? `Hit your weekly mix for ${weeks} weeks`
                  : `${stepsK}k+ steps every day for ${challenge.durationDays} days`
              }
              body={
                isWeekly
                  ? 'Steps tracked via HealthKit / Health Connect.'
                  : 'Steps tracked automatically.'
              }
            />
          ) : challenge.verificationMethod === 'PHOTO_PROOF' ? (
            <Step
              n={2}
              title={`Snap a photo each day`}
              body={`Backfill anytime. Hit ${challenge.targetDaysComplete ?? challenge.durationDays} of ${challenge.durationDays} days.`}
            />
          ) : (
            <Step
              n={2}
              title="Tap 'done' each day"
              body={`Honor system. Hit ${challenge.targetDaysComplete ?? challenge.durationDays} of ${challenge.durationDays} days.`}
            />
          )}
          <Step
            n={3}
            title="Survivors split the pot"
            body="Equal share among everyone who qualifies."
          />
        </View>

        {/* Leaderboard */}
        <Leaderboard rows={rows} meId={meId} onToggleCheer={toggleCheer} onOpenProfile={(uid) => router.push(`/u/${uid}`)} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* CTA */}
        {alreadyIn ? (
          challenge.verificationMethod === 'HONOR_TAP' ? (
            (() => {
              const meRow = rows.find((r) => r.userId === meId);
              const todayDone = meRow?.todayCompleted ?? false;
              if (todayDone) {
                return (
                  <View style={[styles.cta, styles.ctaDone]}>
                    <Text style={styles.ctaDoneText}>✓ Done for today</Text>
                  </View>
                );
              }
              return (
                <Pressable
                  onPress={markDone}
                  disabled={marking}
                  style={({ pressed }) => [styles.cta, (pressed || marking) && { opacity: 0.85 }]}
                >
                  {marking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>Mark today done</Text>
                  )}
                </Pressable>
              );
            })()
          ) : challenge.verificationMethod === 'PHOTO_PROOF' ? (
            <View style={[styles.cta, styles.ctaDisabled]}>
              <Text style={styles.ctaDisabledText}>📷 Photo proof coming soon</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)')}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>You're in — go to Home</Text>
            </Pressable>
          )
        ) : canJoin ? (
          method ? (
            <Pressable
              onPress={join}
              disabled={joining}
              style={({ pressed }) => [styles.cta, (pressed || joining) && { opacity: 0.85 }]}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  Join — ${challenge.commitmentFee.toFixed(0)} on {method.brand.toUpperCase()} •••• {method.last4}
                </Text>
              )}
            </Pressable>
          ) : (
            <>
              <View style={styles.warnCard}>
                <Text style={styles.warnTitle}>No payment method on file</Text>
                <Text style={styles.warnBody}>
                  Use the dev shortcut to attach Stripe's test card (pm_card_visa).
                </Text>
              </View>
              <Pressable
                onPress={attachTestCard}
                disabled={attaching}
                style={({ pressed }) => [styles.cta, (pressed || attaching) && { opacity: 0.85 }]}
              >
                {attaching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Attach test card (dev)</Text>
                )}
              </Pressable>
            </>
          )
        ) : (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Closed</Text>
            <Text style={styles.warnBody}>This challenge is no longer accepting joiners.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TierRow({
  icon, count, label, goal, tint,
}: {
  icon: string; count: number; label: string; goal: string; tint: string;
}) {
  return (
    <View style={[styles.tierRow, { borderLeftColor: tint }]}>
      <Text style={styles.tierIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.tierTitle}>
          {count} {label} day{count === 1 ? '' : 's'}
        </Text>
        <Text style={styles.tierBody}>{goal}</Text>
      </View>
    </View>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

function Leaderboard({
  rows,
  meId,
  onToggleCheer,
  onOpenProfile,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  onToggleCheer: (progressId: string, currentlyCheered: boolean) => Promise<void>;
  onOpenProfile: (userId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Players</Text>
        <View style={styles.warnCard}>
          <Text style={styles.warnBody}>No one's in yet. Be the first.</Text>
        </View>
      </View>
    );
  }
  const myRow = meId ? rows.find((r) => r.userId === meId) : null;
  const others = myRow ? rows.filter((r) => r.userId !== meId) : rows;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Players</Text>
      {myRow ? (
        <ParticipantRow
          row={myRow}
          highlighted
          isSelf
          onToggleCheer={onToggleCheer}
          onOpenProfile={onOpenProfile}
        />
      ) : null}
      {others.map((row) => (
        <ParticipantRow
          key={row.userId}
          row={row}
          isSelf={false}
          onToggleCheer={onToggleCheer}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </View>
  );
}

function ParticipantRow({
  row,
  highlighted,
  isSelf,
  onToggleCheer,
  onOpenProfile,
}: {
  row: LeaderboardRow;
  highlighted?: boolean;
  isSelf: boolean;
  onToggleCheer: (progressId: string, currentlyCheered: boolean) => Promise<void>;
  onOpenProfile: (userId: string) => void;
}) {
  const pct = Math.min(1, row.todayGoal > 0 ? row.todaySteps / row.todayGoal : 0);
  const badge = statusBadge(row);
  const displayName = highlighted ? 'YOU' : row.name;
  const canCheer = !isSelf && row.todayCompleted && row.todayProgressId;
  return (
    <Pressable
      onPress={() => onOpenProfile(row.userId)}
      style={({ pressed }) => [
        styles.lbRow,
        highlighted && styles.lbRowHighlight,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.avatar, highlighted && styles.avatarHighlight]}>
        <Text style={[styles.avatarText, highlighted && styles.avatarTextHighlight]}>
          {row.avatarInitial}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.lbHeader}>
          <Text style={[styles.lbName, highlighted && styles.lbNameHighlight]}>{displayName}</Text>
          <Text style={styles.lbSteps}>
            {row.daysCompleted}/{row.daysTotal}
          </Text>
        </View>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: progressColor(row) }]} />
        </View>
        <View style={styles.lbFooter}>
          <Text style={styles.lbDay}>
            {row.todaySteps.toLocaleString()} / {Math.round(row.todayGoal / 1000)}k today
          </Text>
          <View style={styles.lbFooterRight}>
            {canCheer ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  if (row.todayProgressId) {
                    void onToggleCheer(row.todayProgressId, row.todayCheerByViewer);
                  }
                }}
                style={({ pressed }) => [
                  styles.cheerBtn,
                  row.todayCheerByViewer && styles.cheerBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.cheerBtnText,
                    row.todayCheerByViewer && styles.cheerBtnTextActive,
                  ]}
                >
                  👏 {row.todayCheerCount}
                </Text>
              </Pressable>
            ) : row.todayCheerCount > 0 ? (
              <Text style={styles.cheerCountStatic}>👏 {row.todayCheerCount}</Text>
            ) : null}
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function statusBadge(row: LeaderboardRow): { label: string; fg: string; bg: string } {
  if (row.status === 'QUALIFIED') return { label: 'WINNER 🏆', fg: '#854D0E', bg: '#FEF3C7' };
  if (row.status === 'ELIMINATED') return { label: 'OUT 💀', fg: '#7F1D1D', bg: '#FEE2E2' };
  if (row.todayCompleted) return { label: 'DONE ✅', fg: '#14532D', bg: '#DCFCE7' };
  const pct = row.todayGoal > 0 ? row.todaySteps / row.todayGoal : 0;
  if (pct >= 0.7) return { label: 'ON TRACK', fg: '#854D0E', bg: '#FEF3C7' };
  return { label: 'BEHIND', fg: '#9A3412', bg: '#FFEDD5' };
}

function progressColor(row: LeaderboardRow): string {
  if (row.status === 'ELIMINATED') return '#EF4444';
  if (row.status === 'QUALIFIED' || row.todayCompleted) return colors.primary;
  return colors.ink;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, marginBottom: 14 },
  headerBack: { fontSize: 22, color: colors.ink },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: '800' },

  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.mint,
    marginBottom: 8,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 34,
  },
  desc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 4 },
  dates: { fontSize: 12, color: colors.textFaint, marginBottom: 18 },

  poolHero: {
    borderRadius: radius.cardLg,
    padding: 22,
    marginBottom: 18,
    ...shadow.hero,
  },
  poolLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  poolValue: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginTop: 4,
    lineHeight: 56,
  },
  poolSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.92)', marginTop: 4 },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  section: { marginTop: 18, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },

  tierRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 14,
    borderLeftWidth: 3,
    backgroundColor: colors.mint,
    borderRadius: 10,
  },
  tierIcon: { fontSize: 18 },
  tierTitle: { fontWeight: '800', fontSize: 14, color: colors.success },
  tierBody: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 },
  stepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepTitle: { fontWeight: '700', fontSize: 14, color: colors.ink },
  stepBody: { color: colors.textMuted, lineHeight: 19, fontSize: 13 },

  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: 20,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ctaDone: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ctaDoneText: { color: colors.success, fontWeight: '800', fontSize: 15 },
  ctaDisabled: {
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaDisabledText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },

  warnCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 14,
    gap: 4,
    marginTop: 14,
  },
  warnTitle: { fontWeight: '800', color: '#7C2D12', fontSize: 14 },
  warnBody: { color: '#9A3412', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, marginTop: 12 },

  lbRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  lbRowHighlight: { backgroundColor: colors.mint, borderColor: colors.primary, borderWidth: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEE', alignItems: 'center', justifyContent: 'center',
  },
  avatarHighlight: { backgroundColor: colors.primary },
  avatarText: { fontWeight: '800', color: colors.ink },
  avatarTextHighlight: { color: '#fff' },
  lbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbName: { fontWeight: '700', fontSize: 14, color: colors.ink },
  lbNameHighlight: { fontWeight: '800' },
  lbSteps: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  progress: { height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  lbFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbDay: { color: colors.textFaint, fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cheerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cheerBtnActive: { backgroundColor: colors.mint, borderColor: colors.primary },
  cheerBtnText: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  cheerBtnTextActive: { color: colors.primaryDark },
  cheerCountStatic: { fontSize: 11, fontWeight: '700', color: colors.textFaint },
});
