/**
 * Home — Direction B reskin.
 *
 * The visual layer is Playful Buddy (cream bg, chunky offset shadows,
 * orange CTAs, yellow scribble highlights). Logic (steps sync, AUTO_STEPS
 * ring, HONOR_TAP mark-done, weekly tally) is unchanged from the legacy
 * green build.
 */

import { useAuth } from '../../lib/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { StepRing } from '../../components/StepRing';
import {
  BButton,
  BCard,
  BEmpty,
  BHero,
  BPill,
  BStat,
  ScreenHeader,
} from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { bumpStubSteps, getTodaySteps, setStubSteps } from '../../lib/health';
import {
  CategoryKey,
  categoryEmoji,
  categoryLabel,
} from '../../lib/theme';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';
import { formatCountdown, msUntilUtcMidnight } from '../../lib/time';

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

  const loadRef = useRef(load);
  loadRef.current = load;
  const syncRef = useRef(sync);
  syncRef.current = sync;

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colorsB.orange} />
        </View>
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
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colorsB.orange}
          />
        }
      >
        <ScreenHeader
          eyebrow="Today"
          before={parts.length === 0 ? "Let's" : `${parts.length}`}
          highlight={parts.length === 0 ? 'go' : 'active'}
          after={parts.length === 0 ? '!' : ''}
        />

        {parts.length === 0 ? (
          <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
            <BHero tint={colorsB.ink}>
              <Text style={styles.heroEyebrow}>Steps today</Text>
              <Text style={styles.heroValue}>{steps.toLocaleString()}</Text>
              <Text style={styles.heroSub}>
                Not counted toward any challenge yet — join one to start.
              </Text>
            </BHero>

            <BEmpty
              emoji="🌱"
              title="No challenges yet"
              body="Find an open challenge to join — or build your own."
              cta={{ label: 'Browse challenges →', onPress: () => router.push('/(tabs)/discover') }}
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
            {parts.map((p) => (
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
            ))}

            {hasStepsChallenge ? (
              <BButton
                label={syncing ? 'Syncing…' : '🔁 Sync steps now'}
                tone="ink"
                disabled={syncing}
                onPress={() => void sync()}
                style={{ marginTop: spacingB.sm }}
              />
            ) : null}
          </View>
        )}

        {error ? (
          <Text style={[typeB.body, { color: colorsB.orangeDeep, paddingHorizontal: spacingB.lg, marginTop: spacingB.lg }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Per-challenge card ───────────────────────────────────────────────────

function ChallengeCard({
  participation,
  steps,
  countdown,
  onPress,
  onMarkDone,
  onBumpSteps,
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
  const catLab = challenge.category ? categoryLabel[challenge.category] : 'General';
  const isHonor = challenge.verificationMethod === 'HONOR_TAP';
  const isPhoto = challenge.verificationMethod === 'PHOTO_PROOF';
  const todayDone = participation.todayProgress?.completed ?? false;
  const [marking, setMarking] = useState(false);

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(`${challenge.startDate}T00:00:00.000Z`);
  const notStarted = startUtc > now;
  const daysUntilStart = Math.ceil((startUtc.getTime() - now.getTime()) / 86400000);
  const startLabel = daysUntilStart === 1 ? 'Starts tomorrow' : `Starts in ${daysUntilStart} days`;

  const progressColor = hitPower ? colorsB.yellow : hitToday ? colorsB.green : colorsB.orange;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
      ]}
    >
      {/* Top row: category pill + status */}
      <View style={styles.cardTop}>
        <BPill label={`${catEm} ${catLab}`} tone="neutral" />
        <Text style={styles.cardStatus}>
          {notStarted
            ? startLabel
            : isWeekly
              ? `Week ${currentWeek(challenge.startDate)}/${Math.ceil(challenge.durationDays / 7)}`
              : isCompletion
                ? `${completedDays}/${challenge.targetDaysComplete ?? challenge.durationDays} done`
                : `Day ${completedDays + 1}/${challenge.durationDays}`}
        </Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {challenge.title}
      </Text>

      {challenge.verificationMethod === 'AUTO_STEPS' ? (
        <>
          <View style={styles.ringWrap}>
            <StepRing
              progress={progress}
              progressColor={progressColor}
              trackColor={colorsB.bgWarm}
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
            <View style={styles.disabledBox}>
              <Text style={styles.disabledText}>{startLabel} — no progress yet</Text>
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
          <View style={styles.disabledBox}>
            <Text style={styles.disabledText}>{startLabel} — no progress yet</Text>
          </View>
        ) : todayDone ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneBoxText}>✓ Done for today</Text>
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
            style={({ pressed }) => [
              styles.markBtn,
              (pressed || marking) && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
            ]}
          >
            {marking ? (
              <ActivityIndicator color={colorsB.paper} />
            ) : (
              <Text style={styles.markBtnText}>Mark today done →</Text>
            )}
          </Pressable>
        )
      ) : isPhoto ? (
        <View style={styles.disabledBox}>
          <Text style={styles.disabledText}>📷 Photo proof coming soon</Text>
        </View>
      ) : null}

      {isWeekly ? <WeeklyTallyRow participation={participation} /> : null}

      <View style={styles.metricRow}>
        <BStat label="Prize" value={`$${challenge.prizePool.toFixed(0)}`} />
        <BStat label="Stake" value={`$${challenge.commitmentFee.toFixed(0)}`} />
        <BStat label="Left" value={countdown} />
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
    <View style={styles.devRow}>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          void run(1000);
        }}
        disabled={busy}
        style={({ pressed }) => [styles.devChip, (pressed || busy) && { opacity: 0.7 }]}
      >
        <Text style={styles.devChipText}>+1k</Text>
      </Pressable>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          void run(5000);
        }}
        disabled={busy}
        style={({ pressed }) => [
          styles.devChip,
          styles.devChipPrimary,
          (pressed || busy) && { opacity: 0.7 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colorsB.paper} size="small" />
        ) : (
          <Text style={[styles.devChipText, { color: colorsB.paper }]}>+5k (dev)</Text>
        )}
      </Pressable>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          void run(0);
        }}
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

  let power = 0;
  let active = 0;
  for (const d of inWeek) {
    if (d.dayType === 'POWER') power++;
    else if (d.dayType === 'ACTIVE') active++;
  }
  const free = inWeek.filter((d) => d.dayType === 'MISSED').length;

  return (
    <View style={styles.tallyRow}>
      <TallyCell icon="⚡" label="Power" got={power} need={challenge.weeklyPowerDays ?? 0} tint={colorsB.yellow} />
      <TallyCell icon="✓" label="Active" got={active} need={challenge.weeklyActiveDays ?? 0} tint={colorsB.green} />
      <TallyCell icon="🌙" label="Free" got={free} need={challenge.weeklyFreeDays ?? 0} tint={colorsB.inkFaint} />
    </View>
  );
}

