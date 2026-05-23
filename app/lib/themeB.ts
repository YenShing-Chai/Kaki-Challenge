/**
 * Direction B — "Playful Buddy" design tokens.
 *
 * Locked in from the design-preview HTML mockups the user picked.
 * Separate from theme.ts so legacy screens stay on the green system
 * until Phase 3 migrates them too.
 */

import type { TextStyle, ViewStyle } from 'react-native';

export const colorsB = {
  // Surfaces
  bg: '#fef4e2',
  bgWarm: '#fbe8c8',
  paper: '#fffaf0',

  // Ink
  ink: '#1c1410',
  inkSoft: '#5a4a3e',
  inkFaint: '#a89887',

  // Lines
  line: '#f0d9b3',

  // Accents
  orange: '#ff5a1f',
  orangeSoft: '#ffe0d0',
  orangeDeep: '#c43d10',

  green: '#5d8a5a',
  greenSoft: '#d1e5cf',

  pink: '#e88a8a',
  pinkSoft: '#fbdbdb',

  blue: '#2d5d8b',
  blueSoft: '#cee0f0',

  yellow: '#f4c443',
  yellowDeep: '#c89a2a',
} as const;

export const radiusB = {
  // Cards/buttons in this system are chunky
  card: 16,
  cardLg: 20,
  bubble: 18,
  pill: 999,
  control: 14,
  emoji: 12,
} as const;

export const spacingB = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 22,
} as const;

export const typeB = {
  // Direction B uses a chunky rounded sans. iOS gets SF Pro Rounded for free
  // via the system; Android falls back to Inter / default. Bold weights
  // throughout to match the design.
  display: {
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: -0.8,
    color: colorsB.ink,
  },
  title: {
    fontSize: 26,
    fontWeight: '900' as const,
    letterSpacing: -0.6,
    lineHeight: 30,
    color: colorsB.ink,
  },
  h2: {
    fontSize: 18,
    fontWeight: '900' as const,
    letterSpacing: -0.3,
    color: colorsB.ink,
  },
  body: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colorsB.ink,
  },
  lead: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colorsB.inkSoft,
    lineHeight: 19,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: colorsB.inkSoft,
  },
  label: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colorsB.ink,
  },
  micro: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colorsB.inkSoft,
  },
} satisfies Record<string, TextStyle>;

/**
 * Direction B's signature: hard offset shadow. iOS only — Android uses
 * elevation which isn't quite the same look but is acceptable.
 */
export const shadowsB = {
  // Standard chunky tile
  card: {
    shadowColor: colorsB.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  // Bigger sticker offset
  cardLg: {
    shadowColor: colorsB.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  // Orange offset (CTA + hero)
  heroOrange: {
    shadowColor: colorsB.orange,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
} satisfies Record<string, ViewStyle>;

// ─── Domain colour helpers ─────────────────────────────────────────────────

export type CategoryV2Key =
  | 'HABIT'
  | 'FITNESS'
  | 'MONEY'
  | 'LEARNING'
  | 'WORK'
  | 'SOCIAL'
  | 'TRAVEL'
  | 'FOOD'
  | 'RETAIL'
  | 'CREATIVE'
  | 'COMMUNITY'
  | 'EVENT'
  | 'CUSTOM';

export const categoryV2Emoji: Record<CategoryV2Key, string> = {
  HABIT: '🌱',
  FITNESS: '💪',
  MONEY: '💰',
  LEARNING: '📚',
  WORK: '💼',
  SOCIAL: '🎉',
  TRAVEL: '✈️',
  FOOD: '🍜',
  RETAIL: '🛍',
  CREATIVE: '🎨',
  COMMUNITY: '🤝',
  EVENT: '🎪',
  CUSTOM: '✨',
};

export const categoryV2Label: Record<CategoryV2Key, string> = {
  HABIT: 'Habits',
  FITNESS: 'Fitness',
  MONEY: 'Money',
  LEARNING: 'Learning',
  WORK: 'Work',
  SOCIAL: 'Social',
  TRAVEL: 'Travel',
  FOOD: 'Food',
  RETAIL: 'Shopping',
  CREATIVE: 'Creative',
  COMMUNITY: 'Community',
  EVENT: 'Event',
  CUSTOM: 'Custom',
};

export type CreatorIntentKey =
  | 'PERSONAL'
  | 'FRIENDS'
  | 'WORKPLACE'
  | 'MERCHANT'
  | 'EVENT'
  | 'COMMUNITY'
  | 'PUBLIC';

export const intentMeta: Record<CreatorIntentKey, { emoji: string; label: string; sub: string }> = {
  PERSONAL: { emoji: '🧍', label: 'Just me', sub: 'solo goals' },
  FRIENDS: { emoji: '👯', label: 'Friends', sub: 'private squad' },
  WORKPLACE: { emoji: '💼', label: 'Work team', sub: 'HR · wellness' },
  MERCHANT: { emoji: '🏪', label: 'My shop', sub: 'customer loyalty' },
  EVENT: { emoji: '🏕', label: 'Trip / Event', sub: 'camp · party' },
  COMMUNITY: { emoji: '🌍', label: 'Community', sub: 'club · charity' },
  PUBLIC: { emoji: '📣', label: 'Public', sub: 'open to anyone' },
};
