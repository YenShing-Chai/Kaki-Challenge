import { useAuth } from '../../lib/auth';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '../../lib/api';
import {
  CategoryKey,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  colors,
  radius,
  shadow,
} from '../../lib/theme';

type PublicProfile = {
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    memberSince: string;
    currentStreak: number;
    longestStreak: number;
  };
  stats: {
    entered: number;
    wins: number;
    losses: number;
    winRate: number;
    longestCrossStreak: number;
    cheersReceived: number;
  };
  achievements: Array<{ id: string; title: string; emoji: string }>;
  recentCompletions: Array<{
    id: string;
    date: string;
    challengeTitle: string;
    challengeId: string;
    category: CategoryKey | null;
    cheerCount: number;
    viewerCheered: boolean;
  }>;
  isSelf: boolean;
};

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await apiRequest<PublicProfile>(`/users/${id}/public`, { token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => { void load(); }, [load]);

  const toggleCheer = async (
    progressId: string,
    currentlyCheered: boolean,
  ) => {
    // Optimistic update.
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        recentCompletions: d.recentCompletions.map((c) =>
          c.id === progressId
            ? {
                ...c,
                viewerCheered: !currentlyCheered,
                cheerCount: c.cheerCount + (currentlyCheered ? -1 : 1),
              }
            : c,
        ),
      };
    });
    try {
      const token = await getToken();
      await apiRequest(`/daily-progress/${progressId}/cheer`, {
        method: currentlyCheered ? 'DELETE' : 'POST',
        token,
      });
    } catch (err) {
      // Rollback.
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          recentCompletions: d.recentCompletions.map((c) =>
            c.id === progressId
              ? {
                  ...c,
                  viewerCheered: currentlyCheered,
                  cheerCount: c.cheerCount + (currentlyCheered ? 1 : -1),
                }
              : c,
          ),
        };
      });
      void err;
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

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Not found'}</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const u = data.user;
  const display = u.name?.trim() || 'User';
  const initial = display.charAt(0).toUpperCase();
  const memberSince = new Date(u.memberSince).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header bar */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.headerBack}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {data.isSelf ? (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>YOU</Text>
            </View>
          ) : null}
        </View>

        {/* Identity */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{display}</Text>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stat row */}
        <View style={styles.statRow}>
          <Stat label="Wins" value={String(data.stats.wins)} />
          <Stat label="Win rate" value={`${data.stats.winRate}%`} />
          <Stat label="Streak" value={`${u.currentStreak}${u.currentStreak > 0 ? ' 🔥' : ''}`} />
          <Stat label="Cheers" value={`${data.stats.cheersReceived} 👏`} />
        </View>

        {/* Badges */}
        {data.achievements.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badgeRow}>
              {data.achievements.map((a) => (
                <View key={a.id} style={styles.badge}>
                  <Text style={styles.badgeEmoji}>{a.emoji}</Text>
                  <Text style={styles.badgeTitle} numberOfLines={1}>{a.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Recent activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          {data.recentCompletions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyBody}>Completed days will show up here.</Text>
            </View>
          ) : (
            data.recentCompletions.map((c) => (
              <CompletionRow
                key={c.id}
                completion={c}
                isSelf={data.isSelf}
                onCheer={() => toggleCheer(c.id, c.viewerCheered)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CompletionRow({
  completion,
  isSelf,
  onCheer,
}: {
  completion: PublicProfile['recentCompletions'][number];
  isSelf: boolean;
  onCheer: () => void;
}) {
  const gradient = categoryGradient(completion.category);
  const emoji = completion.category ? categoryEmoji[completion.category] : '🎯';
  const label = completion.category ? categoryLabel[completion.category] : 'General';
  const date = new Date(`${completion.date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <View style={styles.row}>
      <View style={[styles.rowSwatch, { backgroundColor: gradient[0] }]}>
        <Text style={styles.rowSwatchText}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{completion.challengeTitle}</Text>
        <Text style={styles.rowMeta}>
          {label} · {date}
        </Text>
      </View>
      {isSelf ? (
        <View style={[styles.cheerPill, styles.cheerPillStatic]}>
          <Text style={styles.cheerPillTextStatic}>
            {completion.cheerCount} 👏
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={onCheer}
          style={({ pressed }) => [
            styles.cheerPill,
            completion.viewerCheered && styles.cheerPillActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[
              styles.cheerPillText,
              completion.viewerCheered && styles.cheerPillTextActive,
            ]}
          >
            👏 {completion.cheerCount}
          </Text>
        </Pressable>
      )}
    </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 20, paddingBottom: 60, gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerBack: { fontSize: 28, color: colors.ink, fontWeight: '700' },
  youPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  youPillText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },

  identityCard: {
    backgroundColor: colors.mint,
    borderRadius: radius.cardLg,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 32 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  memberSince: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },

  statRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMicro,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeEmoji: { fontSize: 16 },
  badgeTitle: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },

  emptyCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.card,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSwatch: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSwatchText: { fontSize: 18 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.textMuted },

  cheerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cheerPillActive: {
    backgroundColor: colors.mint,
    borderColor: colors.primary,
  },
  cheerPillStatic: { backgroundColor: 'transparent', borderColor: 'transparent' },
  cheerPillText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  cheerPillTextActive: { color: colors.primaryDark },
  cheerPillTextStatic: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  error: { color: colors.danger, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
