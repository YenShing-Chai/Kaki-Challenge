import type { ChallengeCategory, VerificationMethod } from '@prisma/client';

export type CategoryMeta = {
  key: ChallengeCategory;
  label: string;
  emoji: string;
  defaultVerification: VerificationMethod;
};

export const CATEGORIES: CategoryMeta[] = [
  { key: 'FITNESS', label: 'Fitness', emoji: '🏃', defaultVerification: 'AUTO_STEPS' },
  { key: 'MINDFULNESS', label: 'Mindfulness', emoji: '🧘', defaultVerification: 'HONOR_TAP' },
  { key: 'READING', label: 'Reading', emoji: '📚', defaultVerification: 'PHOTO_PROOF' },
  { key: 'LEARNING', label: 'Learning', emoji: '🎓', defaultVerification: 'PHOTO_PROOF' },
  { key: 'PRODUCTIVITY', label: 'Productivity', emoji: '⚡', defaultVerification: 'HONOR_TAP' },
  { key: 'CREATIVE', label: 'Creative', emoji: '🎨', defaultVerification: 'PHOTO_PROOF' },
  { key: 'WELLNESS', label: 'Wellness', emoji: '🌙', defaultVerification: 'HONOR_TAP' },
  { key: 'MONEY', label: 'Money', emoji: '💰', defaultVerification: 'HONOR_TAP' },
  { key: 'SOCIAL', label: 'Social', emoji: '👥', defaultVerification: 'HONOR_TAP' },
  { key: 'OUTDOORS', label: 'Outdoors', emoji: '🌳', defaultVerification: 'PHOTO_PROOF' },
];

const KEY_SET = new Set(CATEGORIES.map((c) => c.key));

export function isValidCategory(value: unknown): value is ChallengeCategory {
  return typeof value === 'string' && KEY_SET.has(value as ChallengeCategory);
}
