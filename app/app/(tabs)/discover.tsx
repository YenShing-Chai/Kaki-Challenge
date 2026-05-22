import { useAuth } from '../../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
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
import {
  CategoryKey,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  colors,
  radius,
  shadow,
} from '../../lib/theme';

type Category = { key: CategoryKey; label: string; emoji: string };

type Challenge = {
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
  gameFormat: 'DAILY_STREAK' | 'WEEKLY_QUOTA' | 'COMPLETION_COUNT';
  activeStepGoal: number | null;
  powerStepGoal: number | null;
  weeklyActiveDays: number | null;
  weeklyPowerDays: number | null;
  weeklyFreeDays: number | null;
  category: CategoryKey | null;
  verificationMethod: 'AUTO_STEPS' | 'PHOTO_PROOF' | 'HONOR_TAP';
  targetDaysComplete: number | null;
};

export default function DiscoverTab() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      const [{ challenges: list }, { categories: cats }] = await Promise.all([
        apiRequest<{ challenges: Challenge[] }>('/challenges', { token }),
        apiRequest<{ categories: Category[] }>('/categories'),
      ]);
      setChallenges(list);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(useCallback(() => { void loadRef.current(); }, []));

  const visible = selectedCategory
    ? challenges.filter((c) => c.category === selectedCategory)
    : challenges;

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
        <Text style={styles.eyebrow}>Discover</Text>
        <Text style={styles.title}>Browse</Text>

        {/* Category chips */}
        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroller}
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[styles.chip, selectedCategory === null && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedCategory === null && styles.chipTextActive]}>
                All
              </Text>
            </Pressable>
            {categories.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(active ? null : cat.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {selectedCategory ? 'No challenges in this category' : 'No challenges open right now'}
            </Text>
            <Text style={styles.emptyBody}>
              {selectedCategory
                ? 'Try a different category or check back soon.'
                : 'Pull down to refresh.'}
            </Text>
          </View>
        ) : (
          visible.map((c) => (
            <DiscoverCard
              key={c.id}
              c={c}
              onPress={() => router.push(`/challenge/${c.id}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverCard({ c, onPress }: { c: Challenge; onPress: () => void }) {
  const gradient = categoryGradient(c.category);
  const emoji = c.category ? categoryEmoji[c.category] : '🎯';
  const catLabel = c.category ? categoryLabel[c.category] : 'General';

  const formatPill =
    c.gameFormat === 'WEEKLY_QUOTA'
      ? `${Math.ceil(c.durationDays / 7)}-week game`
      : c.gameFormat === 'COMPLETION_COUNT'
        ? `${c.targetDaysComplete ?? c.durationDays}/${c.durationDays} days`
        : `${c.durationDays}-day streak`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
    >
      {/* Hero gradient */}
      <LinearGradient
        colors={gradient as unknown as readonly [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{emoji} {catLabel}</Text>
        </View>
        <View style={styles.heroEmojiCircle}>
          <Text style={{ fontSize: 16 }}>{emoji}</Text>
        </View>
        <View style={styles.heroScrim} />
      </LinearGradient>

      <View style={styles.cardBody}>
        <View style={styles.cardMetaRow}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: c.status === 'OPEN' ? '#FEF3C7' : '#DBEAFE' },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: c.status === 'OPEN' ? '#854D0E' : '#1E40AF' },
              ]}
            >
              {c.status === 'OPEN' ? '🟡 OPEN' : '🔵 ACTIVE'}
            </Text>
          </View>
          <View style={styles.formatPill}>
            <Text style={styles.formatPillText}>{formatPill}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{c.title}</Text>
        {c.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {c.description}
          </Text>
        ) : null}
        <Text style={styles.cardDates}>{formatDateRange(c.startDate, c.endDate)}</Text>

        <View style={styles.poolBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.poolLabel}>Prize pool</Text>
            <Text style={styles.poolValue}>${c.prizePool.toFixed(0)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.poolMeta}>${c.commitmentFee.toFixed(0)} · {c.participantCount} in</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 0 },

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
    marginBottom: 16,
  },

  chipScroller: { marginHorizontal: -20, marginBottom: 16 },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: '#fff' },

  emptyCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.card,
    padding: 24,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.cardLg,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  hero: {
    height: 110,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    position: 'relative',
  },
  heroScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  heroEmojiCircle: {
    position: 'absolute', right: 10, top: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },

  cardBody: { padding: 16, gap: 8 },
  cardMetaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  formatPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  formatPillText: { fontSize: 10, fontWeight: '800', color: '#14532D' },

  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  cardDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  cardDates: { fontSize: 12, color: colors.textFaint, marginTop: 2 },

  poolBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radius.card,
    padding: 14,
    marginTop: 6,
  },
  poolLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  poolValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  poolMeta: { fontSize: 12, fontWeight: '600', color: colors.primaryDark },

  error: { color: colors.danger, marginBottom: 12 },
});
