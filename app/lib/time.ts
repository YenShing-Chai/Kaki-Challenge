export function msUntilUtcMidnight(now: Date = new Date()): number {
  const next = new Date(now.getTime());
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  const month = (d: Date) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sameMonth = month(start) === month(end);
  if (sameMonth) {
    return `${month(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  return `${month(start)} ${start.getUTCDate()} – ${month(end)} ${end.getUTCDate()}, ${start.getUTCFullYear()}`;
}
