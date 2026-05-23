/**
 * Discover — Direction B reskin.
 *
 * Cream bg, chunky paper cards with hard offset shadows, orange/yellow
 * accent pills. The "Create your own challenge" CTA was already on
 * Direction B; the rest of the screen now matches.
 */

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

import {
  BCard,
  BEmpty,
  BPill,
  ScreenHeader,
} from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { CategoryKey, categoryEmoji, categoryLabel } from '../../lib/theme';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';
import { formatDateRange } from '../../lib/time';

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
  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, []),
  );

  const visible = selectedCategory
    ? challenges.filter((c) => c.category === selectedCategory)
    : challenges;

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
        <ScreenHeader eyebrow="Discover" highlight="Browse" after="↓" />

        <View style={{ paddingHorizontal: spacingB.lg }}>
          {/* Create your own challenge — already on Direction B, kept consistent */}
          <Pressable
            onPress={() => router.push('/create' as never)}
            style={({ pressed }) => [
              styles.createCta,
              pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
            ]}
          >
            <Text style={styles.createEmoji}>💸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.createTitle}>Create your own challenge</Text>
              <Text style={styles.createSub}>
                8-step builder · cash pools · friends & teams
              </Text>
            </View>
            <Text style={styles.createArrow}>→</Text>
          </Pressable>
        </View>

        {/* Category chips */}
        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="All"
              active={selectedCategory === null}
              onPress={() => setSelectedCategory(null)}
            />
            {categories.map((cat) => (
              <Chip
                key={cat.key}
                label={`${cat.emoji} ${cat.label}`}
                active={selectedCategory === cat.key}
                onPress={() =>
                  setSelectedCategory(selectedCategory === cat.key ? null : cat.key)
                }
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: spacingB.lg }}>
          {error ? (
            <Text style={[typeB.body, { color: colorsB.orangeDeep, marginBottom: spacingB.md }]}>
              {error}
            </Text>
          ) : null}

          {visible.length === 0 ? (
            <BEmpty
              emoji={selectedCategory ? '🔍' : '🌱'}
              title={
                selectedCategory
                  ? 'Nothing in this category yet'
                  : 'No challenges open right now'
              }
              body={
                selectedCategory
                  ? 'Try a different filter — or be the first to create one.'
                  : 'Pull down to refresh, or spin one up yourself.'
              }
              cta={{ label: 'Create one →', onPress: () => router.push('/create' as never) }}
            />
          ) : (
            <View style={{ gap: spacingB.lg }}>
              {visible.map((c) => (
                <DiscoverCard
                  key={c.id}
                  c={c}
                  onPress={() => router.push(`/challenge/${c.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DiscoverCard({ c, onPress }: { c: Challenge; onPress: () => void }) {
  const emoji = c.category ? categoryEmoji[c.category] : '🎯';
  const catLab = c.category ? categoryLabel[c.category] : 'General';

  const formatLabel =
    c.gameFormat === 'WEEKLY_QUOTA'
      ? `${Math.ceil(c.durationDays / 7)}-week game`
      : c.gameFormat === 'COMPLETION_COUNT'
        ? `${c.targetDaysComplete ?? c.durationDays}/${c.durationDays} days`
        : `${c.durationDays}-day streak`;

  return (
    <BCard onPress={onPress} large>
      {/* Top row: pills */}
      <View style={styles.cardTop}>
        <BPill label={`${emoji} ${catLab}`} tone="neutral" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <BPill label={c.status === 'OPEN' ? 'OPEN' : 'ACTIVE'} tone={c.status === 'OPEN' ? 'yellow' : 'blue'} />
          <BPill label={formatLabel} tone="ink" />
        </View>
      </View>

      <Text style={styles.cardTitle}>{c.title}</Text>
      {c.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {c.description}
        </Text>
      ) : null}
      <Text style={styles.cardDates}>{formatDateRange(c.startDate, c.endDate)}</Text>

      {/* Prize pool block — orange-tinted hero strip */}
      <View style={styles.poolBlock}>
        <View style={{ flex: 1 }}>
          <Text style={styles.poolLabel}>Prize pool</Text>
          <Text style={styles.poolValue}>${c.prizePool.toFixed(0)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.poolMeta}>${c.commitmentFee.toFixed(0)} stake</Text>
          <Text style={styles.poolMetaSub}>
            {c.participantCount} {c.participantCount === 1 ? 'player' : 'players'}
          </Text>
        </View>
      </View>
    </BCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  // Create CTA
  createCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacingB.lg,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    marginBottom: spacingB.lg,
    ...shadowsB.heroOrange,
  },
  createEmoji: { fontSize: 28 },
  createTitle: { fontSize: 15, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.2 },
  createSub: { fontSize: 11, fontWeight: '700', color: colorsB.inkSoft, marginTop: 2 },
  createArrow: { fontSize: 22, fontWeight: '900', color: colorsB.orange },

  // Chips
  chipRow: {
    gap: 8,
    paddingHorizontal: spacingB.lg,
    paddingBottom: spacingB.lg,
    paddingTop: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colorsB.ink,
    backgroundColor: colorsB.paper,
  },
  chipActive: { backgroundColor: colorsB.orange },
  chipText: { fontSize: 12, fontWeight: '900', color: colorsB.ink, letterSpacing: 0.2 },
  chipTextActive: { color: colorsB.paper },

  // Discover card
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingB.md,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: colorsB.inkSoft,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '600',
  },
  cardDates: {
    fontSize: 11,
    color: colorsB.inkFaint,
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  poolBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorsB.orangeSoft,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
    padding: spacingB.lg,
    marginTop: spacingB.lg,
  },
  poolLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  poolValue: {
    fontSize: 30,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  poolMeta: { fontSize: 12, fontWeight: '900', color: colorsB.ink },
  poolMetaSub: { fontSize: 10, fontWeight: '700', color: colorsB.inkSoft, marginTop: 2 },
});
