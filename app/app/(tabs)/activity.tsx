import { useAuth } from '../../lib/auth';
import { useFocusEffect, useRouter } from 'expo-router';
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

import { apiRequest } from '../../lib/api';
import { formatDateRange } from '../../lib/time';
import { colors, radius, shadow } from '../../lib/theme';

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
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Text style={styles.eyebrow}>Activity</Text>
        <Text style={styles.title}>Your History</Text>

        {stats ? (
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <Stat label="Won" value={String(stats.won)} />
              <Stat label="Lost" value={String(stats.lost)} />
              <Stat label="Streak" value={`${stats.currentStreak}${stats.currentStreak > 0 ? ' 🔥' : ''}`} />
              <Stat label="Earned" value={`$${stats.earned.toFixed(2)}`} />
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {parts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No challenges yet</Text>
            <Text style={styles.emptyBody}>
              Your wins, losses, and progress will live here.
            </Text>
          </View>
        ) : (
          parts.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/challenge/${p.challenge.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <ChallengeCardHeader part={p} />
              <DayDots progress={p.dailyProgress} status={p.status} duration={p.challenge.durationDays} />
              <OutcomeLine part={p} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChallengeCardHeader({ part }: { part: Participation }) {
  const icon = part.status === 'QUALIFIED' ? '🏆' : part.status === 'ELIMINATED' ? '💀' : '🏃';
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>
        {icon}  {part.challenge.title}
      </Text>
      <Text style={styles.cardDates}>
        {formatDateRange(part.challenge.startDate, part.challenge.endDate)}
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
    if (!d) {
      dots.push({ kind: 'pending' });
    } else if (d.completed) {
      dots.push({ kind: 'done' });
    } else if (status === 'ELIMINATED' && !metFailure) {
      dots.push({ kind: 'miss' });
      metFailure = true;
    } else if (metFailure) {
      dots.push({ kind: 'pending' });
    } else {
      dots.push({ kind: 'pending' });
    }
  }
  const missedDay = dots.findIndex((d) => d.kind === 'miss');
  const summary =
    status === 'QUALIFIED'
      ? `${duration}/${duration} days completed`
      : status === 'ELIMINATED'
        ? `Out on day ${missedDay >= 0 ? missedDay + 1 : '?'}`
        : `Day ${dots.filter((d) => d.kind === 'done').length} of ${duration} — In progress`;
  return (
    <View style={{ gap: 8 }}>
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
    return <Text style={styles.outcomeWin}>+${part.wonAmount.toFixed(2)} won</Text>;
  }
  if (part.status === 'ELIMINATED') {
    return (
      <Text style={styles.outcomeLoss}>
        −${part.lostAmount.toFixed(2)} lost
        {part.paymentFailed ? '  (payment failed)' : ''}
      </Text>
    );
  }
  return <Text style={styles.outcomeActive}>${part.commitmentFee.toFixed(2)} at risk</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  eyebrow: {
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginBottom: 6 },
  error: { color: colors.danger },

  statsCard: {
    backgroundColor: colors.mint,
    borderRadius: radius.cardLg,
    padding: 18,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  statLabel: {
    color: colors.primaryDark,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.card,
    padding: 24,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  emptyBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: { gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },
  cardDates: { color: colors.textFaint, fontSize: 12 },
  summary: { fontWeight: '600', fontSize: 12, color: colors.textMuted },
  dotsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot: { width: 12, height: 12, borderRadius: 3 },
  dotDone: { backgroundColor: colors.primary },
  dotMiss: { backgroundColor: '#EF4444' },
  dotPending: { backgroundColor: '#E5E5E5' },

  outcomeWin: { color: colors.success, fontWeight: '800', fontSize: 15 },
  outcomeLoss: { color: '#7F1D1D', fontWeight: '800', fontSize: 15 },
  outcomeActive: { color: colors.ink, fontWeight: '700', fontSize: 14 },
});
