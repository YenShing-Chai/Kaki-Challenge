/**
 * Dispute screen.
 *
 * Lets a participant or affected party raise a dispute against a challenge
 * result, submission, or payout. Disputes lock the payout until an admin
 * resolves them (PRD §12 + Winner Pool §18).
 *
 * Server contract:
 *   GET  /api/challenges/:id/disputes      → list existing (read-only)
 *   POST /api/challenges/:id/disputes      → raise one
 *     { disputeReason, description, submissionId?, participantId? }
 *
 * Valid reasons (server enforced): FAKE_PROOF, WRONG_SCORE, LATE_SUBMISSION,
 * RULE_VIOLATION, DUPLICATE_PROOF, UNSAFE_BEHAVIOR, OTHER.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BCard, BPill, ScreenHeader } from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type DisputeReason =
  | 'FAKE_PROOF'
  | 'WRONG_SCORE'
  | 'LATE_SUBMISSION'
  | 'RULE_VIOLATION'
  | 'DUPLICATE_PROOF'
  | 'UNSAFE_BEHAVIOR'
  | 'OTHER';

type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'UPHELD'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'RESOLVED_VOID';

type Dispute = {
  id: string;
  status: DisputeStatus;
  disputeReason: string;
  description: string | null;
  raiserName: string;
  raiserInitial: string;
  createdAt: string;
  isMine: boolean;
};

const REASONS: Array<{ key: DisputeReason; emoji: string; label: string; sub: string }> = [
  { key: 'FAKE_PROOF', emoji: '🎭', label: 'Fake proof', sub: 'Photo looks staged or stolen' },
  { key: 'WRONG_SCORE', emoji: '🔢', label: 'Wrong score', sub: 'Numbers do not add up' },
  { key: 'LATE_SUBMISSION', emoji: '⏰', label: 'Late submission', sub: 'Submitted after the deadline' },
  { key: 'RULE_VIOLATION', emoji: '🚫', label: 'Rule violation', sub: 'Broke the challenge terms' },
  { key: 'DUPLICATE_PROOF', emoji: '👯', label: 'Duplicate proof', sub: 'Same photo as another day' },
  { key: 'UNSAFE_BEHAVIOR', emoji: '🚨', label: 'Unsafe behaviour', sub: 'Harm to self or others' },
  { key: 'OTHER', emoji: '✦', label: 'Other', sub: 'Describe it in the note' },
];

export default function DisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [existing, setExisting] = useState<Dispute[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const { disputes, openCount: oc } = await apiRequest<{
        disputes: Dispute[];
        openCount: number;
      }>(`/api/challenges/${id}/disputes`, { token });
      setExisting(disputes);
      setOpenCount(oc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!id || submitting) return;
    if (!reason) {
      Alert.alert('Pick a reason', 'Select what went wrong before submitting.');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert(
        'Add a note',
        'Tell the admin what happened — at least a sentence. They can\'t investigate without context.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      await apiRequest<{ id: string; status: string }>(`/api/challenges/${id}/disputes`, {
        method: 'POST',
        token,
        body: {
          disputeReason: reason,
          description: description.trim(),
        },
      });
      Alert.alert(
        'Dispute filed',
        "An admin will review within 48 hours. The payout is locked until it's resolved.",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      Alert.alert('Could not file', parseDisputeError(msg));
    } finally {
      setSubmitting(false);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Dispute</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            eyebrow="Dispute"
            before="Something"
            highlight="off?"
            after="⚠️"
          />

          <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
            {error ? (
              <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
            ) : null}

            {/* Existing disputes — read-only audit trail */}
            {existing.length > 0 ? (
              <View style={{ gap: spacingB.md }}>
                <Text style={typeB.eyebrow}>
                  {openCount > 0
                    ? `${openCount} open · ${existing.length} total`
                    : `${existing.length} resolved`}
                </Text>
                {existing.map((d) => (
                  <DisputeRow key={d.id} d={d} />
                ))}
              </View>
            ) : null}

            {/* Warning callout */}
            <View style={styles.warnBox}>
              <Text style={styles.warnEmoji}>⚠️</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.warnTitle}>This locks the payout</Text>
                <Text style={styles.warnBody}>
                  Filing a dispute pauses any prize/refund until an admin reviews it. False or
                  vexatious disputes affect your trust score.
                </Text>
              </View>
            </View>

            {/* Reason picker */}
            <View style={{ gap: spacingB.md }}>
              <Text style={typeB.eyebrow}>Pick a reason</Text>
              {REASONS.map((r) => (
                <ReasonTile
                  key={r.key}
                  reason={r}
                  active={reason === r.key}
                  onPress={() => setReason(r.key)}
                />
              ))}
            </View>

            {/* Description */}
            <View style={{ gap: 6 }}>
              <Text style={typeB.eyebrow}>What happened?</Text>
              <Text style={styles.fieldHint}>
                Be specific. Reference dates, photo links, or participant names. Min 10 characters.
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. The winning photo on day 3 was clearly Photoshopped — the shadows don't match."
                placeholderTextColor={colorsB.inkFaint}
                multiline
                maxLength={500}
                style={styles.input}
              />
              <Text style={styles.charCount}>{description.length} / 500</Text>
            </View>

            {/* Submit */}
            <Pressable
              onPress={submit}
              disabled={submitting || !reason}
              style={({ pressed }) => [
                styles.submitBtn,
                (submitting || !reason) && { opacity: 0.5 },
                pressed && !submitting && reason && {
                  transform: [{ translateX: 2 }, { translateY: 2 }],
                  shadowOpacity: 0,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colorsB.paper} />
              ) : (
                <Text style={styles.submitText}>File dispute →</Text>
              )}
            </Pressable>

            <Text style={styles.footer}>
              By submitting you agree the information is true to the best of your knowledge.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ReasonTile({
  reason,
  active,
  onPress,
}: {
  reason: { key: DisputeReason; emoji: string; label: string; sub: string };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.reasonTile,
        active && styles.reasonTileActive,
        pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
      ]}
    >
      <Text style={styles.reasonEmoji}>{reason.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reasonLabel, active && { color: colorsB.paper }]}>
          {reason.label}
        </Text>
        <Text style={[styles.reasonSub, active && { color: colorsB.bgWarm }]}>
          {reason.sub}
        </Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <Text style={styles.radioMark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

function DisputeRow({ d }: { d: Dispute }) {
  const tone =
    d.status === 'OPEN' || d.status === 'UNDER_REVIEW'
      ? 'orange'
      : d.status === 'UPHELD'
        ? 'green'
        : 'neutral';
  const statusLabel = STATUS_LABEL[d.status] ?? d.status;
  return (
    <BCard style={{ gap: spacingB.sm }}>
      <View style={styles.disputeHead}>
        <View style={styles.disputeAvatar}>
          <Text style={styles.disputeAvatarText}>{d.raiserInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.disputeReason}>
            {(REASONS.find((r) => r.key === d.disputeReason)?.label ?? d.disputeReason)}
          </Text>
          <Text style={styles.disputeMeta}>
            {d.isMine ? 'You' : d.raiserName} · {formatTime(d.createdAt)}
          </Text>
        </View>
        <BPill label={statusLabel} tone={tone} size="sm" />
      </View>
      {d.description ? (
        <Text style={styles.disputeBody} numberOfLines={3}>
          "{d.description}"
        </Text>
      ) : null}
    </BCard>
  );
}

const STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'REVIEWING',
  UPHELD: 'UPHELD',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  RESOLVED_VOID: 'VOIDED',
};

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function parseDisputeError(raw: string): string {
  if (raw.includes('challenge_not_ended')) return 'You can only dispute after the challenge ends.';
  if (raw.includes('dispute_window_closed')) return 'The dispute window has closed.';
  if (raw.includes('challenge_cancelled')) return 'This challenge was cancelled.';
  if (raw.includes('challenge_completed'))
    return 'This challenge is fully settled — disputes are no longer accepted.';
  if (raw.includes('invalid disputeReason')) return 'Pick one of the listed reasons.';
  return raw;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 60 },

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
  headerTitle: { fontSize: 13, fontWeight: '900', color: colorsB.inkSoft, letterSpacing: 0.5 },

  // Warn box
  warnBox: {
    flexDirection: 'row',
    gap: spacingB.md,
    padding: spacingB.lg,
    backgroundColor: colorsB.orangeSoft,
    borderWidth: 2,
    borderColor: colorsB.orangeDeep,
    borderRadius: radiusB.card,
  },
  warnEmoji: { fontSize: 24 },
  warnTitle: { fontSize: 13, fontWeight: '900', color: colorsB.orangeDeep },
  warnBody: { fontSize: 11, color: colorsB.orangeDeep, lineHeight: 16, fontWeight: '700' },

  // Reason tile
  reasonTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingB.md,
    paddingVertical: spacingB.md,
    paddingHorizontal: spacingB.lg,
    backgroundColor: colorsB.paper,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    ...shadowsB.card,
  },
  reasonTileActive: { backgroundColor: colorsB.ink },
  reasonEmoji: { fontSize: 22 },
  reasonLabel: { fontSize: 14, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.1 },
  reasonSub: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700', marginTop: 2 },
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

  // Description input
  fieldHint: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '600' },
  input: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingHorizontal: spacingB.lg,
    paddingVertical: spacingB.md,
    fontSize: 13,
    color: colorsB.ink,
    backgroundColor: colorsB.paper,
    minHeight: 110,
    textAlignVertical: 'top',
    fontWeight: '600',
  },
  charCount: {
    fontSize: 10,
    color: colorsB.inkFaint,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.5,
  },

  // Submit
  submitBtn: {
    backgroundColor: colorsB.orangeDeep,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
    marginTop: spacingB.sm,
    ...shadowsB.cardLg,
  },
  submitText: { color: colorsB.paper, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  footer: {
    fontSize: 10,
    color: colorsB.inkFaint,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: spacingB.sm,
  },

  // Dispute row
  disputeHead: { flexDirection: 'row', alignItems: 'center', gap: spacingB.md },
  disputeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colorsB.orange,
    borderWidth: 1.5,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeAvatarText: { color: colorsB.paper, fontWeight: '900', fontSize: 13 },
  disputeReason: { fontSize: 13, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.1 },
  disputeMeta: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700', marginTop: 2 },
  disputeBody: {
    fontSize: 12,
    color: colorsB.inkSoft,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 17,
  },
});
