import { useAuth } from '../../lib/auth';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { apiRequest } from '../../lib/api';
import {
  CategoryKey,
  categoryEmoji,
  categoryLabel,
  colors,
  radius,
} from '../../lib/theme';

type VerificationMethod = 'AUTO_STEPS' | 'PHOTO_PROOF' | 'HONOR_TAP';
type GameFormat = 'DAILY_STREAK' | 'WEEKLY_QUOTA' | 'COMPLETION_COUNT';

type Category = {
  key: CategoryKey;
  label: string;
  emoji: string;
  defaultVerification: VerificationMethod;
};

const TOTAL_STEPS = 4;

export default function CreateChallengeScreen() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryKey>('FITNESS');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('AUTO_STEPS');
  const [gameFormat, setGameFormat] = useState<GameFormat>('DAILY_STREAK');

  const [dailyStepGoal, setDailyStepGoal] = useState('10000');
  const [activeStepGoal, setActiveStepGoal] = useState('10000');
  const [powerStepGoal, setPowerStepGoal] = useState('14000');
  const [weeklyActiveDays, setWeeklyActiveDays] = useState('4');
  const [weeklyPowerDays, setWeeklyPowerDays] = useState('2');
  const [weeklyFreeDays, setWeeklyFreeDays] = useState('1');
  const [targetDaysComplete, setTargetDaysComplete] = useState('25');

  const [commitmentFee, setCommitmentFee] = useState('20');
  const [durationDays, setDurationDays] = useState('30');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { categories: cats } = await apiRequest<{ categories: Category[] }>('/categories');
        setCategories(cats);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  // Auto-suggest verification when category changes
  useEffect(() => {
    const cat = categories.find((c) => c.key === category);
    if (cat) setVerificationMethod(cat.defaultVerification);
  }, [category, categories]);

  // Force COMPLETION_COUNT when non-AUTO_STEPS
  useEffect(() => {
    if (verificationMethod !== 'AUTO_STEPS' && gameFormat !== 'COMPLETION_COUNT') {
      setGameFormat('COMPLETION_COUNT');
    }
  }, [verificationMethod, gameFormat]);

  // Validation per step
  const canAdvance = useMemo(() => {
    if (step === 0) return title.trim().length >= 2;
    if (step === 1) return true; // category always has default
    if (step === 2) {
      if (gameFormat === 'DAILY_STREAK') return Number(dailyStepGoal) > 0;
      if (gameFormat === 'WEEKLY_QUOTA')
        return (
          Number(activeStepGoal) > 0 &&
          Number(powerStepGoal) > 0 &&
          Number(weeklyActiveDays) >= 0 &&
          Number(weeklyPowerDays) >= 0
        );
      if (gameFormat === 'COMPLETION_COUNT') {
        return Number(targetDaysComplete) > 0 && Number(targetDaysComplete) <= Number(durationDays);
      }
      return false;
    }
    if (step === 3) {
      return Number(commitmentFee) > 0 && Number(durationDays) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(startDate);
    }
    return false;
  }, [
    step, title, gameFormat, dailyStepGoal, activeStepGoal, powerStepGoal,
    weeklyActiveDays, weeklyPowerDays, targetDaysComplete, commitmentFee, durationDays, startDate,
  ]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        title,
        description: description || null,
        commitmentFee: Number(commitmentFee),
        durationDays: Number(durationDays),
        startDate,
        category,
        verificationMethod,
        gameFormat,
      };
      if (gameFormat === 'DAILY_STREAK') {
        body.dailyStepGoal = Number(dailyStepGoal);
      } else if (gameFormat === 'WEEKLY_QUOTA') {
        body.dailyStepGoal = Number(activeStepGoal);
        body.activeStepGoal = Number(activeStepGoal);
        body.powerStepGoal = Number(powerStepGoal);
        body.weeklyActiveDays = Number(weeklyActiveDays);
        body.weeklyPowerDays = Number(weeklyPowerDays);
        body.weeklyFreeDays = Number(weeklyFreeDays);
      } else if (gameFormat === 'COMPLETION_COUNT') {
        body.dailyStepGoal = 0;
        body.targetDaysComplete = Number(targetDaysComplete);
      }
      const { challengeId } = await apiRequest<{ challengeId: string }>('/challenges/create', {
        method: 'POST',
        token,
        body,
      });
      Alert.alert('Created!', `Challenge id: ${challengeId.slice(0, 8)}…`, [
        { text: 'Done', onPress: () => router.replace('/(tabs)/discover') },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
            hitSlop={12}
          >
            <Text style={styles.headerBack}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New challenge</Text>
          <Text style={styles.headerStep}>{step + 1} / {TOTAL_STEPS}</Text>
        </View>

        {/* Progress pips */}
        <View style={styles.pipRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                i < step && styles.pipDone,
                i === step && styles.pipActive,
              ]}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <StepTitle
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
            />
          )}
          {step === 1 && (
            <StepCategory
              categories={categories}
              category={category}
              setCategory={setCategory}
              verificationMethod={verificationMethod}
              setVerificationMethod={setVerificationMethod}
            />
          )}
          {step === 2 && (
            <StepFormat
              gameFormat={gameFormat}
              setGameFormat={setGameFormat}
              verificationMethod={verificationMethod}
              dailyStepGoal={dailyStepGoal}
              setDailyStepGoal={setDailyStepGoal}
              activeStepGoal={activeStepGoal}
              setActiveStepGoal={setActiveStepGoal}
              powerStepGoal={powerStepGoal}
              setPowerStepGoal={setPowerStepGoal}
              weeklyActiveDays={weeklyActiveDays}
              setWeeklyActiveDays={setWeeklyActiveDays}
              weeklyPowerDays={weeklyPowerDays}
              setWeeklyPowerDays={setWeeklyPowerDays}
              weeklyFreeDays={weeklyFreeDays}
              setWeeklyFreeDays={setWeeklyFreeDays}
              targetDaysComplete={targetDaysComplete}
              setTargetDaysComplete={setTargetDaysComplete}
              durationDays={durationDays}
            />
          )}
          {step === 3 && (
            <StepFee
              commitmentFee={commitmentFee}
              setCommitmentFee={setCommitmentFee}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
              startDate={startDate}
              setStartDate={setStartDate}
              // Review summary
              title={title}
              category={category}
              verificationMethod={verificationMethod}
              gameFormat={gameFormat}
              targetDaysComplete={targetDaysComplete}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {/* Sticky bottom CTA */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={isLastStep ? submit : () => setStep((s) => s + 1)}
            disabled={!canAdvance || submitting}
            style={({ pressed }) => [
              styles.cta,
              (!canAdvance || submitting) && styles.ctaDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {isLastStep ? 'Create challenge' : 'Continue →'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step 0: Title + description ────────────────────────────────────────

function StepTitle({
  title, setTitle, description, setDescription,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepQ}>Name your challenge.</Text>
      <Text style={styles.stepHint}>What players see on the card. Keep it short and inviting.</Text>
      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="e.g. Reader's Club"
        placeholderTextColor="#bbb"
        autoFocus
        returnKeyType="next"
      />
      <Text style={styles.fieldLabel}>Description (optional)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { height: 96, textAlignVertical: 'top' }]}
        placeholder="One line about the rules"
        placeholderTextColor="#bbb"
        multiline
      />
    </View>
  );
}

// ─── Step 1: Category + verification ────────────────────────────────────

function StepCategory({
  categories, category, setCategory, verificationMethod, setVerificationMethod,
}: {
  categories: Category[];
  category: CategoryKey; setCategory: (v: CategoryKey) => void;
  verificationMethod: VerificationMethod; setVerificationMethod: (v: VerificationMethod) => void;
}) {
  const verifOptions: Array<{ key: VerificationMethod; emoji: string; label: string; sub: string }> = [
    { key: 'AUTO_STEPS', emoji: '🏃', label: 'Auto-steps', sub: 'HealthKit / Health Connect' },
    { key: 'PHOTO_PROOF', emoji: '📸', label: 'Photo proof', sub: 'Daily photo upload' },
    { key: 'HONOR_TAP', emoji: '✋', label: 'Honor tap', sub: 'Just tap "done"' },
  ];

  return (
    <View>
      <Text style={styles.stepQ}>Pick a category.</Text>
      <Text style={styles.stepHint}>We'll suggest the right verification method.</Text>

      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.chipGrid}>
        {(categories.length > 0
          ? categories
          : (Object.keys(categoryEmoji) as CategoryKey[]).map((k) => ({
              key: k,
              label: categoryLabel[k],
              emoji: categoryEmoji[k],
              defaultVerification: 'AUTO_STEPS' as VerificationMethod,
            }))
        ).map((c) => {
          const active = c.key === category;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.emoji} {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Verification method</Text>
      {verifOptions.map((v) => {
        const sel = v.key === verificationMethod;
        return (
          <Pressable
            key={v.key}
            onPress={() => setVerificationMethod(v.key)}
            style={[styles.optionRow, sel && styles.optionRowSel]}
          >
            <Text style={styles.optionEm}>{v.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionT}>{v.label}</Text>
              <Text style={styles.optionB}>{v.sub}</Text>
            </View>
            {sel ? <Text style={styles.optionCheck}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 2: Game format + goals ────────────────────────────────────────

function StepFormat(props: {
  gameFormat: GameFormat;
  setGameFormat: (v: GameFormat) => void;
  verificationMethod: VerificationMethod;
  dailyStepGoal: string;
  setDailyStepGoal: (v: string) => void;
  activeStepGoal: string;
  setActiveStepGoal: (v: string) => void;
  powerStepGoal: string;
  setPowerStepGoal: (v: string) => void;
  weeklyActiveDays: string;
  setWeeklyActiveDays: (v: string) => void;
  weeklyPowerDays: string;
  setWeeklyPowerDays: (v: string) => void;
  weeklyFreeDays: string;
  setWeeklyFreeDays: (v: string) => void;
  targetDaysComplete: string;
  setTargetDaysComplete: (v: string) => void;
  durationDays: string;
}) {
  const formats: Array<{ key: GameFormat; emoji: string; label: string; sub: string; allowed: boolean }> = [
    {
      key: 'DAILY_STREAK',
      emoji: '🔥',
      label: 'Daily streak',
      sub: 'Miss any day → out',
      allowed: props.verificationMethod === 'AUTO_STEPS',
    },
    {
      key: 'WEEKLY_QUOTA',
      emoji: '📅',
      label: 'Weekly quota',
      sub: 'Active + Power days per week',
      allowed: props.verificationMethod === 'AUTO_STEPS',
    },
    {
      key: 'COMPLETION_COUNT',
      emoji: '🎯',
      label: 'Hit N of total days',
      sub: 'Backfill anytime, tallied at end',
      allowed: true,
    },
  ];

  return (
    <View>
      <Text style={styles.stepQ}>Pick the game.</Text>
      <Text style={styles.stepHint}>
        {props.verificationMethod !== 'AUTO_STEPS'
          ? 'Non-step verification → completion count.'
          : 'How players win or lose.'}
      </Text>

      {formats.map((f) => {
        const sel = f.key === props.gameFormat;
        return (
          <Pressable
            key={f.key}
            onPress={() => f.allowed && props.setGameFormat(f.key)}
            style={[
              styles.optionRow,
              sel && styles.optionRowSel,
              !f.allowed && styles.optionRowDisabled,
            ]}
            disabled={!f.allowed}
          >
            <Text style={styles.optionEm}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionT}>
                {f.label}
                {!f.allowed ? '  (auto-steps only)' : ''}
              </Text>
              <Text style={styles.optionB}>{f.sub}</Text>
            </View>
            {sel ? <Text style={styles.optionCheck}>✓</Text> : null}
          </Pressable>
        );
      })}

      {props.gameFormat === 'DAILY_STREAK' && (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Daily step goal</Text>
          <TextInput
            value={props.dailyStepGoal}
            onChangeText={props.setDailyStepGoal}
            style={styles.input}
            keyboardType="number-pad"
          />
        </>
      )}

      {props.gameFormat === 'WEEKLY_QUOTA' && (
        <>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Active steps</Text>
              <TextInput
                value={props.activeStepGoal}
                onChangeText={props.setActiveStepGoal}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Power steps</Text>
              <TextInput
                value={props.powerStepGoal}
                onChangeText={props.setPowerStepGoal}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Active days/wk</Text>
              <TextInput
                value={props.weeklyActiveDays}
                onChangeText={props.setWeeklyActiveDays}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Power days/wk</Text>
              <TextInput
                value={props.weeklyPowerDays}
                onChangeText={props.setWeeklyPowerDays}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Free days/wk</Text>
              <TextInput
                value={props.weeklyFreeDays}
                onChangeText={props.setWeeklyFreeDays}
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </>
      )}

      {props.gameFormat === 'COMPLETION_COUNT' && (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
            Target days (out of {props.durationDays || '?'})
          </Text>
          <TextInput
            value={props.targetDaysComplete}
            onChangeText={props.setTargetDaysComplete}
            style={styles.input}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            Players who hit this many days (of the {props.durationDays || '?'} total) win.
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Step 3: Fee, dates, review ────────────────────────────────────────

function StepFee(props: {
  commitmentFee: string;
  setCommitmentFee: (v: string) => void;
  durationDays: string;
  setDurationDays: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  title: string;
  category: CategoryKey;
  verificationMethod: VerificationMethod;
  gameFormat: GameFormat;
  targetDaysComplete: string;
}) {
  const verifLabel = {
    AUTO_STEPS: 'Auto-steps',
    PHOTO_PROOF: 'Photo proof',
    HONOR_TAP: 'Honor tap',
  }[props.verificationMethod];
  const formatLabel = {
    DAILY_STREAK: 'Daily streak',
    WEEKLY_QUOTA: 'Weekly quota',
    COMPLETION_COUNT: `Hit ${props.targetDaysComplete} of ${props.durationDays} days`,
  }[props.gameFormat];

  return (
    <View>
      <Text style={styles.stepQ}>Stake and dates.</Text>
      <Text style={styles.stepHint}>Everyone pays the same fee. Bigger fee = bigger pot.</Text>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Commitment fee ($)</Text>
          <TextInput
            value={props.commitmentFee}
            onChangeText={props.setCommitmentFee}
            style={styles.input}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Duration (days)</Text>
          <TextInput
            value={props.durationDays}
            onChangeText={props.setDurationDays}
            style={styles.input}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Start date (YYYY-MM-DD)</Text>
      <TextInput
        value={props.startDate}
        onChangeText={props.setStartDate}
        style={styles.input}
        placeholder="2026-05-22"
        placeholderTextColor="#bbb"
        autoCapitalize="none"
      />

      <View style={styles.reviewCard}>
        <Text style={styles.reviewLabel}>Review</Text>
        <ReviewLine k="Title" v={props.title} />
        <ReviewLine k="Category" v={`${categoryEmoji[props.category]} ${categoryLabel[props.category]}`} />
        <ReviewLine k="Verification" v={verifLabel} />
        <ReviewLine k="Format" v={formatLabel} />
        <ReviewLine k="Fee" v={`$${props.commitmentFee}`} />
        <ReviewLine k="Duration" v={`${props.durationDays} days`} />
        <ReviewLine k="Starts" v={props.startDate} />
      </View>
    </View>
  );
}

function ReviewLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.reviewLine}>
      <Text style={styles.reviewK}>{k}</Text>
      <Text style={styles.reviewV} numberOfLines={1}>
        {v || '—'}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBack: { fontSize: 22, color: colors.ink },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, flex: 1 },
  headerStep: { fontSize: 12, fontWeight: '700', color: colors.textMicro },

  pipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  pip: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  pipActive: { backgroundColor: colors.primary },
  pipDone: { backgroundColor: colors.primaryDark },

  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 0 },

  stepQ: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  stepHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 22,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 17,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
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

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    marginBottom: 10,
  },
  optionRowSel: { borderColor: colors.primary, backgroundColor: colors.mint },
  optionRowDisabled: { opacity: 0.4 },
  optionEm: { fontSize: 22 },
  optionT: { fontSize: 14, fontWeight: '700', color: colors.ink },
  optionB: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  optionCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 22,
  },

  row2: { flexDirection: 'row', gap: 10 },

  reviewCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.mint,
  },
  reviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  reviewLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
    gap: 14,
  },
  reviewK: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  reviewV: { fontSize: 13, color: colors.ink, fontWeight: '700', flex: 1, textAlign: 'right' },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#BFCEC4' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  error: { color: colors.danger, marginTop: 12 },
});
