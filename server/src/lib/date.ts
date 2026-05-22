/**
 * Returns today at 00:00 UTC as a Date — the canonical form for Prisma's
 * `@db.Date` columns. Lining up to UTC midnight keeps composite unique keys
 * (e.g. (userId, date)) consistent regardless of server local time.
 */
export function todayUtc(now: Date = new Date()): Date {
  const iso = now.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Generates every challenge-day Date (UTC midnight) from start to start+duration-1. */
export function challengeDays(startDate: Date, durationDays: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < durationDays; i++) out.push(addDaysUtc(startDate, i));
  return out;
}
