import { useAuth } from '../../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepRing } from '../../components/StepRing';
import { apiRequest } from '../../lib/api';
import { bumpStubSteps, getTodaySteps, setStubSteps } from '../../lib/health';
import { formatCountdown, msUntilUtcMidnight } from '../../lib/time';
import {
  CategoryKey,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  colors,
  radius,
  shadow,
} from '../../lib/theme';

type DayType = 'POWER' | 'ACTIVE' | 'FREE' | 'MISSED' | null;
type GameFormat = 'DAILY_STREAK' | 'WEEKLY_QUOTA' | 'COMPLETION_COUNT';

type DailyProgress = {
  date: string;
  stepsAchieved: number;
  goalSteps: number;
  completed: boolean;
  dayType?: DayType;
};

type Participation = {
  id: string;
  status: 'ACTIVE' | 'QUALIFIED' | 'ELIMINATED';
  challenge: {
    id: string;
    title: string;
    dailyStepGoal: number;
    durationDays: number;
    startDate: string;
    endDate: string;
    prizePool: number;
    commitmentFee: number;
    status: 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    gameFormat?: GameFormat;
    activeStepGoal?: number | null;
    powerStepGoal?: number | null;
    weeklyActiveDays?: number | null;
    weeklyPowerDays?: number | null;
    weeklyFreeDays?: number | null;
    category?: CategoryKey | null;
    verificationMethod?: 'AUTO_STEPS' | 'PHOTO_PROOF' | 'HONOR_TAP';
    targetDaysComplete?: number | null;
  };
  todayProgress: DailyProgress | null;
  dailyProgress: DailyProgress[];
};

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export default function HomeTab() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [parts, setParts] = useState<Participation[]>([]);
  const [steps, setSteps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilUtcMidnight()));

  const syncLockRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      const { participations } = await apiRequest<{ participations: Participation[] }>(
        '/challenges/me/active',
        { token },
      );
      setParts(participations);
      const current = await getTodaySteps();
      setSteps(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  const markDone = useCallback(
    async (challengeId: string) => {
      try {
        const token = await getToken();
        await apiRequest(`/challenges/${challengeId}/tap-done`, {
          method: 'POST',
          token,
          body: {},
        });
        await load();
      } catch (err) {
        Alert.alert('Could not mark done', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [getToken, load],
  );

  const sync = useCallback(async () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    setSyncing(true);
    try {
      const token = await getToken();
      const current = await getTodaySteps();
      setSteps(current);
      await apiRequest('/steps/sync', { method: 'POST', token, body: { stepsCount: current } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
      syncLockRef.current = false;
    }
  }, [getToken, load]);

  // Stable refs so effects below don't re-fire when load/sync identity changes.
  const loadRef = useRef(load);
  loadRef.current = load;
  const syncRef = useRef(sync);
  syncRef.current = sync;

  // Single source of truth for "fetch on screen focus" — useFocusEffect also
  // fires on initial mount, so no separate useEffect needed.
  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, []),
  );

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(msUntilUtcMidnight())), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (parts.length === 0) return;
    const id = setInterval(() => void syncRef.current(), SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [parts.length]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && parts.length > 0) void syncRef.current();
    });
    return () => sub.remove();
  }, [parts.length]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }

  const hasStepsChallenge = parts.some(
    (p) => p.challenge.verificationMethod === 'AUTO_STEPS',
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
          />
        }
      >
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.title}>
          {parts.length === 0 ? 'Active challenges' : `${parts.length} active`}
        </Text>

        {parts.length === 0 ? (
          <>
            <View style={styles.stepCounter}>
              <Text style={styles.stepCounterLabel}>Steps today</Text>
              <Text style={styles.stepCounterValue}>{steps.toLocaleString()}</Text>
              <Text style={styles.stepCounterSub}>
                Not counted toward any challenge — join one to start.
              </Text>
            </View>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active challenges</Text>
              <Text style={styles.emptyBody}>Find an open challenge to join.</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/discover')}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>Browse challenges</Text>
              </Pressable>
            </View>
          </>
        ) : (
          parts.map((p) => (
            <ChallengeCard
              key={p.id}
              participation={p}
              steps={steps}
              countdown={countdown}
              onPress={() => router.push(`/challenge/${p.challenge.id}`)}
              onMarkDone={() => markDone(p.challenge.id)}
              onBumpSteps={async (delta) => {
                const next = delta === 0 ? setStubSteps(0) : bumpStubSteps(delta);
                setSteps(next);
                await sync();
              }}
            />
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {hasStepsChallenge ? (
          <Pressable
            onPress={sync}
            disabled={syncing}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Sync steps now</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChallengeCard({
  participation, steps, countdown, onPress, onMarkDone, onBumpSteps,
}: {
  participation: Participation;
  steps: number;
  countdown: string;
  onPress: () => void;
  onMarkDone: () => void;
  onBumpSteps: (delta: number) => Promise<void>;
}) {
  const { challenge } = participation;
  const isWeekly = challenge.gameFormat === 'WEEKLY_QUOTA';
  const isCompletion = challenge.gameFormat === 'COMPLETION_COUNT';
  const completedDays = participation.dailyProgress.filter((d) => d.completed).length;
  const goal = isWeekly && challenge.activeStepGoal ? challenge.activeStepGoal : challenge.dailyStepGoal;
  const progress = goal > 0 ? steps / goal : 0;
  const hitToday = steps >= goal;
  const hitPower = isWeekly && challenge.powerStepGoal != null && steps >= challenge.powerStepGoal;
  const catEm = challenge.category ? categoryEmoji[challenge.category] : '🎯';
  const catLabel = challenge.category ? categoryLabel[challenge.category] : 'General';
  const gradient = categoryGradient(challenge.category);
  const isHonor = challenge.verificationMethod === 'HONOR_TAP';
  const isPhoto = challenge.verificationMethod === 'PHOTO_PROOF';
  const todayDone = participation.todayProgress?.completed ?? false;
  const [marking, setMarking] = useState(false);
  // Challenge hasn't started yet — no progress can be recorded.
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(`${challenge.startDate}T00:00:00.000Z`);
  const notStarted = startUtc > now;
  const daysUntilStart = Math.ceil((startUtc.getTime() - now.getTime()) / 86400000);
  const startLabel =
    daysUntilStart === 1
      ? 'Starts tomorrow'
      : `Starts in ${daysUntilStart} days`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      {/* Category gradient banner */}
      <LinearGradient
        colors={gradient as unknown as readonly [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardBanner}
      >
        <View style={styles.bannerBadge}>
          <Text style={styles.bannerBadgeText}>{catEm} {catLabel}</Text>
        </View>
        <Text style={styles.bannerStatus}>
          {notStarted
            ? startLabel
            : isWeekly
              ? `Week ${currentWeek(challenge.startDate)}/${Math.ceil(challenge.durationDays / 7)}`
              : isCompletion
                ? `${completedDays}/${challenge.targetDaysComplete ?? challenge.durationDays} done`
                : `Day ${completedDays + 1}/${challenge.durationDays}`}
        </Text>
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{challenge.title}</Text>

        {challenge.verificationMethod === 'AUTO_STEPS' ? (
          <>
            <View style={styles.ringWrap}>
              <StepRing
                progress={progress}
                progressColor={hitPower ? colors.power : hitToday ? colors.primary : colors.ink}
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.steps}>{steps.toLocaleString()}</Text>
                  <Text style={styles.goal}>
                    of {goal.toLocaleString()}
                    {isWeekly && challenge.powerStepGoal
                      ? ` · ⚡ ${challenge.powerStepGoal.toLocaleString()}`
                      : ''}
                  </Text>
                </View>
              </StepRing>
            </View>
            {notStarted ? (
              <View style={[styles.markBtn, styles.markBtnDisabled]}>
                <Text style={styles.markBtnDisabledText}>{startLabel} — no progress yet</Text>
              </View>
            ) : (
              <DevStepRow onBump={onBumpSteps} />
            )}
          </>
        ) : (
          <View style={styles.bigDone}>
            <Text style={styles.bigDoneVal}>{completedDays}</Text>
            <Text style={styles.bigDoneLabel}>
              of {challenge.targetDaysComplete ?? challenge.durationDays} days done
            </Text>
          </View>
        )}

        {isHonor ? (
          notStarted ? (
            <View style={[styles.markBtn, styles.markBtnDisabled]}>
              <Text style={styles.markBtnDisabledText}>{startLabel} — no progress yet</Text>
            </View>
          ) : todayDone ? (
            <View style={[styles.markBtn, styles.markBtnDone]}>
              <Text style={styles.markBtnDoneText}>✓ Done for today</Text>
            </View>
          ) : (
            <Pressable
              onPress={async (e) => {
                e.stopPropagation?.();
                if (marking) return;
                setMarking(true);
                try {
                  await onMarkDone();
                } finally {
                  setMarking(false);
                }
              }}
              disabled={marking}
              style={({ pressed }) => [styles.markBtn, (pressed || marking) && { opacity: 0.85 }]}
            >
              {marking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.markBtnText}>Mark today done</Text>
              )}
            </Pressable>
          )
        ) : isPhoto ? (
          <View style={[styles.markBtn, styles.markBtnDisabled]}>
            <Text style={styles.markBtnDisabledText}>📷 Photo proof coming soon</Text>
          </View>
        ) : null}

        {isWeekly ? <WeeklyTallyRow participation={participation} /> : null}

        <View style={styles.metricRow}>
          <Metric label="Prize" value={`$${challenge.prizePool.toFixed(0)}`} />
          <Metric label="Stake" value={`$${challenge.commitmentFee.toFixed(0)}`} />
          <Metric label="Left" value={countdown} />
        </View>
      </View>
    </Pressable>
  );
}

function DevStepRow({ onBump }: { onBump: (delta: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const run = async (delta: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await onBump(delta);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.devRowInline}>
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); void run(1000); }}
        disabled={busy}
        style={({ pressed }) => [styles.devChip, (pressed || busy) && { opacity: 0.7 }]}
      >
        <Text style={styles.devChipText}>+1k</Text>
      </Pressable>
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); void run(5000); }}
        disabled={busy}
        style={({ pressed }) => [styles.devChip, styles.devChipPrimary, (pressed || busy) && { opacity: 0.7 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.devChipText, { color: '#fff' }]}>+5k steps (dev)</Text>
        )}
      </Pressable>
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); void run(0); }}
        disabled={busy}
        style={({ pressed }) => [styles.devChip, (pressed || busy) && { opacity: 0.7 }]}
      >
        <Text style={styles.devChipText}>Reset</Text>
      </Pressable>
    </View>
  );
}

