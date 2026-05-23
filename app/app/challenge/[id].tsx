/**
 * Challenge Detail — Direction B reskin.
 *
 * Cream bg, chunky paper hero with orange offset shadow for the prize pool,
 * B-style leaderboard rows, orange chunky CTA. Winner Pool challenges route
 * through the 4-screen Join flow (handled by app/join/[id].tsx).
 */

import { useAuth } from '../../lib/auth';
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

import {
  BButton,
  BCard,
  BPill,
  BStat,
} from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { CategoryKey, categoryEmoji, categoryLabel } from '../../lib/theme';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';
import { formatDateRange } from '../../lib/time';

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
  // PRD v2 fields — null on legacy challenges
  rewardType?: string | null;
  lifecycle?: string | null;
  visibility?: string | null;
  winnerPool?: {
    entryContributionAmount: number;
    currency: string;
    totalPoolAmount: number;
  } | null;
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
  // # of pending peer reviews waiting on the current user — drives the
  // "X submissions need your review" banner.
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  // # of OPEN/UNDER_REVIEW disputes on this challenge — drives the
  // "⚠️ N open dispute(s)" banner near the top of the detail screen.
  const [openDisputeCount, setOpenDisputeCount] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const [{ challenge: c }, { method: m }, { rows: r }, { user }] = await Promise.all([
        apiRequest<{ challenge: ChallengeDetail }>(`/challenges/${id}`, { token }),
        apiRequest<{ method: Method }>('/payments/method', { token }),
        apiRequest<{ rows: LeaderboardRow[] }>(`/challenges/${id}/participants`, { token }),
        apiRequest<{ user: { id: string } | null }>('/users/me', { token }),
      ]);
      setChallenge(c);
      setMethod(m);
      setRows(r);
      setMeId(user?.id ?? null);

      // Peer-review queue — only fetched if the user is a participant. The
      // endpoint also gates on participant server-side so we tolerate 403.
      if (c.userParticipation) {
        try {
          const { submissions } = await apiRequest<{ submissions: unknown[] }>(
            `/api/challenges/${id}/submissions/pending-review`,
            { token },
          );
          setPendingReviewCount(submissions.length);
        } catch {
          setPendingReviewCount(0);
        }
      } else {
        setPendingReviewCount(0);
      }

      // Dispute count — fetched for everyone (anyone affected can see).
      try {
        const { openCount } = await apiRequest<{ openCount: number }>(
          `/api/challenges/${id}/disputes`,
          { token },
        );
        setOpenDisputeCount(openCount);
      } catch {
        setOpenDisputeCount(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

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
    // Winner Pool challenges go through the 4-screen Direction B Join flow.
    if (challenge?.rewardType === 'WINNER_POOL') {
      router.push(`/join/${id}` as never);
      return;
    }
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
        <View style={styles.center}>
          <ActivityIndicator color={colorsB.orange} />
        </View>
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>
            {error ?? 'Not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const alreadyIn = Boolean(challenge.userParticipation);
  const canJoin = challenge.status === 'OPEN' && !alreadyIn;
  const isWeekly = challenge.gameFormat === 'WEEKLY_QUOTA';
  const isCompletion = challenge.gameFormat === 'COMPLETION_COUNT';
  const isWinnerPool = challenge.rewardType === 'WINNER_POOL';
  const weeks = Math.ceil(challenge.durationDays / 7);
  const stepsK = Math.round(challenge.dailyStepGoal / 1000);
  const catLab = challenge.category ? categoryLabel[challenge.category] : 'General';
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
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {alreadyIn ? (
            <BPill label={`🟢 ${challenge.userParticipation?.status}`} tone="green" />
          ) : challenge.status === 'OPEN' ? (
            <BPill label="🟡 OPEN" tone="yellow" />
          ) : (
            <BPill label="🔵 ACTIVE" tone="blue" />
          )}
        </View>

        {/* Title block */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: spacingB.md }}>
          <BPill label={`${catEm} ${catLab}`} tone="neutral" />
          <BPill label={`${challenge.durationDays} days`} tone="neutral" />
          <BPill label={verifLabel} tone="neutral" />
          {isWinnerPool ? <BPill label="💰 CASH POOL" tone="orange" /> : null}
        </View>

        {/* Dispute banner — anyone can see this when there's an open dispute */}
        {openDisputeCount > 0 ? (
          <Pressable
            onPress={() => router.push(`/dispute/${id}` as never)}
            style={({ pressed }) => [
              styles.disputeBanner,
              pressed && {
                transform: [{ translateX: 2 }, { translateY: 2 }],
                shadowOpacity: 0,
              },
            ]}
          >
            <Text style={styles.disputeBannerEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.disputeBannerTitle}>
                {openDisputeCount} open dispute{openDisputeCount === 1 ? '' : 's'} — payout locked
              </Text>
              <Text style={styles.disputeBannerSub}>Tap to see details</Text>
            </View>
            <Text style={styles.disputeBannerArrow}>→</Text>
          </Pressable>
        ) : null}

        {/* Peer-review banner — only shows when the user has submissions to review */}
        {alreadyIn && pendingReviewCount > 0 ? (
          <Pressable
            onPress={() => router.push(`/review/${id}` as never)}
            style={({ pressed }) => [
              styles.reviewBanner,
              pressed && {
                transform: [{ translateX: 2 }, { translateY: 2 }],
                shadowOpacity: 0,
              },
            ]}
          >
            <Text style={styles.reviewBannerEmoji}>👥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewBannerTitle}>
                {pendingReviewCount}{' '}
                {pendingReviewCount === 1 ? 'submission needs' : 'submissions need'} your review
              </Text>
              <Text style={styles.reviewBannerSub}>Tap to vote — 30 seconds each</Text>
            </View>
            <Text style={styles.reviewBannerArrow}>→</Text>
          </Pressable>
        ) : null}

        <Text style={styles.title}>{challenge.title}</Text>
        {challenge.description ? (
          <Text style={styles.desc}>{challenge.description}</Text>
        ) : null}
        <Text style={styles.dates}>
          {formatDateRange(challenge.startDate, challenge.endDate)}
        </Text>

        {/* Prize hero — ink box with orange offset shadow */}
        <View style={styles.poolHero}>
          <Text style={styles.poolLabel}>Prize pool</Text>
          <Text style={styles.poolValue}>
            {isWinnerPool && challenge.winnerPool
              ? `RM${challenge.winnerPool.totalPoolAmount.toFixed(0)}`
              : `$${challenge.prizePool.toFixed(0)}`}
          </Text>
          <Text style={styles.poolSub}>
            {challenge.participantCount}{' '}
            {challenge.participantCount === 1 ? 'player' : 'players'} ·{' '}
            {isCompletion
              ? `Hit ${challenge.targetDaysComplete ?? '?'} of ${challenge.durationDays} days to share`
              : isWeekly
                ? `${weeks} weeks · weekly quota to qualify`
                : 'Complete all days to qualify'}
          </Text>
        </View>

        {/* Quick stats */}
        <View style={styles.statRow}>
          <BStat
            label="Stake"
            value={
              isWinnerPool && challenge.winnerPool
                ? `RM${challenge.winnerPool.entryContributionAmount.toFixed(0)}`
                : `$${challenge.commitmentFee.toFixed(0)}`
            }
          />
          <BStat label="Players" value={String(challenge.participantCount)} />
          {isWeekly ? (
            <BStat label="Format" value={`${weeks}wk`} />
          ) : isCompletion ? (
            <BStat
              label="Target"
              value={`${challenge.targetDaysComplete}/${challenge.durationDays}`}
            />
          ) : (
            <BStat label="Steps" value={`${stepsK}k`} />
          )}
          <BStat label="Length" value={`${challenge.durationDays}d`} />
        </View>

        {/* Weekly tier breakdown */}
        {isWeekly && challenge.activeStepGoal && challenge.powerStepGoal ? (
          <BCard style={{ gap: 10, marginTop: spacingB.lg }}>
            <Text style={styles.sectionTitle}>Your weekly mix</Text>
            <TierRow
              icon="⚡"
              count={challenge.weeklyPowerDays ?? 0}
              label="Power"
              goal={`${challenge.powerStepGoal.toLocaleString()} steps`}
              tint={colorsB.yellow}
            />
            <TierRow
              icon="✓"
              count={challenge.weeklyActiveDays ?? 0}
              label="Active"
              goal={`${challenge.activeStepGoal.toLocaleString()} steps`}
              tint={colorsB.green}
            />
            <TierRow
              icon="🌙"
              count={challenge.weeklyFreeDays ?? 0}
              label="Free"
              goal="rest day"
              tint={colorsB.inkFaint}
            />
          </BCard>
        ) : null}

        {/* How it works */}
        <BCard style={{ gap: spacingB.md, marginTop: spacingB.lg }}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Step
            n={1}
            title={
              isWinnerPool && challenge.winnerPool
                ? `Buy in RM${challenge.winnerPool.entryContributionAmount.toFixed(0)}`
                : `Commit $${challenge.commitmentFee.toFixed(0)}`
            }
            body={isWinnerPool ? 'Held by Stripe until the challenge ends.' : 'Held on your card. Joins the pot.'}
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
              title="Snap a photo each day"
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
        </BCard>

        {/* Leaderboard */}
        <Leaderboard
          rows={rows}
          meId={meId}
          onToggleCheer={toggleCheer}
          onOpenProfile={(uid) => router.push(`/u/${uid}`)}
        />

        {error ? (
          <Text style={[typeB.body, { color: colorsB.orangeDeep, marginTop: spacingB.lg }]}>
            {error}
          </Text>
        ) : null}

        {/* CTA */}
        <View style={{ marginTop: spacingB.xl }}>
          {alreadyIn ? (
            challenge.verificationMethod === 'HONOR_TAP' ? (
              (() => {
                const meRow = rows.find((r) => r.userId === meId);
                const todayDone = meRow?.todayCompleted ?? false;
                if (todayDone) {
                  return (
                    <View style={styles.ctaDone}>
                      <Text style={styles.ctaDoneText}>✓ Done for today</Text>
                    </View>
                  );
                }
                return (
                  <Pressable
                    onPress={markDone}
                    disabled={marking}
                    style={({ pressed }) => [
                      styles.cta,
                      (pressed || marking) && {
                        transform: [{ translateX: 2 }, { translateY: 2 }],
                        shadowOpacity: 0,
                      },
                    ]}
                  >
                    {marking ? (
                      <ActivityIndicator color={colorsB.paper} />
                    ) : (
                      <Text style={styles.ctaText}>Mark today done →</Text>
                    )}
                  </Pressable>
                );
              })()
            ) : challenge.verificationMethod === 'PHOTO_PROOF' ? (
              <Pressable
                onPress={() => router.push(`/submit/${id}` as never)}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                <Text style={styles.ctaText}>📷 Submit proof →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/(tabs)')}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                <Text style={styles.ctaText}>You're in — go to Home →</Text>
              </Pressable>
            )
          ) : canJoin ? (
            isWinnerPool ? (
              // Winner Pool routes through the dedicated 4-screen Join flow.
              <Pressable
                onPress={join}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                <Text style={styles.ctaText}>
                  Join — RM{challenge.winnerPool?.entryContributionAmount.toFixed(0) ?? '?'} buy-in →
                </Text>
              </Pressable>
            ) : method ? (
              <Pressable
                onPress={join}
                disabled={joining}
                style={({ pressed }) => [
                  styles.cta,
                  (pressed || joining) && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                {joining ? (
                  <ActivityIndicator color={colorsB.paper} />
                ) : (
                  <Text style={styles.ctaText}>
                    Join — ${challenge.commitmentFee.toFixed(0)} on {method.brand.toUpperCase()} ••••{' '}
                    {method.last4}
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
                <BButton
                  label={attaching ? 'Attaching…' : 'Attach test card (dev)'}
                  tone="orange"
                  onPress={attachTestCard}
                  disabled={attaching}
                  style={{ marginTop: spacingB.md }}
                />
              </>
            )
          ) : (
            <View style={styles.warnCard}>
              <Text style={styles.warnTitle}>Closed</Text>
              <Text style={styles.warnBody}>This challenge is no longer accepting joiners.</Text>
            </View>
          )}

          {/* Raise-a-dispute link — visible to anyone, server enforces window/eligibility */}
          {(alreadyIn || openDisputeCount > 0) && challenge.lifecycle !== 'CANCELLED' ? (
            <Pressable
              onPress={() => router.push(`/dispute/${id}` as never)}
              style={({ pressed }) => [
                styles.disputeLink,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.disputeLinkText}>
                {openDisputeCount > 0
                  ? `View ${openDisputeCount} dispute${openDisputeCount === 1 ? '' : 's'}`
                  : 'Something off? Raise a dispute'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TierRow({
  icon,
  count,
  label,
  goal,
  tint,
}: {
  icon: string;
  count: number;
  label: string;
  goal: string;
  tint: string;
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
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
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
      <BCard style={{ gap: spacingB.md, marginTop: spacingB.lg, alignItems: 'center' }}>
        <Text style={styles.sectionTitle}>Players</Text>
        <Text style={[typeB.lead, { textAlign: 'center' }]}>No one's in yet. Be the first.</Text>
      </BCard>
    );
  }
  const myRow = meId ? rows.find((r) => r.userId === meId) : null;
  const others = myRow ? rows.filter((r) => r.userId !== meId) : rows;

  return (
    <View style={{ marginTop: spacingB.lg, gap: spacingB.md }}>
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
      <View style={[styles.lbAvatar, highlighted && styles.lbAvatarHighlight]}>
        <Text style={[styles.lbAvatarText, highlighted && styles.lbAvatarTextHighlight]}>
          {row.avatarInitial}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.lbHeader}>
          <Text style={[styles.lbName, highlighted && { fontWeight: '900' }]}>{displayName}</Text>
          <Text style={styles.lbSteps}>
            {row.daysCompleted}/{row.daysTotal}
          </Text>
        </View>
        <View style={styles.lbProgress}>
          <View
            style={[styles.lbProgressFill, { width: `${pct * 100}%`, backgroundColor: progressColor(row) }]}
          />
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
            <BPill label={badge.label} tone={badge.tone} size="sm" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function statusBadge(row: LeaderboardRow): {
  label: string;
  tone: 'yellow' | 'green' | 'orange' | 'neutral';
} {
  if (row.status === 'QUALIFIED') return { label: 'WINNER 🏆', tone: 'yellow' };
  if (row.status === 'ELIMINATED') return { label: 'OUT 💀', tone: 'orange' };
  if (row.todayCompleted) return { label: 'DONE ✅', tone: 'green' };
  const pct = row.todayGoal > 0 ? row.todaySteps / row.todayGoal : 0;
  if (pct >= 0.7) return { label: 'ON TRACK', tone: 'yellow' };
  return { label: 'BEHIND', tone: 'neutral' };
}

function progressColor(row: LeaderboardRow): string {
  if (row.status === 'ELIMINATED') return colorsB.orangeDeep;
  if (row.status === 'QUALIFIED' || row.todayCompleted) return colorsB.green;
  return colorsB.orange;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacingB.lg, paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    marginBottom: spacingB.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '900', color: colorsB.ink },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.6,
    marginBottom: spacingB.sm,
    lineHeight: 32,
  },
  desc: { fontSize: 14, color: colorsB.inkSoft, lineHeight: 20, marginBottom: 4, fontWeight: '600' },
  dates: {
    fontSize: 11,
    color: colorsB.inkFaint,
    marginBottom: spacingB.lg,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Dispute banner — orange-tint card warning of locked payout
  disputeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingB.md,
    paddingVertical: spacingB.md,
    paddingHorizontal: spacingB.lg,
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 2,
    borderColor: colorsB.orangeDeep,
    borderRadius: radiusB.card,
    marginBottom: spacingB.md,
    ...shadowsB.card,
  },
  disputeBannerEmoji: { fontSize: 22 },
  disputeBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    letterSpacing: -0.1,
  },
  disputeBannerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: colorsB.orangeDeep,
    marginTop: 2,
  },
  disputeBannerArrow: { fontSize: 22, fontWeight: '900', color: colorsB.orangeDeep },

  // Raise-a-dispute footer link
  disputeLink: {
    alignItems: 'center',
    paddingVertical: spacingB.md,
    marginTop: spacingB.md,
  },
  disputeLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colorsB.inkSoft,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },

  // Peer-review banner — paper card with yellow scribble accent
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingB.md,
    paddingVertical: spacingB.md,
    paddingHorizontal: spacingB.lg,
    backgroundColor: colorsB.yellow,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    marginBottom: spacingB.lg,
    ...shadowsB.card,
  },
  reviewBannerEmoji: { fontSize: 24 },
  reviewBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colorsB.ink,
    letterSpacing: -0.1,
  },
  reviewBannerSub: { fontSize: 11, fontWeight: '700', color: colorsB.ink, marginTop: 2 },
  reviewBannerArrow: { fontSize: 22, fontWeight: '900', color: colorsB.ink },

  // Prize hero — ink box, orange offset shadow, yellow eyebrow
  poolHero: {
    backgroundColor: colorsB.ink,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.xl,
    marginBottom: spacingB.lg,
    ...shadowsB.heroOrange,
  },
  poolLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.yellow,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  poolValue: {
    fontSize: 50,
    fontWeight: '900',
    color: colorsB.paper,
    letterSpacing: -1.2,
    marginTop: 4,
    lineHeight: 54,
  },
  poolSub: { fontSize: 12, fontWeight: '700', color: colorsB.bgWarm, marginTop: 6 },

  statRow: { flexDirection: 'row', gap: 8 },

  sectionTitle: { fontSize: 14, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.2 },

  // Weekly tier rows
  tierRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 14,
    borderLeftWidth: 4,
    backgroundColor: colorsB.bgWarm,
    borderRadius: radiusB.control,
  },
  tierIcon: { fontSize: 18 },
  tierTitle: { fontWeight: '900', fontSize: 13, color: colorsB.ink },
  tierBody: { color: colorsB.inkSoft, fontSize: 11, fontWeight: '700' },

  // How-it-works steps
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 2 },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colorsB.paper, fontWeight: '900', fontSize: 13 },
  stepTitle: { fontWeight: '900', fontSize: 14, color: colorsB.ink },
  stepBody: { color: colorsB.inkSoft, lineHeight: 18, fontSize: 12, fontWeight: '600' },

  // CTA
  cta: {
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  ctaText: { color: colorsB.paper, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  ctaDone: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 2,
    borderColor: colorsB.green,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
  },
  ctaDoneText: { color: colorsB.green, fontWeight: '900', fontSize: 15 },
  ctaDisabled: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderColor: colorsB.line,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
  },
  ctaDisabledText: { color: colorsB.inkSoft, fontWeight: '800', fontSize: 14 },

  // Warn card
  warnCard: {
    backgroundColor: colorsB.orangeSoft,
    borderColor: colorsB.orangeDeep,
    borderWidth: 2,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    gap: 4,
  },
  warnTitle: { fontWeight: '900', color: colorsB.orangeDeep, fontSize: 13 },
  warnBody: { color: colorsB.orangeDeep, fontSize: 12, lineHeight: 17, fontWeight: '700' },

  // Leaderboard rows
  lbRow: {
    flexDirection: 'row',
    gap: spacingB.lg,
    padding: spacingB.md,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.line,
    backgroundColor: colorsB.paper,
    alignItems: 'center',
  },
  lbRowHighlight: {
    backgroundColor: colorsB.orangeSoft,
    borderColor: colorsB.ink,
    ...shadowsB.card,
  },
  lbAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsB.bgWarm,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbAvatarHighlight: { backgroundColor: colorsB.orange },
  lbAvatarText: { fontWeight: '900', color: colorsB.ink, fontSize: 14 },
  lbAvatarTextHighlight: { color: colorsB.paper },
  lbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbName: { fontWeight: '800', fontSize: 14, color: colorsB.ink },
  lbSteps: { color: colorsB.inkSoft, fontSize: 12, fontWeight: '900' },
  lbProgress: {
    height: 6,
    backgroundColor: colorsB.line,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colorsB.ink,
  },
  lbProgressFill: { height: '100%' },
  lbFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbDay: { color: colorsB.inkFaint, fontSize: 10, fontWeight: '700' },

  // Cheer button
  cheerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colorsB.bgWarm,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
  },
  cheerBtnActive: { backgroundColor: colorsB.orange, borderColor: colorsB.ink },
  cheerBtnText: { fontSize: 10, fontWeight: '900', color: colorsB.inkSoft },
  cheerBtnTextActive: { color: colorsB.paper },
  cheerCountStatic: { fontSize: 10, fontWeight: '800', color: colorsB.inkFaint },
});
