/**
 * Create Challenge — 8-step wizard (Direction B "Playful Buddy").
 *
 * State stays at the route level. Top-nav + CTA live here so the visual
 * shell is consistent; step components only render their body.
 */

import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton, Lead, SecondaryLink, Title, TopNav } from '../components/create/primitives';
import {
  Step1Intent,
  Step2Category,
  Step3Template,
  Step4Rules,
  Step5Verification,
  Step6Reward,
  Step7Schedule,
  Step8Review,
} from '../components/create/steps';
import {
  Step6aContribution,
  Step6bDistribution,
  Step6cTerms,
} from '../components/create/winnerPoolSteps';
import { useWizardState, type WizardState } from '../components/create/state';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colorsB, spacingB, typeB } from '../lib/themeB';

// Step ids — symbolic so we can route around the WP sub-flow cleanly.
type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 6.1 | 6.2 | 6.3 | 7 | 8;

const MAIN_STEPS: StepId[] = [1, 2, 3, 4, 5, 6, 7, 8];
const WP_STEPS: StepId[] = [1, 2, 3, 4, 5, 6, 6.1, 6.2, 6.3, 7, 8];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { state, update } = useWizardState();

  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const isWP = state.reward === 'WINNER_POOL';
  const flow = isWP ? WP_STEPS : MAIN_STEPS;
  const step = flow[stepIdx] ?? 1;
  const total = flow.length;
  // 1-indexed progress bar position (for the visual top nav)
  const progressStep = stepIdx + 1;

  // Per-step validity gates the CTA
  const canAdvance = useMemo(() => stepValid(step, state), [step, state]);

  function onBack() {
    if (stepIdx === 0) {
      router.back();
    } else {
      setStepIdx((i) => i - 1);
    }
  }

  async function onAdvance() {
    if (stepIdx < total - 1) {
      setStepIdx((i) => i + 1);
      return;
    }
    // Final submit
    await submit();
  }

  async function submit() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const body = buildPayload(state);

      const res = await apiRequest<{ id: string; lifecycle: string; moderationStatus: string }>(
        '/api/challenges',
        { method: 'POST', token, body },
      );
      Alert.alert(
        res.lifecycle === 'PENDING_REVIEW' ? 'Sent for review' : 'Published',
        res.lifecycle === 'PENDING_REVIEW'
          ? 'Your challenge is waiting on admin approval (usually under 2 hours).'
          : 'Your challenge is live.',
        [
          {
            text: 'View challenge',
            onPress: () => router.replace(`/challenge/${res.id}` as never),
          },
        ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create challenge';
      // Extract server message if present in apiRequest's "STATUS: body"
      const friendly = parseErrorMessage(msg);
      Alert.alert("Couldn't create", friendly);
    } finally {
      setSubmitting(false);
    }
  }

  const screen = stepHeader(step);
  const isFinal = step === 8;

  return (
    <View style={{ flex: 1, backgroundColor: colorsB.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TopNav step={progressStep} total={total} onBack={onBack} isClose={stepIdx === 0} />
        <View style={{ flex: 1 }}>
          <Title before={screen.before} highlight={screen.highlight} after={screen.after} />
          <Lead>{screen.lead}</Lead>
          <View style={{ flex: 1, paddingHorizontal: spacingB.lg }}>
            {step === 1 && <Step1Intent state={state} update={update} />}
            {step === 2 && <Step2Category state={state} update={update} />}
            {step === 3 && <Step3Template state={state} update={update} />}
            {step === 4 && <Step4Rules state={state} update={update} />}
            {step === 5 && <Step5Verification state={state} update={update} />}
            {step === 6 && <Step6Reward state={state} update={update} />}
            {step === 6.1 && <Step6aContribution state={state} update={update} />}
            {step === 6.2 && <Step6bDistribution state={state} update={update} />}
            {step === 6.3 && <Step6cTerms state={state} update={update} />}
            {step === 7 && <Step7Schedule state={state} update={update} />}
            {step === 8 && <Step8Review state={state} />}
          </View>
        </View>
        <CtaButton
          label={ctaLabel(step, state, submitting)}
          variant={isFinal ? 'orange' : 'ink'}
          disabled={!canAdvance}
          loading={submitting}
          onPress={onAdvance}
        />
        {isFinal && <SecondaryLink label="save as draft" onPress={() => router.back()} />}
        <View style={{ height: spacingB.lg }} />
      </SafeAreaView>
    </View>
  );
}

// ─── Per-step copy ────────────────────────────────────────────────────────

function stepHeader(step: StepId): { before: string; highlight: string; after?: string; lead: string } {
  switch (step) {
    case 1:
      return { before: "Who's", highlight: 'in?', lead: "We'll set things up based on your squad." };
    case 2:
      return { before: 'What', highlight: 'kind?', lead: 'Pick the vibe of your challenge.' };
    case 3:
      return { before: 'How do you', highlight: 'win?', lead: "Pick a way to settle who's the champ." };
    case 4:
      return { before: 'Set the', highlight: 'goal', lead: 'Tune the numeric target.' };
    case 5:
      return { before: 'How do we', highlight: 'prove it?', lead: 'Stronger proof unlocks bigger rewards.' };
    case 6:
      return { before: "What's the", highlight: 'prize?', lead: 'Brag-rights or something a bit shinier.' };
    case 6.1:
      return { before: 'How much', highlight: 'each?', lead: 'Set the buy-in for everyone joining the pool.' };
    case 6.2:
      return { before: 'How to', highlight: 'split?', lead: "Who gets paid when the challenge ends." };
    case 6.3:
      return { before: 'Quick', highlight: 'legal bit', lead: 'Read before you publish — real money is involved.' };
    case 7:
      return { before: 'When &', highlight: 'who?', lead: 'Set the dates and squad size.' };
    case 8:
      return { before: 'Look', highlight: 'right?', lead: 'Last check before we send it.' };
    default:
      return { before: '', highlight: '', lead: '' };
  }
}

function ctaLabel(step: StepId, state: WizardState, submitting: boolean): string {
  if (submitting) return 'Sending…';
  if (step === 8) return state.reward === 'WINNER_POOL' ? 'Submit for review' : '🚀 Publish';
  if (step === 1) return "Let's go →";
  if (step === 6.1) return 'Set buy-in →';
  if (step === 6.2) return 'Use this →';
  if (step === 6.3) return 'Continue to schedule →';
  if (step === 7) return 'Review →';
  return 'Continue →';
}

function stepValid(step: StepId, state: WizardState): boolean {
  switch (step) {
    case 1: return state.creatorIntent !== null;
    case 2: return state.category !== null;
    case 3: return state.winCondition !== null;
    case 4: return state.title.trim().length > 0 && state.targetValue > 0;
    case 5: return state.verification !== null;
    case 6: return state.reward !== null;
    case 6.1: {
      // RM1-50, total pool under RM500
      const amt = state.entryContributionAmount;
      const maxPool = amt * state.participantMaximum;
      return amt >= 1 && amt <= 50 && maxPool <= 500;
    }
    case 6.2: return state.distributionMethod !== null;
    case 6.3: return state.termsAccepted && state.ageVerified;
    case 7: return state.startAt !== '' && state.endAt !== '';
    case 8: return true;
    default: return false;
  }
}

// ─── Payload builder for POST /api/challenges ─────────────────────────────

function buildPayload(state: WizardState): Record<string, unknown> {
  const startAt = new Date(state.startAt + 'T00:00:00Z').toISOString();
  const endAt = new Date(state.endAt + 'T23:59:59Z').toISOString();
  return {
    title: state.title,
    description: state.description || undefined,
    creatorIntent: state.creatorIntent,
    category: state.category,
    visibility: state.visibility,
    rewardType: state.reward,
    verificationMethod: state.verification,
    winCondition: {
      type: state.winCondition,
      targetValue: state.targetValue,
      requiredCount: state.requiredCount,
      allowedMisses: state.allowedMisses,
      metricType: state.metricType,
    },
    startAt,
    endAt,
    minParticipants: state.participantMinimum,
    participantLimit: state.participantMaximum,
    allowLateJoin: state.allowLateJoin,
    // Winner Pool sub-block — only sent if reward = WINNER_POOL (next session)
    ...(state.reward === 'WINNER_POOL'
      ? {
          winnerPool: {
            entryContributionAmount: state.entryContributionAmount,
            currency: 'MYR',
            distributionMethod: state.distributionMethod,
            participantMinimum: state.participantMinimum,
            participantMaximum: state.participantMaximum,
            termsAccepted: state.termsAccepted,
            noWinnerRule: 'REFUND_ALL',
          },
        }
      : {}),
  };
}

function parseErrorMessage(raw: string): string {
  // apiRequest format: "POST /path 400: {body}"
  const m = raw.match(/\d{3}:\s*(.+)$/);
  if (!m) return raw;
  try {
    const body = JSON.parse(m[1] ?? '{}');
    return body.message || body.blockReason || raw;
  } catch {
    return m[1] ?? raw;
  }
}

const styles = StyleSheet.create({
  // reserved for future overrides
});
