/**
 * Badge definitions for Kaki.
 *
 * V1 strategy: pure compute from existing data on every request. No new DB
 * tables. If we later want unlock timestamps + push-notifications-on-unlock,
 * we add an Achievement table and persist on first qualifying request.
 */

export type AchievementId =
  | 'first_step'
  | 'first_win'
  | 'five_wins'
  | 'ten_wins'
  | 'hot_streak'
  | 'on_fire'
  | 'unstoppable'
  | 'perfect_run'
  | 'big_earner'
  | 'high_roller'
  | 'cross_trainer'
  | 'renaissance'
  | 'comeback_kid'
  | 'early_bird'
  | 'veteran';

export type AchievementDef = {
  id: AchievementId;
  title: string;
  description: string;
  emoji: string;
  /** Target value the user is working toward (for progress bars). */
  target: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_step',   title: 'First Step',     description: 'Join your first challenge.',          emoji: '👟', target: 1 },
  { id: 'first_win',    title: 'First Win',      description: 'Survive your first challenge.',       emoji: '🏆', target: 1 },
  { id: 'five_wins',    title: 'Take Five',      description: 'Win 5 challenges.',                   emoji: '✋', target: 5 },
  { id: 'ten_wins',     title: 'Decathlete',     description: 'Win 10 challenges.',                  emoji: '🔟', target: 10 },
  { id: 'hot_streak',   title: 'Hot Streak',     description: '7 days in a row, any challenge.',     emoji: '🔥', target: 7 },
  { id: 'on_fire',      title: 'On Fire',        description: '30 days in a row, any challenge.',    emoji: '🌶️', target: 30 },
  { id: 'unstoppable',  title: 'Unstoppable',    description: '100 days in a row.',                  emoji: '🚀', target: 100 },
  { id: 'perfect_run',  title: 'Perfect Run',    description: 'Complete every day of a challenge.',  emoji: '💯', target: 1 },
  { id: 'big_earner',   title: 'Big Earner',     description: 'Earn $50 in winnings.',               emoji: '💵', target: 50 },
  { id: 'high_roller',  title: 'High Roller',    description: 'Earn $200 in winnings.',              emoji: '💎', target: 200 },
  { id: 'cross_trainer',title: 'Cross-Trainer',  description: 'Try 3 different categories.',         emoji: '🌐', target: 3 },
  { id: 'renaissance',  title: 'Renaissance',    description: 'Try 5 different categories.',         emoji: '🎭', target: 5 },
  { id: 'comeback_kid', title: 'Comeback Kid',   description: 'Win a challenge after losing one.',   emoji: '🔁', target: 1 },
  { id: 'early_bird',   title: 'Early Bird',     description: 'Member for 30 days.',                 emoji: '🐤', target: 30 },
  { id: 'veteran',      title: 'Veteran',        description: 'Member for one year.',                emoji: '🎖️', target: 365 },
];

export type AchievementInput = {
  participationsTotal: number;
  wins: number;
  losses: number;
  longestCrossStreak: number;
  totalWon: number;
  categoriesTouched: number;
  hasPerfectRun: boolean;
  daysSinceJoin: number;
  hasComeback: boolean; // has both an ELIMINATED and a later QUALIFIED participation
};

export type AchievementResult = AchievementDef & {
  unlocked: boolean;
  /** Current value toward target (capped at target). */
  current: number;
};

export function evaluateAchievements(input: AchievementInput): AchievementResult[] {
  const valueFor = (id: AchievementId): number => {
    switch (id) {
      case 'first_step':    return input.participationsTotal;
      case 'first_win':     return input.wins;
      case 'five_wins':     return input.wins;
      case 'ten_wins':      return input.wins;
      case 'hot_streak':    return input.longestCrossStreak;
      case 'on_fire':       return input.longestCrossStreak;
      case 'unstoppable':   return input.longestCrossStreak;
      case 'perfect_run':   return input.hasPerfectRun ? 1 : 0;
      case 'big_earner':    return input.totalWon;
      case 'high_roller':   return input.totalWon;
      case 'cross_trainer': return input.categoriesTouched;
      case 'renaissance':   return input.categoriesTouched;
      case 'comeback_kid':  return input.hasComeback ? 1 : 0;
      case 'early_bird':    return input.daysSinceJoin;
      case 'veteran':       return input.daysSinceJoin;
    }
  };

  return ACHIEVEMENTS.map((def) => {
    const raw = valueFor(def.id);
    const current = Math.min(raw, def.target);
    return {
      ...def,
      unlocked: raw >= def.target,
      current,
    };
  });
}