function currentWeek(startDateIso: string): number {
  const start = new Date(`${startDateIso}T00:00:00.000Z`);
  const today = new Date();
  const ms = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (7 * 86400000)) + 1);
}

function WeeklyTallyRow({ participation }: { participation: Participation }) {
  const { challenge } = participation;
  const startUtc = new Date(`${challenge.startDate}T00:00:00.000Z`);
  const today = new Date();
  const weekIdx = Math.max(0, Math.floor((today.getTime() - startUtc.getTime()) / (7 * 86400000)));
  const weekStart = new Date(startUtc.getTime() + weekIdx * 7 * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);

  const inWeek = participation.dailyProgress.filter((d) => {
    const dt = new Date(`${d.date}T00:00:00.000Z`);
    return dt >= weekStart && dt <= weekEnd;
  });

  let power = 0, active = 0;
  for (const d of inWeek) {
    if (d.dayType === 'POWER') power++;
    else if (d.dayType === 'ACTIVE') active++;
  }
  const free = inWeek.filter((d) => d.dayType === 'MISSED').length;

  return (
    <View style={styles.tallyRow}>
      <TallyCell icon="⚡" label="Power" got={power} need={challenge.weeklyPowerDays ?? 0} tint={colors.power} />
      <TallyCell icon="✓" label="Active" got={active} need={challenge.weeklyActiveDays ?? 0} tint={colors.primary} />
      <TallyCell icon="🌙" label="Free" got={free} need={challenge.weeklyFreeDays ?? 0} tint="#9CA3AF" />
    </View>
  );
}

