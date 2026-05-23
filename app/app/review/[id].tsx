/**
 * Peer review queue for a challenge.
 *
 * Participants in PEER_VERIFICATION challenges land here from a banner on
 * the challenge detail. They see other participants' pending submissions
 * one card at a time and tap ✓ Approve or ✗ Reject. An optional note can
 * be attached.
 *
 * Server contract (PRD §7.2 + §15):
 *   GET  /api/challenges/:id/submissions/pending-review
 *   POST /api/challenges/:id/peer-reviews  { submissionId, decision, note? }
 *
 * Self-review and double-review are server-side rejected (verification.ts
 * PEER_RULES) — this screen also filters them client-side so they never
 * appear in the queue.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BCard, BEmpty, BPill, ScreenHeader } from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type Submission = {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterInitial: string;
  submissionType: string;
  evidenceUrl: string | null;
  metricValue: number | null;
  submittedAt: string;
  confidenceScore: number;
  forDate: string | null;
  note: string | null;
  approvals: number;
  rejections: number;
  required: number;
};

type Rules = {
  requiredApprovals: number;
  requiredRejections: number;
  windowHours: number;
};

export default function ReviewQueueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const token = await getToken();
      const { submissions: subs, rules: r } = await apiRequest<{
        submissions: Submission[];
        rules: Rules;
      }>(`/api/challenges/${id}/submissions/pending-review`, { token });
      setSubmissions(subs);
      setRules(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = submissions[idx];
  const remaining = submissions.length - idx;

  const submitReview = async (decision: 'APPROVE' | 'REJECT') => {
    if (!current || !id || submitting) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await apiRequest<{
        approvals: number;
        rejections: number;
        outcome: string;
        submissionStatus: string;
      }>(`/api/challenges/${id}/peer-reviews`, {
        method: 'POST',
        token,
        body: {
          submissionId: current.id,
          decision,
          note: note.trim() || undefined,
        },
      });
      // Optimistic advance: drop this submission from the queue.
      setNote('');
      setSubmissions((prev) => prev.filter((s) => s.id !== current.id));
      // Optional toast — keep it cheap with Alert for now.
      if (res.submissionStatus === 'APPROVED' || res.submissionStatus === 'REJECTED') {
        Alert.alert(
          'Thanks — that one is settled',
          res.submissionStatus === 'APPROVED'
            ? `Approved (${res.approvals} of ${rules?.requiredApprovals ?? 2})`
            : `Rejected (${res.rejections} of ${rules?.requiredRejections ?? 2})`,
        );
      }
      // Index stays the same — filter shifted the array.
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : 'Unknown error');
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

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header onBack={() => router.back()} title="Peer review" />
        <View style={{ paddingHorizontal: spacingB.lg }}>
          <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header onBack={() => router.back()} title="Peer review" />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          eyebrow="Peer review"
          highlight={remaining === 0 ? "All done" : `${remaining} waiting`}
          after={remaining > 0 ? '✦' : '🎉'}
        />

        {remaining === 0 || !current ? (
          <View style={{ paddingHorizontal: spacingB.lg }}>
            <BEmpty
              emoji="🎉"
              title="Inbox zero"
              body="No more submissions to review right now. Check back later — peers post throughout the day."
              cta={{ label: 'Back to challenge →', onPress: () => router.back() }}
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
            <RuleNote rules={rules} />

            <ReviewCard sub={current} />

            <NoteField value={note} onChangeText={setNote} disabled={submitting} />

            <View style={styles.actionRow}>
              <ActionBtn
                label="✗  Reject"
                tone="reject"
                disabled={submitting}
                onPress={() =>
                  Alert.alert(
                    'Reject this submission?',
                    'Two rejections fail this proof. Your note (if any) helps the submitter.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reject',
                        style: 'destructive',
                        onPress: () => void submitReview('REJECT'),
                      },
                    ],
                  )
                }
              />
              <ActionBtn
                label="✓  Approve"
                tone="approve"
                disabled={submitting}
                onPress={() => void submitReview('APPROVE')}
              />
            </View>

            {submissions.length > 1 ? (
              <Text style={styles.queueHint}>
                {idx + 1} of {submissions.length} in the queue
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backBtnText}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function RuleNote({ rules }: { rules: Rules | null }) {
  if (!rules) return null;
  return (
    <View style={styles.ruleBox}>
      <Text style={styles.ruleEyebrow}>How it works</Text>
      <Text style={styles.ruleBody}>
        {rules.requiredApprovals} approvals = pass. {rules.requiredRejections} rejections = fail.
        After {rules.windowHours}h without enough votes, an admin steps in.
      </Text>
    </View>
  );
}

function ReviewCard({ sub }: { sub: Submission }) {
  const submittedAt = useMemo(() => {
    const t = new Date(sub.submittedAt);
    const now = new Date();
    const diffMs = now.getTime() - t.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, [sub.submittedAt]);

  return (
    <BCard large style={{ gap: spacingB.lg }}>
      {/* Submitter row */}
      <View style={styles.submitterRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{sub.submitterInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submitterName} numberOfLines={1}>
            {sub.submitterName}
          </Text>
          <Text style={styles.submitterMeta}>
            {sub.submissionType} · {submittedAt}
            {sub.forDate ? ` · for ${sub.forDate}` : ''}
          </Text>
        </View>
        <BPill
          label={`${sub.confidenceScore}% AI`}
          tone={sub.confidenceScore >= 50 ? 'green' : 'yellow'}
          size="sm"
        />
      </View>

      {/* Evidence photo */}
      {sub.evidenceUrl ? (
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: sub.evidenceUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderEmoji}>📭</Text>
          <Text style={styles.photoPlaceholderText}>No photo attached</Text>
        </View>
      )}

      {/* Note */}
      {sub.note ? (
        <View style={styles.claimBox}>
          <Text style={styles.claimEyebrow}>Their note</Text>
          <Text style={styles.claimText}>"{sub.note}"</Text>
        </View>
      ) : null}

      {/* Metric value */}
      {sub.metricValue != null ? (
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Claimed value</Text>
          <Text style={styles.metricValue}>{sub.metricValue.toLocaleString()}</Text>
        </View>
      ) : null}

      {/* Vote progress */}
      <View style={styles.progressRow}>
        <ProgressChip
          icon="✓"
          label="Approvals"
          count={sub.approvals}
          need={sub.required}
          tone="green"
        />
        <ProgressChip
          icon="✗"
          label="Rejections"
          count={sub.rejections}
          need={sub.required}
          tone="orange"
        />
      </View>
    </BCard>
  );
}