function TallyCell({
  icon,
  label,
  got,
  need,
  tint,
}: {
  icon: string;
  label: string;
  got: number;
  need: number;
  tint: string;
}) {
  const done = got >= need;
  return (
    <View style={[styles.tallyCell, { borderColor: done ? tint : colorsB.line }]}>
      <Text style={styles.tallyIcon}>{icon}</Text>
      <Text style={[styles.tallyVal, { color: done ? colorsB.ink : colorsB.inkSoft }]}>
        {got}/{need}
      </Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  // Hero (steps today)
  heroEyebrow: {
    color: colorsB.yellow,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: colorsB.paper,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 6,
  },
  heroSub: { color: colorsB.bgWarm, fontSize: 12, marginTop: 6, fontWeight: '600' },

  // Challenge card
  card: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.lg,
    gap: spacingB.lg,
    ...shadowsB.cardLg,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStatus: { fontSize: 11, fontWeight: '900', color: colorsB.inkSoft, letterSpacing: 0.4 },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.4,
    marginTop: -spacingB.sm,
  },

  ringWrap: { alignItems: 'center', paddingVertical: 4 },
  steps: { fontSize: 30, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.5 },
  goal: { fontSize: 11, color: colorsB.inkSoft, marginTop: 2, fontWeight: '700' },

  bigDone: {
    alignItems: 'center',
    paddingVertical: spacingB.lg,
    backgroundColor: colorsB.greenSoft,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
  },
  bigDoneVal: { fontSize: 48, fontWeight: '900', color: colorsB.ink, letterSpacing: -1, lineHeight: 52 },
  bigDoneLabel: { fontSize: 12, color: colorsB.green, fontWeight: '800' },

  // Mark today done — chunky orange button with offset shadow
  markBtn: {
    backgroundColor: colorsB.orange,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowsB.card,
  },
  markBtnText: { color: colorsB.paper, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  doneBox: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.green,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBoxText: { color: colorsB.green, fontWeight: '900', fontSize: 14 },

  disabledBox: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderColor: colorsB.line,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledText: { color: colorsB.inkSoft, fontWeight: '700', fontSize: 12 },

  // Dev step row
  devRow: { flexDirection: 'row', gap: 6 },
  devChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radiusB.control,
    backgroundColor: colorsB.bgWarm,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devChipPrimary: {
    flex: 2,
    backgroundColor: colorsB.ink,
    borderColor: colorsB.ink,
  },
  devChipText: { fontSize: 12, fontWeight: '900', color: colorsB.ink },

  // Metric row (3 stat tiles)
  metricRow: { flexDirection: 'row', gap: 8 },

  // Weekly tally
  tallyRow: { flexDirection: 'row', gap: 8 },
  tallyCell: {
    flex: 1,
    backgroundColor: colorsB.bgWarm,
    borderRadius: radiusB.control,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    gap: 2,
  },
  tallyIcon: { fontSize: 16 },
  tallyVal: { fontSize: 14, fontWeight: '900', letterSpacing: -0.3 },
  tallyLabel: {
    fontSize: 9,
    color: colorsB.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
});
