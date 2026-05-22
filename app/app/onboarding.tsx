import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  CategoryKey,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  colors,
  radius,
  shadow,
} from '../lib/theme';

type Screen = 'welcome' | 'categories' | 'how' | 'payment' | 'notifications' | 'done';
const ORDER: Screen[] = ['welcome', 'categories', 'how', 'payment', 'notifications', 'done'];

type Method = { last4: string; brand: string } | null;

const CATEGORIES_TO_SHOW: CategoryKey[] = [
  'FITNESS',
  'READING',
  'MINDFULNESS',
  'MONEY',
  'PRODUCTIVITY',
  'CREATIVE',
];

export default function Onboarding() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [screen, setScreen] = useState<Screen>('welcome');
  const [method, setMethod] = useState<Method>(null);
  const [attaching, setAttaching] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = ORDER.indexOf(screen);
  const next = () => {
    const n = ORDER[idx + 1];
    if (n) setScreen(n);
  };

  const onAttachTestCard = async () => {
    setAttaching(true);
    setError(null);
    try {
      const token = await getToken();
      await apiRequest('/payments/dev-attach-test-card', { method: 'POST', token });
      const { method: m } = await apiRequest<{ method: Method }>('/payments/method', { token });
      setMethod(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach test card');
    } finally {
      setAttaching(false);
    }
  };

  const onAllowNotifs = async () => {
    if (Platform.OS === 'web') {
      setNotifGranted(false);
      return;
    }
    try {
      const settings = await Notifications.requestPermissionsAsync();
      setNotifGranted(settings.granted);
    } catch {
      setNotifGranted(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const token = await getToken();
      const tz =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined;
      await apiRequest('/users/me', {
        method: 'PATCH',
        token,
        body: { hasCompletedOnboarding: true, ...(tz ? { timezone: tz } : {}) },
      });
      router.replace('/(tabs)/discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((idx + 1) / ORDER.length) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {screen === 'welcome' && (
          <View style={styles.welcomeWrap}>
            <Text style={styles.brandMark}>KAKI</Text>
            <Text style={styles.brandSub}>Buddy Challenges</Text>
            <GroupAvatarStage />
            <Text style={styles.h1Welcome}>
              Game on.{'\n'}
              <Text style={styles.h1Accent}>With stakes.</Text>
            </Text>
            <Text style={styles.lead}>
              The challenge app for friend groups and families.{'\n'}
              <Text style={styles.leadStrong}>Make a habit. Stake some money. Survive together.</Text>
            </Text>
            <Primary label="Get started" onPress={next} />
          </View>
        )}

        {screen === 'categories' && (
          <Layout>
            <Text style={styles.icon}>🎯</Text>
            <Text style={styles.h1}>Anything goes.</Text>
            <Text style={styles.lead}>
              Workout, read, meditate, save money, cut social media — whatever your crew's into.
            </Text>
            <View style={styles.catGrid}>
              {CATEGORIES_TO_SHOW.map((c) => (
                <CategoryTile key={c} cat={c} />
              ))}
              <View style={styles.catCreate}>
                <Text style={styles.catCreateEmoji}>✨</Text>
                <Text style={styles.catCreateText}>+ Create your own</Text>
              </View>
            </View>
            <Primary label="Cool, I'm in" onPress={next} />
          </Layout>
        )}

        {screen === 'how' && (
          <Layout>
            <Text style={styles.icon}>🎲</Text>
            <Text style={styles.h1}>How the game works</Text>
            <Step
              n={1}
              title="Start or join a challenge"
              body="Invite your crew, or join one open to anyone. Pick the daily habit + how many days."
              color={colors.primary}
            />
            <Step
              n={2}
              title="Everyone stakes in"
              body="$5, $10, $50 — your call. Goes into the shared pot. Skin in the game."
              color="#D97706"
            />
            <Step
              n={3}
              title="Last ones standing split it"
              body="Show up every day. Drop out? Your stake funds the survivors. 🍿"
              color="#EF476F"
            />
            <View style={styles.verifPills}>
              <View style={styles.verifPill}>
                <Text style={styles.verifPillText}>🏃 Auto-tracked</Text>
              </View>
              <View style={styles.verifPill}>
                <Text style={styles.verifPillText}>📷 Photo proof</Text>
              </View>
              <View style={styles.verifPill}>
                <Text style={styles.verifPillText}>✋ Honor tap</Text>
              </View>
            </View>
            <Primary label="Let's go" onPress={next} />
          </Layout>
        )}

        {screen === 'payment' && (
          <Layout>
            <Text style={styles.icon}>💳</Text>
            <Text style={styles.h1}>Stakes make it real.</Text>
            <Text style={styles.lead}>
              We only charge if you miss. Stripe holds the funds — we never touch them.
            </Text>
            {method ? (
              <View style={styles.savedCard}>
                <Text style={styles.savedCardTitle}>
                  {method.brand.toUpperCase()} •••• {method.last4}
                </Text>
                <Text style={styles.savedCardSub}>Saved ✓</Text>
              </View>
            ) : (
              <View style={styles.mintBigCard}>
                <Text style={styles.mintBigCardValue}>$0</Text>
                <Text style={styles.mintBigCardLabel}>Charged today · always</Text>
              </View>
            )}
            <View style={styles.lockNote}>
              <Text style={styles.lockNoteEmoji}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockNoteTitle}>No skin in the game = no challenge</Text>
                <Text style={styles.lockNoteBody}>
                  A card on file is what makes the bet real. Swap or remove it any time in Profile.
                </Text>
              </View>
            </View>
            <Primary
              label={attaching ? '' : method ? 'Replace test card' : 'Add a card (dev: test card)'}
              onPress={onAttachTestCard}
            >
              {attaching ? <ActivityIndicator color="#fff" /> : null}
            </Primary>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Secondary label={method ? 'Next' : "I'll do this later"} onPress={next} />
          </Layout>
        )}

        {screen === 'notifications' && (
          <Layout>
            <Text style={styles.icon}>🔔</Text>
            <Text style={styles.h1}>Don't be the first to drop.</Text>
            <Text style={styles.lead}>
              We ping you when your crew's ahead — or when you're about to lose.
            </Text>
            <NotifPreview
              emoji="🤘"
              title="Sarah just hit her day. Day 5 of 7."
              body="Cheer her on — or catch up before she laps you."
              accent
            />
            <NotifPreview
              emoji="⚠️"
              title="Danger zone — 3h left"
              body={'"You\'re 2,400 steps short."'}
            />
            <NotifPreview
              emoji="😱"
              title="Last-hour panic"
              body={'"$10 about to disappear."'}
            />
            <Primary
              label={notifGranted ? 'Enabled ✓' : 'Turn on notifications'}
              onPress={onAllowNotifs}
            />
            {notifGranted === false ? (
              <Text style={styles.warn}>
                Notifications blocked. You can re-enable them in your device settings.
              </Text>
            ) : null}
            <Secondary label="Skip" onPress={next} />
            {notifGranted ? <Primary label="Next" onPress={next} /> : null}
          </Layout>
        )}

        {screen === 'done' && (
          <Layout>
            <Text style={styles.mascot}>🎉</Text>
            <Text style={styles.h1}>You're in.</Text>
            <Text style={styles.lead}>
              Find a challenge that looks fun,{'\n'}
              <Text style={styles.leadStrong}>or start one and invite your crew.</Text>
            </Text>
            <View style={styles.donePillRow}>
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>📚 Read 30 min</Text>
              </View>
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>🧘 Meditate</Text>
              </View>
              <View style={styles.donePill}>
                <Text style={styles.donePillText}>💰 No-spend</Text>
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Primary
              label={finishing ? '' : 'Browse challenges →'}
              onPress={finish}
              disabled={finishing}
            >
              {finishing ? <ActivityIndicator color="#fff" /> : null}
            </Primary>
          </Layout>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 14 }}>{children}</View>;
}

function GroupAvatarStage() {
  return (
    <View style={styles.groupStage}>
      <View style={[styles.avCircle, styles.av3, { backgroundColor: '#F472B6' }]}>
        <Text style={styles.avEmoji}>😎</Text>
      </View>
      <View style={[styles.avCircle, styles.av1, { backgroundColor: colors.primary }]}>
        <Text style={styles.avEmoji}>🦘</Text>
      </View>
      <View style={[styles.avCircle, styles.av2, { backgroundColor: '#FBBF24' }]}>
        <Text style={styles.avEmoji}>🤘</Text>
      </View>
      <View style={[styles.avCircle, styles.av4, { backgroundColor: '#60A5FA' }]}>
        <Text style={styles.avEmoji}>🥹</Text>
      </View>
      <View style={[styles.avCircle, styles.av5, { backgroundColor: '#A78BFA' }]}>
        <Text style={styles.avEmoji}>😅</Text>
      </View>
    </View>
  );
}

function CategoryTile({ cat }: { cat: CategoryKey }) {
  const [a, b] = categoryGradient(cat);
  return (
    <View style={[styles.catTile, { backgroundColor: a, borderColor: b }]}>
      <Text style={styles.catTileEmoji}>{categoryEmoji[cat]}</Text>
      <Text style={styles.catTileLabel}>{categoryLabel[cat]}</Text>
    </View>
  );
}

function NotifPreview({
  emoji,
  title,
  body,
  accent,
}: {
  emoji: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.notifCard, accent && styles.notifCardAccent]}>
      <View style={[styles.notifEmojiBox, accent && styles.notifEmojiBoxAccent]}>
        <Text style={styles.notifEmoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.notifTitle}>{title}</Text>
        <Text style={styles.notifBody}>{body}</Text>
      </View>
    </View>
  );
}

