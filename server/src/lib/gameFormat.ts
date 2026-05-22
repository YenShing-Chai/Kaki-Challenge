import type { Challenge } from '../db/schema';

type DayType = 'POWER' | 'ACTIVE' | 'FREE' | 'MISSED';

/**
 * Classify a day for a WEEKLY_QUOTA challenge based on the step count.
 * Returns null for DAILY_STREAK challenges (dayType is unused there).
 */
export function classifyDay(
  challenge: Pick<Challenge, 'gameFormat' | 'activeStepGoal' | 'powerStepGoal'>,
  stepsCount: number,
): DayType | null {
  if (challenge.gameFormat !== 'WEEKLY_QUOTA') return null;
  const powerGoal = challenge.powerStepGoal ?? Number.MAX_SAFE_INTEGER;
  const activeGoal = challenge.activeStepGoal ?? Number.MAX_SAFE_INTEGER;
  if (stepsCount >= powerGoal) return 'POWER';
  if (stepsCount >= activeGoal) return 'ACTIVE';
  return 'MISSED';
}

/**
 * For WEEKLY_QUOTA, the "daily" step goal used by /sync to set the `completed`
 * flag is the ACTIVE threshold (hitting Active counts toward the quota).
 * For DAILY_STREAK, use the single dailyStepGoal.
 */
export function effectiveDailyGoal(
  challenge: Pick<Challenge, 'gameFormat' | 'dailyStepGoal' | 'activeStepGoal'>,
): number {
  if (challenge.gameFormat === 'WEEKLY_QUOTA') {
    return challenge.activeStepGoal ?? challenge.dailyStepGoal;
  }
  return challenge.dailyStepGoal;
}

/**
 * Given a challenge start date and an arbitrary date, return the 0-indexed
 * week number (week 0 = first 7 days from startDate).
 */
export function weekIndex(startDate: Date, date: Date): number {
  const ms = date.getTime() - startDate.getTime();
  return Math.floor(ms / (7 * 86400000));
}

/**
 * Last day of the Nth week (inclusive), 0-indexed. Returns startDate + (N+1)*7 - 1.
 */
export function weekEndDate(startDate: Date, weekIdx: number): Date {
  const d = new Date(startDate);
  d.setUTCDate(d.getUTCDate() + (weekIdx + 1) * 7 - 1);
  return d;
}

/**
 * Did the participant satisfy the weekly quota for the given week?
 *   - POWER days >= weeklyPowerDays
 *   - POWER + ACTIVE days >= (weeklyPowerDays + weeklyActiveDays)
 *   - MISSED days <= weeklyFreeDays
 */
export function weekQuotaSatisfied(
  challenge: Pick<Challenge, 'weeklyActiveDays' | 'weeklyPowerDays' | 'weeklyFreeDays'>,
  weekDays: Array<{ dayType: DayType | null }>,
): boolean {
  const need = {
    power: challenge.weeklyPowerDays ?? 0,
    active: challenge.weeklyActiveDays ?? 0,
    free: challenge.weeklyFreeDays ?? 0,
  };
  let power = 0;
  let active = 0;
  let missed = 0;
  for (const d of weekDays) {
    if (d.dayType === 'POWER') power++;
    else if (d.dayType === 'ACTIVE') active++;
    else if (d.dayType === 'MISSED') missed++;
  }
  if (power < need.power) return false;
  if (power + active < need.power + need.active) return false;
  if (missed > need.free) return false;
  return true;
}
