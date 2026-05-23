/**
 * Safety + risk + moderation engine — PRD §9 + §10.
 *
 * Pipeline a /validate or /create call runs through:
 *   1. keyword scan (prohibited?  block immediately)
 *   2. risk-level classification (LOW/MEDIUM/HIGH/PROHIBITED)
 *   3. moderation status decision (AUTO_APPROVED vs PENDING_REVIEW vs BLOCKED)
 *   4. safer-rewrite suggestion if blocked
 *
 * All pure functions. No DB writes.
 */

import type { RewardType, VerificationLevel } from './verification';
import { checkRewardVerificationCompatibility } from './verification';

// ─── Types ─────────────────────────────────────────────────────────────────

export type CreatorIntent =
  | 'PERSONAL'
  | 'FRIENDS'
  | 'WORKPLACE'
  | 'MERCHANT'
  | 'EVENT'
  | 'COMMUNITY'
  | 'PUBLIC';

export type CategoryV2 =
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

export type Visibility = 'PRIVATE' | 'GROUP' | 'PUBLIC';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'PROHIBITED';

export type ModerationStatus =
  | 'AUTO_APPROVED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'BLOCKED'
  | 'REJECTED';

export interface ModerationInput {
  title: string;
  description?: string | null;
  intent: CreatorIntent;
  category: CategoryV2;
  visibility: Visibility;
  reward: RewardType;
  verification: VerificationLevel;
  participantLimit?: number | null;
  contributionAmount?: number | null; // for Winner Pool
  creatorTrustScore?: number; // 0-100
}

export interface ModerationVerdict {
  riskLevel: RiskLevel;
  moderationStatus: ModerationStatus;
  blocked: boolean;
  blockReason?: string;
  suggestedAlternative?: SaferRewrite;
  warnings: string[]; // non-blocking flags worth surfacing
}

// ─── Prohibited keyword sets — PRD §9.3 ─────────────────────────────────────

/**
 * Each set has a category label and a list of patterns. Detection uses simple
 * whole-word match against title + description (lowercased). Real production
 * should add language-specific tokenisation; for MVP this catches the
 * obvious cases the PRD explicitly names.
 */

const ALCOHOL_ROOT = [
  'shot',
  'shots',
  'beer',
  'beers',
  'whisky',
  'whiskey',
  'vodka',
  'tequila',
  'rum',
  'gin',
  'wine',
  'drunk',
  'drinking',
  'drink',
];
const ALCOHOL_QUANTITY = ['most', 'fastest', 'finish', 'chug', 'bottle', 'bottles', 'down'];

const DRUGS = ['drug', 'drugs', 'weed', 'cocaine', 'meth', 'heroin', 'ecstasy', 'lsd', 'molly'];
const VIOLENCE = ['fight', 'assault', 'punch', 'beat up', 'attack', 'weapon', 'knife', 'gun'];
const SELF_HARM = ['cut', 'cutting', 'starve', 'starving', 'fast', 'fasting', 'choke', 'choking'];
const ILLEGAL = ['steal', 'theft', 'shoplift', 'trespass', 'graffiti', 'vandalism'];
const DANGEROUS_STUNTS = [
  'rooftop',
  'parkour',
  'street race',
  'drag race',
  'sky dive',
  'cliff jump',
  'free climb',
];
const HARASSMENT = ['prank', 'humiliate', 'shame', 'embarrass'];
const SEXUAL = ['nude', 'naked', 'stripped', 'sex'];
const HATE = ['hate', 'racist', 'slur'];
const GAMBLING_BETS = ['bet', 'bets', 'wager', 'odds', 'parlay', 'jackpot', 'lottery'];
const FINANCIAL_HARM = ['borrow to win', 'loan to win', 'leverage'];

interface KeywordCategory {
  label: string;
  pattern: string[];
  // If true, alone is enough to PROHIBITED. If false, needs co-occurrence.
  immediateBlock: boolean;
  saferTemplate?: SaferRewrite['template'];
}