function Primary({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, (pressed || disabled) && { opacity: 0.85 }]}
    >
      {children ?? <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function Step({
  n,
  title,
  body,
  color = colors.primary,
}: {
  n: number;
  title: string;
  body: string;
  color?: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNum, { backgroundColor: color }]}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progressBar: { height: 3, backgroundColor: colors.border },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  scroll: { padding: 24, gap: 16, paddingTop: 24, paddingBottom: 40 },

  /* Welcome */
  welcomeWrap: { gap: 16, alignItems: 'center' },
  brandMark: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -6,
  },

  groupStage: {
    height: 230,
    width: '100%',
    position: 'relative',
    marginTop: 8,
  },
  avCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    position: 'absolute',
    ...shadow.card,
  },
  av1: { left: '20%', top: 70 },
  av2: { right: '20%', top: 70 },
  av3: { left: '50%', top: 0, marginLeft: -40 },
  av4: { left: '14%', top: 140 },
  av5: { right: '14%', top: 140 },
  avEmoji: { fontSize: 32 },

  h1Welcome: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: 4,
  },
  h1Accent: { color: colors.primary },

  /* Generic */
  icon: { fontSize: 56, textAlign: 'center', marginTop: 8 },
  mascot: { fontSize: 72, textAlign: 'center' },
  h1: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  leadStrong: { color: colors.ink, fontWeight: '700' },

  /* Categories */
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  catTile: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    minHeight: 70,
    borderWidth: 1,
  },
  catTileEmoji: { fontSize: 22 },
  catTileLabel: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.1 },
  catCreate: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
  },
  catCreateEmoji: { fontSize: 18 },
  catCreateText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },

  /* How it works */
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 6 },
  stepNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  stepTitle: { fontWeight: '800', fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  stepBody: { color: colors.textMuted, lineHeight: 19, fontSize: 13 },

  verifPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  verifPill: {
    backgroundColor: colors.mint,
    borderColor: colors.mintDark,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verifPillText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },

  /* Payment */
  mintBigCard: {
    backgroundColor: colors.mint,
    borderRadius: radius.card,
    padding: 22,
    alignItems: 'center',
  },
  mintBigCardValue: { fontSize: 38, fontWeight: '800', color: colors.primary, letterSpacing: -0.8 },
  mintBigCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  lockNote: {
    backgroundColor: colors.bgSoft,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockNoteEmoji: { fontSize: 22 },
  lockNoteTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  lockNoteBody: { fontSize: 11, color: colors.textMuted, lineHeight: 15, marginTop: 2 },
  savedCard: {
    backgroundColor: colors.successBg,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  savedCardTitle: { fontWeight: '700', color: colors.success, fontSize: 16 },
  savedCardSub: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },

  /* Notifications */
  notifCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifCardAccent: { backgroundColor: '#FFF7ED', borderColor: '#FDE68A' },
  notifEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifEmojiBoxAccent: { backgroundColor: '#FBBF24' },
  notifEmoji: { fontSize: 18 },
  notifTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  notifBody: { fontSize: 11, color: colors.textMuted, lineHeight: 15, marginTop: 2 },

  /* Done */
  donePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  donePill: {
    backgroundColor: colors.mint,
    borderColor: colors.mintDark,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  donePillText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },

  /* Buttons */
  primary: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

  warn: { color: '#b45309', textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
});
