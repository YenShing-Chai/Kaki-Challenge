/**
 * Wizard state — single source of truth for the 8-step Create Challenge flow.
 *
 * Kept in plain useState at the parent route. No context, no redux —
 * the form's small enough that passing { state, set } down is fine.
 */

import { useState } from 'react';

import type { CategoryV2Key, CreatorIntentKey } from '../../lib/themeB';

export type VerificationLevelB =
  | 'SELF_DECLARATION'
  | 'PHOTO_UPLOAD'
  | 'PEER_VERIFICATION'
  | 'ORGANIZER_APPROVAL'
  | 'QR_LOCATION'
  | 'RECEIPT_POS_API'
  | 'PARTNER_VERIFIED';

export type RewardTypeB =
  | 'NONE'
  | 'BADGE'
  | 'POINTS'
  | 'VOUCHER'
  | 'DISCOUNT_FREE_ITEM'
  | 'WINNER_POOL';

export type WinConditionCodeB =
  | 'COMPLETE_ALL'
  | 'COMPLETE_MINIMUM'
  | 'REACH_TARGET'
  | 'STAY_BELOW_LIMIT'
  | 'RANK_TOP_N'
  | 'JUDGED_BEST'
  | 'TEAM_TARGET'
  | 'FASTEST_COMPLETION';

export type VisibilityB = 'PRIVATE' | 'GROUP' | 'PUBLIC';

export type DistributionMethodB =
  | 'ALL_COMPLETERS_EQUAL_SPLIT'
  | 'TOP_N_EQUAL_SPLIT'
  | 'RANKED_PERCENTAGE'
  | 'PROPORTIONAL'
  | 'TEAM_SPLIT';

export interface WizardState {
  // Identity
  title: string;
  description: string;

  // Step 1
  creatorIntent: CreatorIntentKey | null;
  // Step 2
  category: CategoryV2Key | null;
  // Step 3
  winCondition: WinConditionCodeB | null;
  // Step 4 — rules / numeric inputs
  targetValue: number;
  requiredCount: number;
  allowedMisses: number;
  limitValue?: number;
  metricType: string; // STEPS | SAVINGS | MINUTES | etc
  // Step 5
  verification: VerificationLevelB | null;
  // Step 6
  reward: RewardTypeB | null;
  // Step 6a/6b/6c (Winner Pool only)
  entryContributionAmount: number;
  distributionMethod: DistributionMethodB;
  participantMinimum: number;
  participantMaximum: number;
  termsAccepted: boolean;
  ageVerified: boolean;
  // Step 7
  visibility: VisibilityB;
  startAt: string; // ISO date string yyyy-mm-dd
  endAt: string;
  durationDays: number;
  allowLateJoin: boolean;
}

export const defaultState: WizardState = {
  title: '',
  description: '',
  creatorIntent: null,
  category: null,
  winCondition: null,
  targetValue: 8000,
  requiredCount: 7,
  allowedMisses: 1,
  metricType: 'STEPS',
  verification: null,
  reward: 'BADGE',
  entryContributionAmount: 10,
  distributionMethod: 'ALL_COMPLETERS_EQUAL_SPLIT',
  participantMinimum: 2,
  participantMaximum: 8,
  termsAccepted: false,
  ageVerified: false,
  visibility: 'PRIVATE',
  startAt: '',
  endAt: '',
  durationDays: 7,
  allowLateJoin: false,
};

export function useWizardState() {
  const [state, setState] = useState<WizardState>(() => {
    // Default start = tomorrow, end = +7 days
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = new Date(tomorrow);
    end.setDate(end.getDate() + 7);
    return {
      ...defaultState,
      startAt: toIsoDate(tomorrow),
      endAt: toIsoDate(end),
    };
  });

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function patch(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  return { state, update, patch };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