function ProgressChip({
  icon,
  label,
  count,
  need,
  tone,
}: {
  icon: string;
  label: string;
  count: number;
  need: number;
  tone: 'green' | 'orange';
}) {
  const palette = tone === 'green'
    ? { bg: colorsB.greenSoft, fg: colorsB.green }
    : { bg: colorsB.orangeSoft, fg: colorsB.orangeDeep };
  return (
    <View style={[styles.progressChip, { backgroundColor: palette.bg }]}>
      <Text style={[styles.progressIcon, { color: palette.fg }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.progressLabel, { color: palette.fg }]}>{label}</Text>
        <Text style={[styles.progressCount, { color: palette.fg }]}>
          {count} / {need}
        </Text>
      </View>
    </View>
  );
}

function NoteField({
  value,
  onChangeText,
  disabled,
}: {
  value: string;
  onChangeText: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.noteWrap}>
      <Text style={typeB.eyebrow}>Optional note (visible to admin if disputed)</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. photo looks like a stock image"
        placeholderTextColor={colorsB.inkFaint}
        editable={!disabled}
        multiline
        style={styles.noteInput}
        maxLength={200}
      />
    </View>
  );
}

function ActionBtn({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'approve' | 'reject';
  disabled: boolean;
  onPress: () => void;
}) {
  const isApprove = tone === 'approve';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        isApprove ? styles.actionApprove : styles.actionReject,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 },
      ]}
    >
      <Text
        style={[
          styles.actionText,
          { color: isApprove ? colorsB.paper : colorsB.orangeDeep },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },

  // Header
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

  // Rule note
  ruleBox: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    padding: spacingB.lg,
    gap: 4,
  },
  ruleEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.orangeDeep,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  ruleBody: { fontSize: 12, color: colorsB.ink, lineHeight: 18, fontWeight: '700' },

  // Submitter row
  submitterRow: { flexDirection: 'row', alignItems: 'center', gap: spacingB.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colorsB.paper, fontWeight: '900', fontSize: 18 },
  submitterName: { fontSize: 16, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.2 },
  submitterMeta: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '700', marginTop: 2 },

  // Photo
  photoWrap: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.card,
    overflow: 'hidden',
    backgroundColor: colorsB.bgWarm,
  },
  photo: { width: '100%', height: 220 },
  photoPlaceholder: {
    borderWidth: 2,
    borderColor: colorsB.line,
    borderRadius: radiusB.card,
    backgroundColor: colorsB.bgWarm,
    paddingVertical: spacingB.xxl,
    alignItems: 'center',
    gap: 6,
  },
  photoPlaceholderEmoji: { fontSize: 36 },
  photoPlaceholderText: {
    color: colorsB.inkFaint,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Claim text
  claimBox: {
    backgroundColor: colorsB.bgWarm,
    borderWidth: 1.5,
    borderColor: colorsB.line,
    borderRadius: radiusB.control,
    padding: spacingB.lg,
    gap: 4,
  },
  claimEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colorsB.inkFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  claimText: { fontSize: 14, color: colorsB.ink, lineHeight: 20, fontWeight: '600', fontStyle: 'italic' },

  // Metric
  metricBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colorsB.paper,
    borderWidth: 1.5,
    borderColor: colorsB.line,
    borderRadius: radiusB.control,
    paddingVertical: spacingB.md,
    paddingHorizontal: spacingB.lg,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colorsB.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricValue: { fontSize: 22, fontWeight: '900', color: colorsB.ink, letterSpacing: -0.4 },

  // Vote progress
  progressRow: { flexDirection: 'row', gap: spacingB.md },
  progressChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacingB.lg,
    paddingVertical: 10,
    borderRadius: radiusB.control,
    borderWidth: 1.5,
    borderColor: colorsB.line,
  },
  progressIcon: { fontSize: 18, fontWeight: '900' },
  progressLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressCount: { fontSize: 16, fontWeight: '900', marginTop: 2 },

  // Note field
  noteWrap: { gap: 6 },
  noteInput: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingHorizontal: spacingB.lg,
    paddingVertical: spacingB.md,
    fontSize: 13,
    color: colorsB.ink,
    backgroundColor: colorsB.paper,
    minHeight: 70,
    textAlignVertical: 'top',
    fontWeight: '600',
  },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: spacingB.md },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    borderWidth: 2,
    borderColor: colorsB.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowsB.cardLg,
  },
  actionApprove: { backgroundColor: colorsB.green },
  actionReject: { backgroundColor: colorsB.paper },
  actionText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  queueHint: {
    fontSize: 11,
    fontWeight: '800',
    color: colorsB.inkFaint,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacingB.sm,
  },
});