const KEYWORD_CATEGORIES: KeywordCategory[] = [
  // Alcohol — only blocked when combined with quantity/speed/endurance words
  // The PRD allows "responsible night out" social challenges to coexist.
  { label: 'alcohol-quantity', pattern: ALCOHOL_QUANTITY, immediateBlock: false },
  { label: 'drugs', pattern: DRUGS, immediateBlock: true, saferTemplate: 'WELLNESS_HABIT' },
  { label: 'violence', pattern: VIOLENCE, immediateBlock: true, saferTemplate: 'TEAM_BONDING' },
  { label: 'self-harm', pattern: SELF_HARM, immediateBlock: true, saferTemplate: 'WELLNESS_HABIT' },
  { label: 'illegal', pattern: ILLEGAL, immediateBlock: true, saferTemplate: 'COMMUNITY_CIVIC' },
  { label: 'dangerous-stunt', pattern: DANGEROUS_STUNTS, immediateBlock: true, saferTemplate: 'OUTDOOR_SAFE' },
  { label: 'harassment', pattern: HARASSMENT, immediateBlock: true, saferTemplate: 'TEAM_BONDING' },
  { label: 'sexual', pattern: SEXUAL, immediateBlock: true },
  { label: 'hate', pattern: HATE, immediateBlock: true },
  { label: 'gambling-bets', pattern: GAMBLING_BETS, immediateBlock: true, saferTemplate: 'SKILL_COMPLETION' },
  { label: 'financial-harm', pattern: FINANCIAL_HARM, immediateBlock: true, saferTemplate: 'SAVINGS_HABIT' },
];

// ─── Safer rewrites — PRD §9.4 + §13.2 ──────────────────────────────────────

export interface SaferRewrite {
  template:
    | 'RESPONSIBLE_NIGHT_OUT'
    | 'WELLNESS_HABIT'
    | 'TEAM_BONDING'
    | 'COMMUNITY_CIVIC'
    | 'OUTDOOR_SAFE'
    | 'SKILL_COMPLETION'
    | 'SAVINGS_HABIT';
  title: string;
  description: string;
}

const SAFER_REWRITES: Record<SaferRewrite['template'], Omit<SaferRewrite, 'template'>> = {
  RESPONSIBLE_NIGHT_OUT: {
    title: 'Responsible night out',
    description: 'Stay within your spend budget, drink water between drinks, and confirm you got home safely.',
  },
  WELLNESS_HABIT: {
    title: 'Wellness habit streak',
    description: 'Build a healthy daily habit — water intake, sleep, mindfulness — over 7 days.',
  },
  TEAM_BONDING: {
    title: 'Team bonding checklist',
    description: 'Complete fun group activities together — photo prompts, shared meals, collaborative tasks.',
  },
  COMMUNITY_CIVIC: {
    title: 'Community good deed',
    description: 'Volunteer hours, clean-up activities, or small acts of community kindness.',
  },
  OUTDOOR_SAFE: {
    title: 'Outdoor adventure (safe)',
    description: 'Trail walks, park check-ins, photo scavenger hunt — verified by location pin.',
  },
  SKILL_COMPLETION: {
    title: 'Skill challenge — verified effort',
    description: 'Complete a measurable skill task — courses, practice sessions, creative output.',
  },
  SAVINGS_HABIT: {
    title: 'Savings habit',
    description: 'Save a target amount over the period — verified by bank/snapshot proof.',
  },
};

// ─── Keyword scan ───────────────────────────────────────────────────────────

