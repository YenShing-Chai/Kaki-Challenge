/**
 * Admin challenge review detail.
 *
 * Lists full challenge metadata + rule + winnerPool + recent audit log.
 * Provides Approve (publish) and Reject (cancel with reason) actions.
 * Server enforces ADMIN_EMAIL gate.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BCard, BPill, ScreenHeader } from '../../../components/themeB/screen';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../../lib/themeB';

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  creatorIntent: string | null;
  visibility: string | null;
  rewardType: string | null;
  riskLevel: string | null;
  moderationStatus: string | null;
  moderationReason: string | null;
  lifecycle: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorTrustScore: number | null;
};

type Rule = {
  winCondition: string;
  targetValue: string | null;
  requiredCount: number | null;
  allowedMisses: number | null;
  verificationLevel: string | null;
  metricType: string | null;
};

type WinnerPool = {
  id: string;
  entryContributionAmount: string;
  currency: string;
  distributionMethod: string;
  participantMinimum: number;
  participantMaximum: number;
  payoutStatus: string;
};

type AuditEntry = {
  action: string;
  actorType: string | null;
  actorId: string | null;
  newValue: unknown;
  createdAt: string;
};

type Dispute = {
  id: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'UPHELD' | 'REJECTED' | 'WITHDRAWN' | 'RESOLVED_VOID';
  disputeReason: string;
  description: string | null;
  raiserName: string;
  createdAt: string;
  resolution: string | null;
  resolvedAt: string | null;
};

type ResolveStatus = 'UPHELD' | 'REJECTED' | 'WITHDRAWN' | 'RESOLVED_VOID';
const RESOLVE_OPTIONS: Array<{ key: ResolveStatus; label: string; sub: string; tone: 'green' | 'paper' | 'ink' | 'orange' }> = [
  { key: 'UPHELD', label: 'Uphold dispute', sub: 'Disqualify / recalc winners', tone: 'green' },
  { key: 'REJECTED', label: 'Reject dispute', sub: 'No change — claim dismissed', tone: 'paper' },
  { key: 'WITHDRAWN', label: 'Mark withdrawn', sub: 'Raiser pulled it back', tone: 'paper' },
  { key: 'RESOLVED_VOID', label: 'Void challenge', sub: 'Refund everyone — last resort', tone: 'orange' },
];

export default function AdminChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [winnerPool, setWinnerPool] = useState<WinnerPool | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<
    'approve' | 'reject' | 'payout' | 'resolve' | null
  >(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dispute resolution flow
  const [resolveTarget, setResolveTarget] = useState<Dispute | null>(null);
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const data = await apiRequest<{
        challenge: Challenge;
        rule: Rule | null;
        winnerPool: WinnerPool | null;
        disputes: Dispute[];
        audit: AuditEntry[];
      }>(`/admin/challenges/${id}/detail`, { token });
      setChallenge(data.challenge);
      setRule(data.rule);
      setWinnerPool(data.winnerPool);
      setDisputes(data.disputes);
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!id || busy) return;
    setBusy('approve');
    try {
      const token = await getToken();
      await apiRequest(`/admin/challenges/${id}/approve`, { method: 'POST', token });
      Alert.alert('Approved', 'Challenge is now SCHEDULED and visible to participants.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Couldn't approve", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!id || busy) return;
    if (rejectReason.trim().length < 5) {
      Alert.alert('Add a reason', 'Tell the creator why — at least a sentence.');
      return;
    }
    setBusy('reject');
    try {
      const token = await getToken();
      await apiRequest(`/admin/challenges/${id}/reject`, {
        method: 'POST',
        token,
        body: { reason: rejectReason.trim() },
      });
      Alert.alert('Rejected', 'Challenge cancelled and creator notified.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Couldn't reject", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  // ─── Winner Pool payout approval (PRD Winner Pool §24.4) ────────────────
  const approvePayout = async () => {
    if (!winnerPool || busy) return;
    setBusy('payout');
    try {
      const token = await getToken();
      const res = await apiRequest<{ ok: boolean; count: number; lifecycle: string }>(
        `/admin/winner-pool/${winnerPool.id}/approve-payouts`,
        { method: 'POST', token },
      );
      Alert.alert(
        'Payouts approved',
        `${res.count} payout${res.count === 1 ? '' : 's'} flipped to READY. The internal cron will release via Stripe shortly.`,
      );
      await load();
    } catch (err) {
      Alert.alert(
        "Couldn't approve payout",
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setBusy(null);
    }
  };

  // ─── Dispute resolution ────────────────────────────────────────────────
  const resolveDispute = async () => {
    if (!resolveTarget || !resolveStatus || busy) return;
    if (resolveStatus === 'UPHELD' || resolveStatus === 'RESOLVED_VOID') {
      // Require a note for high-impact outcomes
      if (resolveNote.trim().length < 5) {
        Alert.alert('Add a note', 'A short reason is required for upheld / voided disputes.');
        return;
      }
    }
    setBusy('resolve');
    try {
      const token = await getToken();
      await apiRequest(`/admin/disputes/${resolveTarget.id}/resolve`, {
        method: 'POST',
        token,
        body: {
          status: resolveStatus,
          resolutionNote: resolveNote.trim() || undefined,
        },
      });
      Alert.alert('Dispute resolved', `Marked ${resolveStatus.replace(/_/g, ' ')}.`);
      setResolveTarget(null);
      setResolveStatus(null);
      setResolveNote('');
      await load();
    } catch (err) {
      Alert.alert("Couldn't resolve", err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
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
            {error ?? 'Challenge not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = challenge.moderationStatus === 'PENDING_REVIEW';
  const riskTone =
    challenge.riskLevel === 'HIGH' || challenge.riskLevel === 'PROHIBITED'
      ? 'orange'
      : challenge.riskLevel === 'MEDIUM'
        ? 'yellow'
        : 'green';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ADMIN · CHALLENGE</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader eyebrow={challenge.moderationStatus ?? 'review'} highlight="Review" />

        <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
          {/* Title + risk pill */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <BPill label={challenge.riskLevel ?? 'LOW'} tone={riskTone} size="sm" />
              {challenge.rewardType === 'WINNER_POOL' ? (
                <BPill label="💰 CASH POOL" tone="orange" size="sm" />
              ) : null}
              <BPill label={challenge.visibility ?? '—'} tone="neutral" size="sm" />
            </View>
            <Text style={styles.title}>{challenge.title}</Text>
            {challenge.description ? (
              <Text style={styles.desc}>{challenge.description}</Text>
            ) : null}
          </View>

          {/* Risk + moderation reason */}
          {challenge.moderationReason ? (
            <View style={styles.modBox}>
              <Text style={styles.modEyebrow}>Moderation flagged</Text>
              <Text style={styles.modText}>{challenge.moderationReason}</Text>
            </View>
          ) : null}

          {/* Creator */}
          <BCard>
            <Text style={typeB.eyebrow}>Created by</Text>
            <View style={styles.creatorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(challenge.creatorName.trim() || challenge.creatorEmail).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorName}>{challenge.creatorName}</Text>
                <Text style={styles.creatorMeta}>{challenge.creatorEmail}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.trustNum}>{challenge.creatorTrustScore ?? '—'}</Text>
                <Text style={styles.trustLabel}>trust</Text>
              </View>
            </View>
          </BCard>

          {/* Rule */}
          {rule ? (
            <BCard>
              <Text style={typeB.eyebrow}>Win condition</Text>
              <Text style={styles.ruleTitle}>{rule.winCondition.replace(/_/g, ' ')}</Text>
              <View style={styles.ruleGrid}>
                <RuleRow
                  label="Target"
                  value={rule.targetValue ? Number(rule.targetValue).toLocaleString() : '—'}
                />
                <RuleRow label="Required" value={rule.requiredCount?.toString() ?? '—'} />
                <RuleRow label="Misses" value={rule.allowedMisses?.toString() ?? '—'} />
                <RuleRow label="Verification" value={rule.verificationLevel ?? '—'} />
                <RuleRow label="Metric" value={rule.metricType ?? '—'} />
                <RuleRow label="Category" value={challenge.category ?? '—'} />
              </View>
            </BCard>
          ) : null}

          {/* Winner Pool */}
          {winnerPool ? (
            <BCard>
              <Text style={typeB.eyebrow}>Winner Pool · MYR</Text>
              <View style={styles.poolHeader}>
                <Text style={styles.poolAmount}>
                  RM{Number(winnerPool.entryContributionAmount).toFixed(0)}
                </Text>
                <Text style={styles.poolSub}>per participant</Text>
              </View>
              <View style={styles.ruleGrid}>
                <RuleRow label="Method" value={winnerPool.distributionMethod} />
                <RuleRow
                  label="Min / Max"
                  value={`${winnerPool.participantMinimum} – ${winnerPool.participantMaximum}`}
                />
                <RuleRow
                  label="Max pool"
                  value={`RM${(Number(winnerPool.entryContributionAmount) * winnerPool.participantMaximum).toFixed(0)}`}
                />
                <RuleRow label="Payout" value={winnerPool.payoutStatus} />
              </View>
            </BCard>
          ) : null}

          {/* Dates */}
          <BCard>
            <Text style={typeB.eyebrow}>Schedule</Text>
            <View style={styles.ruleGrid}>
              <RuleRow label="Start" value={formatDate(challenge.startAt)} />
              <RuleRow label="End" value={formatDate(challenge.endAt)} />
              <RuleRow label="Created" value={formatDate(challenge.createdAt)} />
              <RuleRow label="Lifecycle" value={challenge.lifecycle ?? '—'} />
            </View>
          </BCard>

          {/* Disputes — inline resolve */}
          {disputes.length > 0 ? (
            <View style={{ gap: spacingB.md }}>
              <Text style={typeB.eyebrow}>
                Disputes · {disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length} open
                / {disputes.length} total
              </Text>
              {disputes.map((d) => {
                const isOpen = d.status === 'OPEN' || d.status === 'UNDER_REVIEW';
                const tone = isOpen
                  ? 'orange'
                  : d.status === 'UPHELD'
                    ? 'green'
                    : 'neutral';
                return (
                  <BCard key={d.id} style={{ gap: spacingB.sm }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.disputeTitle}>
                        {d.disputeReason.replace(/_/g, ' ')}
                      </Text>
                      <BPill label={d.status} tone={tone} size="sm" />
                    </View>
                    <Text style={styles.disputeMeta}>
                      by {d.raiserName} · {formatAge(d.createdAt)}
                    </Text>
                    {d.description ? (
                      <Text style={styles.disputeBody} numberOfLines={4}>
                        "{d.description}"
                      </Text>
                    ) : null}
                    {d.resolution ? (
                      <View style={styles.resolutionNote}>
                        <Text style={styles.resolutionLabel}>Resolution</Text>
                        <Text style={styles.resolutionText}>{d.resolution}</Text>
                      </View>
                    ) : null}
                    {isOpen ? (
                      <Pressable
                        onPress={() => {
                          setResolveTarget(d);
                          setResolveStatus(null);
                          setResolveNote('');
                        }}
                        style={({ pressed }) => [
                          styles.resolveBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={styles.resolveBtnText}>Resolve →</Text>
                      </Pressable>
                    ) : null}
                  </BCard>
                );
              })}
            </View>
          ) : null}

          {/* Winner Pool payout approval */}
          {winnerPool ? <PayoutPanel
            winnerPool={winnerPool}
            challenge={challenge}
            openDisputes={disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length}
            busy={busy === 'payout'}
            onApprove={() =>
              Alert.alert(
                'Approve Winner Pool payouts?',
                'This flips all ON_HOLD payouts to READY. Stripe transfers happen on the next cron tick — make sure the dispute window is closed and there are no open disputes.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Approve', onPress: () => void approvePayout() },
                ],
              )
            }
          /> : null}

          {/* Audit log */}
          {audit.length > 0 ? (
            <View style={{ gap: spacingB.md }}>
              <Text style={typeB.eyebrow}>Audit · last {audit.length}</Text>
              {audit.slice(0, 5).map((a, i) => (
                <View key={i} style={styles.auditRow}>
                  <Text style={styles.auditAction}>{a.action.replace(/_/g, ' ')}</Text>
                  <Text style={styles.auditMeta}>
                    {a.actorType?.toLowerCase() ?? '—'} · {formatAge(a.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Actions */}
          {isPending ? (
            <View style={{ gap: spacingB.md, marginTop: spacingB.md }}>
              {showReject ? (
                <BCard>
                  <Text style={typeB.eyebrow}>Reject — tell the creator why</Text>
                  <TextInput
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="e.g. Cash buy-in exceeds RM 50 cap"
                    placeholderTextColor={colorsB.inkFaint}
                    multiline
                    maxLength={300}
                    style={styles.input}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: spacingB.md }}>
                    <Pressable
                      onPress={() => {
                        setShowReject(false);
                        setRejectReason('');
                      }}
                      style={({ pressed }) => [styles.btnPaper, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.btnPaperText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={reject}
                      disabled={busy === 'reject'}
                      style={({ pressed }) => [
                        styles.btnDanger,
                        busy === 'reject' && { opacity: 0.6 },
                        pressed && busy !== 'reject' && {
                          transform: [{ translateX: 2 }, { translateY: 2 }],
                          shadowOpacity: 0,
                        },
                      ]}
                    >
                      {busy === 'reject' ? (
                        <ActivityIndicator color={colorsB.paper} />
                      ) : (
                        <Text style={styles.btnDangerText}>Confirm reject →</Text>
                      )}
                    </Pressable>
                  </View>
                </BCard>
              ) : (
                <View style={{ flexDirection: 'row', gap: spacingB.md }}>
                  <Pressable
                    onPress={() => setShowReject(true)}
                    style={({ pressed }) => [styles.btnPaper, { flex: 1 }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.btnPaperText}>✗  Reject</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Approve challenge?', 'It will become SCHEDULED immediately.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Approve', onPress: approve },
                      ])
                    }
                    disabled={busy === 'approve'}
                    style={({ pressed }) => [
                      styles.btnGreen,
                      { flex: 1 },
                      busy === 'approve' && { opacity: 0.6 },
                      pressed && busy !== 'approve' && {
                        transform: [{ translateX: 2 }, { translateY: 2 }],
                        shadowOpacity: 0,
                      },
                    ]}
                  >
                    {busy === 'approve' ? (
                      <ActivityIndicator color={colorsB.paper} />
                    ) : (
                      <Text style={styles.btnGreenText}>✓  Approve</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.alreadyBox}>
              <Text style={styles.alreadyText}>
                Moderation status: {challenge.moderationStatus} · No challenge-level actions.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Dispute resolve sheet — overlay when resolveTarget is set */}
      <Modal
        visible={!!resolveTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve dispute</Text>
            <Text style={styles.modalSub}>
              {resolveTarget?.disputeReason.replace(/_/g, ' ')} · by {resolveTarget?.raiserName}
            </Text>

            <View style={{ gap: 8, marginTop: spacingB.sm }}>
              {RESOLVE_OPTIONS.map((opt) => {
                const active = resolveStatus === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setResolveStatus(opt.key)}
                    style={({ pressed }) => [
                      styles.resolveOpt,
                      active && styles.resolveOptActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resolveOptLabel, active && { color: colorsB.paper }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.resolveOptSub, active && { color: colorsB.bgWarm }]}>
                        {opt.sub}
                      </Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Text style={styles.radioMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 4, marginTop: spacingB.md }}>
              <Text style={typeB.eyebrow}>
                Note {resolveStatus === 'UPHELD' || resolveStatus === 'RESOLVED_VOID'
                  ? '(required)'
                  : '(optional)'}
              </Text>
              <TextInput
                value={resolveNote}
                onChangeText={setResolveNote}
                placeholder="What did you find? What action follows?"
                placeholderTextColor={colorsB.inkFaint}
                multiline
                maxLength={300}
                style={styles.input}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacingB.md }}>
              <Pressable
                onPress={() => {
                  setResolveTarget(null);
                  setResolveStatus(null);
                  setResolveNote('');
                }}
                style={({ pressed }) => [styles.btnPaper, { flex: 1 }, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnPaperText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={resolveDispute}
                disabled={!resolveStatus || busy === 'resolve'}
                style={({ pressed }) => [
                  styles.btnGreen,
                  { flex: 1 },
                  (!resolveStatus || busy === 'resolve') && { opacity: 0.5 },
                  pressed && resolveStatus && busy !== 'resolve' && {
                    transform: [{ translateX: 2 }, { translateY: 2 }],
                    shadowOpacity: 0,
                  },
                ]}
              >
                {busy === 'resolve' ? (
                  <ActivityIndicator color={colorsB.paper} />
                ) : (
                  <Text style={styles.btnGreenText}>Confirm →</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Winner Pool payout panel ─────────────────────────────────────────────

function PayoutPanel({
  winnerPool,
  challenge,
  openDisputes,
  busy,
  onApprove,
}: {
  winnerPool: WinnerPool;
  challenge: Challenge;
  openDisputes: number;
  busy: boolean;
  onApprove: () => void;
}) {
  const status = winnerPool.payoutStatus;
  const canApprove = status === 'ON_HOLD' && openDisputes === 0;
  const blockers: string[] = [];
  if (openDisputes > 0) blockers.push(`${openDisputes} open dispute${openDisputes === 1 ? '' : 's'}`);
  if (status !== 'ON_HOLD') blockers.push(`payout already ${status}`);
  if (challenge.lifecycle === 'CANCELLED' || challenge.lifecycle === 'SUSPENDED') {
    blockers.push(`challenge ${challenge.lifecycle}`);
  }

  const statusTone =
    status === 'ON_HOLD' ? 'yellow'
    : status === 'READY' ? 'green'
    : status === 'COMPLETED' ? 'green'
    : 'orange';

  const maxPool = Number(winnerPool.entryContributionAmount) * winnerPool.participantMaximum;

  return (
    <BCard>
      <View style={[styles.cardTop, { marginBottom: spacingB.sm }]}>
        <Text style={[typeB.eyebrow, { color: colorsB.orangeDeep }]}>💰 Winner Pool payout</Text>
        <BPill label={status} tone={statusTone} size="sm" />
      </View>

      <View style={styles.payoutHero}>
        <Text style={styles.payoutLabel}>Up to</Text>
        <Text style={styles.payoutValue}>
          {winnerPool.currency} {maxPool.toFixed(0)}
        </Text>
        <Text style={styles.payoutSub}>
          RM{Number(winnerPool.entryContributionAmount).toFixed(0)} × {winnerPool.participantMaximum} ·{' '}
          {winnerPool.distributionMethod.replace(/_/g, ' ').toLowerCase()}
        </Text>
      </View>

      {blockers.length > 0 ? (
        <View style={styles.blockerBox}>
          <Text style={styles.blockerEyebrow}>Blocked by</Text>
          {blockers.map((b, i) => (
            <Text key={i} style={styles.blockerItem}>
              • {b}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.cleanBox}>
          <Text style={styles.cleanText}>✓ No blockers. Safe to release.</Text>
        </View>
      )}

      <Pressable
        onPress={onApprove}
        disabled={!canApprove || busy}
        style={({ pressed }) => [
          styles.payoutBtn,
          (!canApprove || busy) && { opacity: 0.45 },
          pressed && canApprove && !busy && {
            transform: [{ translateX: 2 }, { translateY: 2 }],
            shadowOpacity: 0,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colorsB.paper} />
        ) : (
          <Text style={styles.payoutBtnText}>
            {status === 'ON_HOLD' ? '✓ Approve payouts →' : `Payout ${status}`}
          </Text>
        )}
      </Pressable>
    </BCard>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingB.lg,
    paddingTop: 4,
    paddingBottom: spacingB.sm,
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
  headerTitle: { fontSize: 10, fontWeight: '900', color: colorsB.orange, letterSpacing: 1.6 },

  title: { fontSize: 22, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.5, lineHeight: 26 },
  desc: { fontSize: 13, color: colorsB.inkSoft, lineHeight: 18, marginTop: 6, fontWeight: '600' },

  // Moderation reason
  modBox: {
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 2,
    borderColor: colorsB.orangeDeep,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    gap: 4,
  },
  modEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  modText: { fontSize: 13, color: colorsB.orangeDeep, fontWeight: '700', lineHeight: 18 },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacingB.md, marginTop: spacingB.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colorsB.paper, fontWeight: '900', fontSize: 16 },
  creatorName: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  creatorMeta: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700' },
  trustNum: { fontSize: 18, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.3 },
  trustLabel: {
    fontSize: 9,
    color: colorsB.inkFaint,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Rule grid
  ruleTitle: { fontSize: 16, fontWeight: '900', color: colorsB.ink, marginTop: 6, marginBottom: spacingB.md },
  ruleGrid: { gap: 4 },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colorsB.line,
  },
  ruleLabel: {
    fontSize: 11,
    color: colorsB.inkSoft,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ruleValue: { fontSize: 13, color: colorsB.ink, fontWeight: '800', maxWidth: '60%' },

  poolHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
    marginBottom: spacingB.md,
  },
  poolAmount: { fontSize: 30, fontWeight: '900', color: colorsB.orange, letterSpacing: -0.6 },
  poolSub: { fontSize: 12, color: colorsB.inkSoft, fontWeight: '700' },

  // Audit
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colorsB.line,
  },
  auditAction: { fontSize: 11, color: colorsB.ink, fontWeight: '900', letterSpacing: 0.3 },
  auditMeta: { fontSize: 10, color: colorsB.inkFaint, fontWeight: '700' },

  // Input
  input: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingHorizontal: spacingB.lg,
    paddingVertical: spacingB.md,
    fontSize: 13,
    color: colorsB.ink,
    backgroundColor: colorsB.paper,
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '600',
    marginTop: spacingB.sm,
  },

  // Buttons
  btnPaper: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPaperText: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  btnGreen: {
    backgroundColor: colorsB.green,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  btnGreenText: { fontSize: 14, fontWeight: '900', color: colorsB.paper },
  btnDanger: {
    flex: 1,
    backgroundColor: colorsB.orangeDeep,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  btnDangerText: { fontSize: 14, fontWeight: '900', color: colorsB.paper },

  alreadyBox: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderColor: colorsB.line,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    alignItems: 'center',
  },
  alreadyText: { fontSize: 12, color: colorsB.inkSoft, fontWeight: '700', textAlign: 'center' },

  // Card-top row used by dispute rows + payout header
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingB.md,
  },

  // ─── Dispute rows ────────────────────────────────────────────────────
  disputeTitle: { fontSize: 15, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.2 },
  disputeMeta: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700' },
  disputeBody: {
    fontSize: 13,
    color: colorsB.inkSoft,
    lineHeight: 18,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  resolutionNote: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 1.5,
    borderColor: colorsB.green,
    borderRadius: radiusB.control,
    padding: spacingB.sm,
    gap: 2,
  },
  resolutionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colorsB.green,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  resolutionText: { fontSize: 12, color: colorsB.ink, fontWeight: '700', lineHeight: 16 },
  resolveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colorsB.ink,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: spacingB.sm,
  },
  resolveBtnText: { color: colorsB.yellow, fontWeight: '900', fontSize: 11, letterSpacing: 0.4 },

  // ─── Payout panel ────────────────────────────────────────────────────
  payoutHero: {
    backgroundColor: colorsB.ink,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    gap: 2,
    marginBottom: spacingB.md,
    ...shadowsB.heroOrange,
  },
  payoutLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.yellow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  payoutValue: { fontSize: 32, fontWeight: '900', color: colorsB.paper, letterSpacing: -0.8, lineHeight: 36 },
  payoutSub: { fontSize: 11, color: colorsB.bgWarm, fontWeight: '700', marginTop: 4 },
  blockerBox: {
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 1.5,
    borderColor: colorsB.orangeDeep,
    borderRadius: radiusB.control,
    padding: spacingB.md,
    gap: 2,
    marginBottom: spacingB.md,
  },
  blockerEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  blockerItem: { fontSize: 12, color: colorsB.orangeDeep, fontWeight: '700' },
  cleanBox: {
    backgroundColor: colorsB.greenSoft,
    borderWidth: 1.5,
    borderColor: colorsB.green,
    borderRadius: radiusB.control,
    padding: spacingB.md,
    marginBottom: spacingB.md,
  },
  cleanText: { fontSize: 12, color: colorsB.green, fontWeight: '900' },
  payoutBtn: {
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadowsB.cardLg,
  },
  payoutBtnText: { color: colorsB.paper, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  // ─── Resolve modal ───────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingB.xl,
  },
  modalCard: {
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.cardLg,
    padding: spacingB.xl,
    width: '100%',
    ...shadowsB.cardLg,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.3 },
  modalSub: { fontSize: 12, color: colorsB.inkSoft, fontWeight: '700', marginTop: 4 },
  resolveOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingB.md,
    paddingVertical: spacingB.md,
    paddingHorizontal: spacingB.lg,
    backgroundColor: colorsB.bg,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
  },
  resolveOptActive: { backgroundColor: colorsB.ink },
  resolveOptLabel: { fontSize: 14, fontWeight: '900', color: colorsB.ink },
  resolveOptSub: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colorsB.ink,
    backgroundColor: colorsB.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: colorsB.orange, borderColor: colorsB.orange },
  radioMark: { color: colorsB.paper, fontWeight: '900', fontSize: 12 },
});
