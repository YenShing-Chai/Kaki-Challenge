/** Returns local hour/minute (24h) for a user's IANA timezone. */
export function localHHMM(
  timezone: string,
  now: Date = new Date(),
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

/** Today (UTC midnight) for a user's local "today". */
export function todayInTimezone(timezone: string, now: Date = new Date()): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${iso}T00:00:00.000Z`);
}
