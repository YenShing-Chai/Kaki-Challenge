/**
 * Activity — Direction B reskin.
 *
 * Stats hero on cream → ink, day-dot strips on paper offset cards,
 * outcome banners in green/orange/yellow tones.
 */

import { useAuth } from '../../lib/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BCard,
  BEmpty,
  BHero,
  BPill,
  ScreenHeader,
} from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { colorsB, radiusB, spacingB, typeB } from '../../lib/themeB';
import { formatDateRange } from '../../lib/time';

type Stats = {
  won: number;
  lost: number;
  currentStreak: number;
  longestStreak: number;
  earned: number;
  totalWon: number;
  totalLost: number;
};

type Participation = {
  id: string;
  status: 'ACTIVE' | 'QUALIFIED' | 'ELIMINATED';
  commitmentFee: number;
  paymentFailed: boolean;
  challenge: {
    id: string;
    title: string;
    dailyStepGoal: number;
    durationDays: number;
    startDate: string;
    endDate: string;
    status: string;
  };
  dailyProgress: Array<{
    date: string;
    stepsAchieved: number;
    goalSteps: number;
    completed: boolean;
  }>;
  wonAmount: number;
  lostAmount: number;
};

export default function ActivityTab() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [parts, setParts] = useState<Participation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      const { stats: s, participations } = await apiRequest<{
        stats: Stats | null;
        participations: Participation[];
      }>('/users/me/activity', { token });
      setStats(s);
      setParts(participations);
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
        <View style={styles.center}>
          <ActivityIndicator color={colorsB.orange} />
        </View>
      </SafeAreaView>
    );
  }

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
        <ScreenHeader eyebrow="Activity" before="Your" highlight="history" />

        <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
          {stats ? (
            <BHero tint={colorsB.ink}>
              <View style={styles.statsRow}>
                <StatNum value={String(stats.won)} label="Won" />
                <Divider />
                <StatNum value={String(stats.lost)} label="Lost" />
                <Divider />
                <StatNum
                  value={`${stats.currentStreak}${stats.currentStreak > 0 ? '🔥' : ''}`}
                  label="Streak"
                />
                <Divider />
                <StatNum value={`$${stats.earned.toFixed(0)}`} label="Earned" />
              </View>
            </BHero>
          ) : null}

          {error ? (
            <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
          ) : null}

          {parts.length === 0 ? (
            <BEmpty
              emoji="📋"
              title="No challenges yet"
              body="Your wins, losses, and progress will live here."
              cta={{ label: 'Find one →', onPress: () => router.push('/(tabs)/discover') }}
            />
          ) : (
            <View style={{ gap: spacingB.lg }}>
              {parts.map((p) => (
                <BCard
                  key={p.id}
                  onPress={() => router.push(`/challenge/${p.challenge.id}`)}
                  style={{ gap: spacingB.md }}
                >
                  <ChallengeCardHeader part={p} />
                  <DayDots
                    progress={p.dailyProgress}
                    status={p.status}
                    duration={p.challenge.durationDays}
                  />
                  <OutcomeLine part={p} />
                </BCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatNum({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ChallengeCardHeader({ part }: { part: Participation }) {
  const tone = part.status === 'QUALIFIED' ? 'green' : part.status === 'ELIMINATED' ? 'orange' : 'yellow';
  const label =
    part.status === 'QUALIFIED'
      ? '🏆 WON'
      : part.status === 'ELIMINATED'
        ? '💀 OUT'
        : '🏃 ACTIVE';
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BPill label={label} tone={tone} />
        <Text style={styles.dates}>
          {formatDateRange(part.challenge.startDate, part.challenge.endDate)}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {part.challenge.title}
      </Text>
    </View>
  );
}

function DayDots({
  progress,
  status,
  duration,
}: {
  progress: Participation['dailyProgress'];
  status: Participation['status'];
  duration: number;
}) {
  const dots: Array<{ kind: 'done' | 'miss' | 'pending' }> = [];
  let metFailure = false;
  for (let i = 0; i < duration; i++) {
    const d = progress[i];
    if (!d) dots.push({ kind: 'pending' });
    else if (d.completed) dots.push({ kind: 'done' });
    else if (status === 'ELIMINATED' && !metFailure) {
      dots.push({ kind: 'miss' });
      metFailure = true;
    } else if (metFailure) dots.push({ kind: 'pending' });
    else dots.push({ kind: 'pending' });
  }
  const missedDay = dots.findIndex((d) => d.kind === 'miss');
  const summary =
    status === 'QUALIFIED'
      ? `${duration}/${duration} days completed`
      : status === 'ELIMINATED'
        ? `Out on day ${missedDay >= 0 ? missedDay + 1 : '?'}`
        : `Day ${dots.filter((d) => d.kind === 'done').length} of ${duration} — In progress`;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.dotsRow}>
        {dots.map((d, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              d.kind === 'done' && styles.dotDone,
              d.kind === 'miss' && styles.dotMiss,
              d.kind === 'pending' && styles.dotPending,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function OutcomeLine({ part }: { part: Participation }) {
  if (part.status === 'QUALIFIED') {
    return (
      <View style={[styles.outcomeBox, { backgroundColor: colorsB.greenSoft, borderColor: colorsB.green }]}>
        <Text style={[styles.outcomeText, { color: colorsB.green }]}>
          +${part.wonAmount.toFixed(2)} won
        </Text>
      </View>
    );
  }
  if (part.status === 'ELIMINATED') {
    return (
      <View style={[styles.outcomeBox, { backgroundColor: colorsB.orangeSoft, borderColor: colorsB.orangeDeep }]}>
        <Text style={[styles.outcomeText, { color: colorsB.orangeDeep }]}>
          −${part.lostAmount.toFixed(2)} lost
          {part.paymentFailed ? '  (payment failed)' : ''}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.outcomeBox, { backgroundColor: colorsB.bgWarm, borderColor: colorsB.ink }]}>
      <Text style={[styles.outcomeText, { color: colorsB.ink }]}>
        ${part.commitmentFee.toFixed(2)} at risk
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colorsB.paper,
    letterSpacing: -0.4,
  },
  statLabel: {
    color: colorsB.yellow,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '900',
  },
  divider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)' },

  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.2,
  },
  dates: { color: colorsB.inkFaint, fontSize: 11, fontWeight: '700' },
  summary: { fontWeight: '700', fontSize: 12, color: colorsB.inkSoft },
  dotsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  dotDone: { backgroundColor: colorsB.green, borderColor: colorsB.ink },
  dotMiss: { backgroundColor: colorsB.orange, borderColor: colorsB.ink },
  dotPending: { backgroundColor: colorsB.bgWarm, borderColor: colorsB.line },

  outcomeBox: {
    borderRadius: radiusB.control,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  outcomeText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.2 },
});
