/**
 * Kaki — Style A (Vibrant Gamified) design tokens.
 * Use these via `import { colors, radius, type, shadow } from '../lib/theme'`.
 */

export const colors = {
  // Greens
  primary: '#3FA84E',
  primaryDark: '#2E7D3A',
  power: '#7BBF52',

  // Mints
  mint: '#E8F5EC',
  mintDark: '#CDEAD4',

  // Ink + text
  ink: '#0F2A1A',
  text: '#0F2A1A',
  textMuted: '#666',
  textFaint: '#999',
  textMicro: '#888',

  // Surface
  bg: '#FFFFFF',
  bgSoft: '#FAFAFA',
  border: '#EEEEEE',
  borderStrong: '#E5E7EB',

  // Status
  danger: '#B91C1C',
  warn: '#854D0E',
  warnBg: '#FEF3C7',
  warnBorder: '#FDE68A',
  success: '#14532D',
  successBg: '#DCFCE7',

  // Category hero gradient pairs (StepBet-style)
  catFitness: ['#7BBF52', '#3FA84E'] as const,
  catReading: ['#C77F33', '#8B4513'] as const,
  catMindfulness: ['#A78BFA', '#7C3AED'] as const,
  catLearning: ['#60A5FA', '#1D4ED8'] as const,
  catProductivity: ['#FBBF24', '#D97706'] as const,
  catCreative: ['#F472B6', '#BE185D'] as const,
  catWellness: ['#818CF8', '#4338CA'] as const,
  catMoney: ['#FCD34D', '#F59E0B'] as const,
  catSocial: ['#34D399', '#059669'] as const,
  catOutdoors: ['#86EFAC', '#15803D'] as const,
} as const;

export const radius = {
  card: 18,
  cardLg: 22,
  pill: 999,
  control: 12,
  chip: 999,
  hero: 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: '500' as const },
  bodyStrong: { fontSize: 14, fontWeight: '700' as const },
  meta: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: colors.textMicro,
  },
  label: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: colors.ink,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

/**
 * Resolve the gradient color pair for a given category key.
 */
export type CategoryKey =
  | 'FITNESS'
  | 'MINDFULNESS'
  | 'READING'
  | 'LEARNING'
  | 'PRODUCTIVITY'
  | 'CREATIVE'
  | 'WELLNESS'
  | 'MONEY'
  | 'SOCIAL'
  | 'OUTDOORS';

export function categoryGradient(key: CategoryKey | null | undefined): readonly [string, string] {
  switch (key) {
    case 'FITNESS': return colors.catFitness;
    case 'READING': return colors.catReading;
    case 'MINDFULNESS': return colors.catMindfulness;
    case 'LEARNING': return colors.catLearning;
    case 'PRODUCTIVITY': return colors.catProductivity;
    case 'CREATIVE': return colors.catCreative;
    case 'WELLNESS': return colors.catWellness;
    case 'MONEY': return colors.catMoney;
    case 'SOCIAL': return colors.catSocial;
    case 'OUTDOORS': return colors.catOutdoors;
    default: return colors.catFitness;
  }
}

export const categoryEmoji: Record<CategoryKey, string> = {
  FITNESS: '🏃',
  MINDFULNESS: '🧘',
  READING: '📚',
  LEARNING: '🎓',
  PRODUCTIVITY: '⚡',
  CREATIVE: '🎨',
  WELLNESS: '🌙',
  MONEY: '💰',
  SOCIAL: '👥',
  OUTDOORS: '🌳',
};

export const categoryLabel: Record<CategoryKey, string> = {
  FITNESS: 'Fitness',
  MINDFULNESS: 'Mindfulness',
  READING: 'Reading',
  LEARNING: 'Learning',
  PRODUCTIVITY: 'Productivity',
  CREATIVE: 'Creative',
  WELLNESS: 'Wellness',
  MONEY: 'Money',
  SOCIAL: 'Social',
  OUTDOORS: 'Outdoors',
};