interface KeywordMatch {
  label: string;
  saferTemplate?: SaferRewrite['template'];
  immediateBlock: boolean;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasAnyToken(tokens: string[], patterns: string[]): boolean {
  const set = new Set(tokens);
  for (const p of patterns) {
    if (p.includes(' ')) {
      // multi-word phrase: substring match on the joined text
      if (tokens.join(' ').includes(p)) return true;
    } else if (set.has(p)) {
      return true;
    }
  }
  return false;
}

function scanKeywords(title: string, description?: string | null): KeywordMatch[] {
  const text = `${title} ${description ?? ''}`;
  const tokens = tokenize(text);
  const matches: KeywordMatch[] = [];

  // Special-case alcohol: only flag if alcohol root + quantity/speed words both present
  const alcoholRoot = hasAnyToken(tokens, ALCOHOL_ROOT);
  const alcoholQuantity = hasAnyToken(tokens, ALCOHOL_QUANTITY);
  if (alcoholRoot && alcoholQuantity) {
    matches.push({
      label: 'alcohol-quantity',
      immediateBlock: true,
      saferTemplate: 'RESPONSIBLE_NIGHT_OUT',
    });
  }

  // Numeric quantity signal too: "20 shots", "5 beers", etc
  const numericQuantity = /\b\d+\s*(shots?|beers?|bottles?|drinks?)\b/.test(text.toLowerCase());
  if (alcoholRoot && numericQuantity && !matches.some((m) => m.label === 'alcohol-quantity')) {
    matches.push({
      label: 'alcohol-quantity',
      immediateBlock: true,
      saferTemplate: 'RESPONSIBLE_NIGHT_OUT',
    });
  }

  for (const cat of KEYWORD_CATEGORIES) {
    if (cat.label === 'alcohol-quantity') continue; // already handled above
    if (hasAnyToken(tokens, cat.pattern)) {
      matches.push({
        label: cat.label,
        immediateBlock: cat.immediateBlock,
        saferTemplate: cat.saferTemplate,
      });
    }
  }
  return matches;
}

// ─── Risk classification — PRD §9.2 ─────────────────────────────────────────

function categoryBaseRisk(category: CategoryV2): RiskLevel {
  // Aligned with PRD §5 category default-risk table
  switch (category) {
    case 'LEARNING':
    case 'WORK':
    case 'FOOD':
    case 'CREATIVE':
      return 'LOW';
    case 'HABIT':
    case 'FITNESS':
    case 'MONEY':
    case 'SOCIAL':
    case 'TRAVEL':
    case 'RETAIL':
    case 'COMMUNITY':
    case 'EVENT':
      return 'MEDIUM';
    case 'CUSTOM':
      return 'HIGH';
  }
}

/**
 * Bump risk up by N levels. Caps at HIGH — only keyword/policy hard-blocks
 * promote to PROHIBITED, never aggregation. This keeps the failure mode
 * "send to admin review" rather than silently blocking with no clear reason.
 */
function bumpRisk(level: RiskLevel, by: 1 | 2 = 1): RiskLevel {
  const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
  // PROHIBITED never bumps further
  if (level === 'PROHIBITED') return 'PROHIBITED';
  const idx = order.indexOf(level);
  const next = order[Math.min(order.length - 1, idx + by)];
  return next ?? 'HIGH';
}

function risesPublicWithReward(intent: CreatorIntent, visibility: Visibility, reward: RewardType): boolean {
  if (visibility !== 'PUBLIC') return false;
  if (reward === 'NONE' || reward === 'BADGE') return false;
  return true;
}

// ─── Top-level validation ───────────────────────────────────────────────────

export function evaluateModeration(input: ModerationInput): ModerationVerdict {
  const warnings: string[] = [];

  // 1. Reward × verification compatibility — hard rule
  const rewardErr = checkRewardVerificationCompatibility(input.reward, input.verification);
  if (rewardErr) {
    return {
      riskLevel: 'PROHIBITED',
      moderationStatus: 'BLOCKED',
      blocked: true,
      blockReason: rewardErr,
      warnings,
    };
  }

  // 2. Keyword scan
  const keywordHits = scanKeywords(input.title, input.description);
  const blockingHit = keywordHits.find((k) => k.immediateBlock);
  if (blockingHit) {
    const safer = blockingHit.saferTemplate
      ? { template: blockingHit.saferTemplate, ...SAFER_REWRITES[blockingHit.saferTemplate] }
      : undefined;
    const reasonByLabel: Record<string, string> = {
      'alcohol-quantity':
        'This challenge appears to encourage dangerous alcohol consumption.',
      drugs: 'Drug-related challenges are not allowed.',
      violence: 'Challenges encouraging violence are not allowed.',
      'self-harm': 'Challenges that risk self-harm are not allowed.',
      illegal: 'Challenges that promote illegal activity are not allowed.',
      'dangerous-stunt': 'Dangerous stunts are not allowed.',
      harassment: 'Harassment or humiliation challenges are not allowed.',
      sexual: 'Sexual content is not allowed.',
      hate: 'Hate speech is not allowed.',
      'gambling-bets': 'Chance-based betting is not allowed. Try a skill challenge.',
      'financial-harm': 'Financially harmful challenges are not allowed.',
    };
    return {
      riskLevel: 'PROHIBITED',
      moderationStatus: 'BLOCKED',
      blocked: true,
      blockReason: reasonByLabel[blockingHit.label] ?? 'Content not allowed.',
      suggestedAlternative: safer,
      warnings,
    };
  }

  // 3. Soft warnings from non-blocking keyword matches (e.g. alcohol root only)
  // (currently none — kept as a hook for future heuristics)

  // 4. Base risk from category
  let risk = categoryBaseRisk(input.category);

  // 5. Intent / visibility / reward escalation
  if (input.intent === 'PUBLIC' || input.visibility === 'PUBLIC') {
    if (input.reward !== 'NONE' && input.reward !== 'BADGE') risk = bumpRisk(risk, 1);
  }
  if (input.reward === 'WINNER_POOL') {
    risk = bumpRisk(risk, 1);
    if (input.visibility === 'PUBLIC') {
      // Winner Pool PRD §10.2 — public pools not allowed in MVP
      return {
        riskLevel: 'PROHIBITED',
        moderationStatus: 'BLOCKED',
        blocked: true,
        blockReason: 'Public Winner Pool challenges are not supported in MVP. Use private/invite-only.',
        warnings,
      };
    }
  }
  if (input.intent === 'MERCHANT' && input.reward !== 'NONE' && input.reward !== 'BADGE') {
    risk = bumpRisk(risk, 1);
  }
  if (risesPublicWithReward(input.intent, input.visibility, input.reward)) {
    warnings.push('Public reward challenges require admin review.');
  }

  // 6. Low creator trust pushes risk up
  if (typeof input.creatorTrustScore === 'number' && input.creatorTrustScore < 40) {
    risk = bumpRisk(risk, 1);
    warnings.push('Low creator trust score — extra review applied.');
  }

  // 7. Moderation status from risk + reward
  let moderationStatus: ModerationStatus = 'AUTO_APPROVED';

  // Winner Pool MVP: always PENDING_REVIEW regardless of risk (PRD §26)
  if (input.reward === 'WINNER_POOL') {
    moderationStatus = 'PENDING_REVIEW';
  } else if (risk === 'HIGH') {
    moderationStatus = 'PENDING_REVIEW';
  } else if (risk === 'MEDIUM') {
    // Public + reward → review. Private + reward → auto-approve.
    moderationStatus =
      input.visibility === 'PUBLIC' && input.reward !== 'NONE' && input.reward !== 'BADGE'
        ? 'PENDING_REVIEW'
        : 'AUTO_APPROVED';
  } else if (risk === 'LOW') {
    moderationStatus =
      input.visibility === 'PUBLIC' && input.reward !== 'NONE' && input.reward !== 'BADGE'
        ? 'PENDING_REVIEW'
        : 'AUTO_APPROVED';
  }

  return {
    riskLevel: risk,
    moderationStatus,
    blocked: false,
    warnings,
  };
}

// ─── Exports for callers ────────────────────────────────────────────────────

export const __forTests = {
  scanKeywords,
  categoryBaseRisk,
  bumpRisk,
};