function TallyCell({
  icon, label, got, need, tint,
}: { icon: string; label: string; got: number; need: number; tint: string }) {
  const done = got >= need;
  return (
    <View style={[styles.tallyCell, { borderColor: done ? tint : colors.border }]}>
      <Text style={styles.tallyIcon}>{icon}</Text>
      <Text style={[styles.tallyVal, { color: done ? tint : colors.ink }]}>
        {got}/{need}
      </Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 18,
  },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardBanner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  bannerBadgeText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  bannerStatus: { fontSize: 12, fontWeight: '800', color: '#fff' },

  cardBody: { padding: 18, gap: 14 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },

  ringWrap: { alignItems: 'center', paddingVertical: 4 },
  steps: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  goal: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },

  bigDone: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.mint,
    borderRadius: radius.card,
  },
  bigDoneVal: { fontSize: 56, fontWeight: '800', color: colors.primary, letterSpacing: -1, lineHeight: 60 },
  bigDoneLabel: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },

  markBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: -0.2 },
  markBtnDone: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  markBtnDoneText: { color: colors.success, fontWeight: '800', fontSize: 15 },
  markBtnDisabled: { backgroundColor: colors.bgSoft },
  markBtnDisabledText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },

  devRowInline: { flexDirection: 'row', gap: 6 },
  devChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devChipPrimary: {
    flex: 2,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  devChipText: { fontSize: 12, fontWeight: '700', color: colors.ink },

  metricRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '800',
  },
  metricValue: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },

  tallyRow: { flexDirection: 'row', gap: 8 },
  tallyCell: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    gap: 2,
  },
  tallyIcon: { fontSize: 16 },
  tallyVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  tallyLabel: {
    fontSize: 10,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  emptyBody: { color: colors.textMuted, fontSize: 13 },

  stepCounter: {
    backgroundColor: colors.ink,
    borderRadius: radius.cardLg,
    padding: 22,
    gap: 4,
    alignItems: 'center',
    marginBottom: 14,
  },
  stepCounterLabel: {
    color: colors.power,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 11,
    fontWeight: '800',
  },
  stepCounterValue: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  stepCounterSub: { color: '#A7C9AE', fontSize: 12, textAlign: 'center', marginTop: 4 },

  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { color: colors.danger, marginVertical: 12 },

  devBlock: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  devLabel: {
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: '800',
  },
  devRow: { flexDirection: 'row', gap: 8 },
  devBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.ink, alignItems: 'center',
  },
  devBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  devHint: { fontSize: 11, color: colors.textFaint, lineHeight: 16 },
});
