/**
 * Submit proof screen.
 *
 * Used by challenges with PEER_VERIFICATION (or photo-based ladder rungs).
 * Posts to POST /api/challenges/:id/submissions. The server scores
 * confidence; if it lands below 75 it goes into the peer-review queue,
 * otherwise it's auto-approved.
 *
 * Real file upload isn't wired yet — for v1 the user pastes an image
 * URL (or skips entirely and just writes a note). Once we have S3 the
 * URL paste swaps for a camera/picker.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { BCard, ScreenHeader } from '../../components/themeB/screen';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorsB, radiusB, shadowsB, spacingB, typeB } from '../../lib/themeB';

type ChallengePreview = {
  id: string;
  title: string;
  verificationMethod: string;
  rewardType?: string | null;
};

export default function SubmitProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<ChallengePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState('');
  const [note, setNote] = useState('');
  const [metric, setMetric] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      const { challenge: c } = await apiRequest<{ challenge: ChallengePreview }>(
        `/challenges/${id}`,
        { token },
      );
      setChallenge(c);
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
    if (!photoUrl.trim() && !note.trim()) {
      Alert.alert('Add something', 'Please attach a photo URL or describe what you did.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const metricNum = metric.trim() ? Number(metric) : undefined;
      const res = await apiRequest<{
        id: string;
        verificationStatus: string;
        confidence: number;
      }>(`/api/challenges/${id}/submissions`, {
        method: 'POST',
        token,
        body: {
          submissionType: photoUrl.trim() ? 'PHOTO' : 'MANUAL',
          evidenceUrl: photoUrl.trim() || null,
          metricValue: metricNum,
          forDate: new Date().toISOString().slice(0, 10),
          metadata: note.trim() ? { note: note.trim() } : undefined,
        },
      });
      Alert.alert(
        res.verificationStatus === 'AUTO_APPROVED'
          ? '✓ Auto-approved'
          : '👥 Waiting on peer review',
        res.verificationStatus === 'AUTO_APPROVED'
          ? `Your proof passed automatically (${res.confidence}% confidence).`
          : `Two participants need to approve it (${res.confidence}% confidence so far). You'll get a push when it's settled.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      Alert.alert('Could not submit', msg);
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
            <Text style={styles.backBtnText}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Submit proof</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            eyebrow={challenge?.title ?? 'Submit'}
            before="Show"
            highlight="the work"
            after="✦"
          />

          <View style={{ paddingHorizontal: spacingB.lg, gap: spacingB.lg }}>
            {error ? (
              <Text style={[typeB.body, { color: colorsB.orangeDeep }]}>{error}</Text>
            ) : null}

            <BCard style={{ gap: 6 }}>
              <Text style={styles.help}>
                Stronger proof unlocks bigger rewards. EXIF + a clear photo from today usually
                clears the bar.
              </Text>
            </BCard>

            {/* Photo URL */}
            <View style={styles.fieldWrap}>
              <Text style={typeB.eyebrow}>Photo URL</Text>
              <Text style={styles.fieldHint}>
                Paste a public image link. Camera upload coming in v1.1.
              </Text>
              <TextInput
                value={photoUrl}
                onChangeText={setPhotoUrl}
                placeholder="https://…"
                placeholderTextColor={colorsB.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
              {photoUrl.trim() ? (
                <View style={styles.preview}>
                  <Image
                    source={{ uri: photoUrl.trim() }}
                    style={styles.previewImg}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
            </View>

            {/* Note */}
            <View style={styles.fieldWrap}>
              <Text style={typeB.eyebrow}>Note</Text>
              <Text style={styles.fieldHint}>
                Describe what you did today. Reviewers see this verbatim.
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. 30-min jog around the park, hit 8k steps"
                placeholderTextColor={colorsB.inkFaint}
                multiline
                maxLength={300}
                style={[styles.input, styles.inputMulti]}
              />
            </View>

            {/* Metric value */}
            <View style={styles.fieldWrap}>
              <Text style={typeB.eyebrow}>Number value (optional)</Text>
              <Text style={styles.fieldHint}>
                Steps, minutes, books — whichever metric the challenge tracks.
              </Text>
              <TextInput
                value={metric}
                onChangeText={(t) => setMetric(t.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                placeholderTextColor={colorsB.inkFaint}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={submit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                submitting && { opacity: 0.6 },
                pressed && !submitting && {
                  transform: [{ translateX: 2 }, { translateY: 2 }],
                  shadowOpacity: 0,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colorsB.paper} />
              ) : (
                <Text style={styles.submitText}>Submit proof →</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsB.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 80 },

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

  help: { fontSize: 12, color: colorsB.inkSoft, lineHeight: 18, fontWeight: '600' },

  fieldWrap: { gap: 4 },
  fieldHint: { fontSize: 11, color: colorsB.inkSoft, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    paddingHorizontal: spacingB.lg,
    paddingVertical: spacingB.md,
    fontSize: 14,
    color: colorsB.ink,
    backgroundColor: colorsB.paper,
    fontWeight: '600',
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },

  preview: {
    marginTop: spacingB.md,
    borderWidth: 2,
    borderColor: colorsB.ink,
    borderRadius: radiusB.control,
    overflow: 'hidden',
    backgroundColor: colorsB.bgWarm,
  },
  previewImg: { width: '100%', height: 180 },

  submitBtn: {
    backgroundColor: colorsB.orange,
    borderWidth: 2,
    borderColor: colorsB.ink,
    paddingVertical: 16,
    borderRadius: radiusB.card,
    alignItems: 'center',
    marginTop: spacingB.sm,
    ...shadowsB.cardLg,
  },
  submitText: { color: colorsB.paper, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
});
