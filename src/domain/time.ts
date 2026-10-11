/**
 * NOVA - TIME / CLOCK
 * All persisted instants are UTC. Display timezone is configuration, never server local time.
 * Affiliate weekly settlement uses the configured affiliate timezone (default Asia/Tehran).
 */

export interface Clock {
  now(): Date;
  /** Monotonic milliseconds; used only for worker timings, never for financial records. */
  monotonicMs(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  monotonicMs(): number {
    return Number(process.hrtime.bigint() / 1_000_000n);
  }
}

/** Deterministic clock for tests ONLY (never constructed in production code paths). */
export class FixedClock implements Clock {
  private current: Date;
  constructor(start: Date | string) {
    this.current = typeof start === 'string' ? new Date(start) : new Date(start.getTime());
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  monotonicMs(): number {
    return this.current.getTime();
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date | string): void {
    this.current = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Offset of a timezone at a given instant, in ms (handles DST correctly, incl. no-DST zones). */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - instant.getTime();
}

export interface LocalParts {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
  /** 1 = Monday ... 7 = Sunday (ISO) */
  isoWeekday: number;
}

export function localParts(instant: Date, timeZone: string): LocalParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const isoWeekday = weekdayNames.indexOf(get('weekday')) + 1;
  return {
    year: Number(get('year')), month: Number(get('month')), day: Number(get('day')),
    hour: Number(get('hour')), minute: Number(get('minute')), second: Number(get('second')),
    isoWeekday: isoWeekday === 0 ? 1 : isoWeekday,
  };
}

/** Convert a wall-clock time in `timeZone` to the corresponding UTC instant. */
export function zonedWallClockToUtc(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
  let guess = new Date(naive);
  // Two-pass offset resolution is stable for all real zones (DST transitions included).
  for (let i = 0; i < 2; i += 1) {
    const offset = timeZoneOffsetMs(guess, timeZone);
    guess = new Date(naive - offset);
  }
  return guess;
}

export function addDaysLocal(parts: LocalParts, days: number): { year: number; month: number; day: number } {
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);
  const shifted = new Date(base + days * DAY_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export interface Period {
  readonly start: Date;
  readonly end: Date; // exclusive
}

/**
 * Weekly settlement period [start, end) in the configured timezone.
 * Default schedule: settlement RUNS EVERY FRIDAY at `cutoffLocal` local time and
 * covers the previous 7 days ending at the cutoff instant.
 */
export function weeklyPeriodEndingAt(
  endLocal: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
  daysBack = 7,
): Period {
  const end = zonedWallClockToUtc(endLocal, timeZone);
  const startParts = addDaysLocal(
    { ...endLocal, second: 0, isoWeekday: 1 },
    -daysBack,
  );
  const start = zonedWallClockToUtc({ ...startParts, hour: endLocal.hour, minute: endLocal.minute, second: 0 }, timeZone);
  return { start, end };
}

/** The most recent occurrence of `isoWeekday` at `hour`:`minute` local time, at or before `now`. */
export function lastWeeklyCutoff(
  now: Date,
  isoWeekday: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const local = localParts(now, timeZone);
  let deltaDays = local.isoWeekday - isoWeekday;
  if (deltaDays < 0) deltaDays += 7;
  let candidateParts = addDaysLocal(local, -deltaDays);
  let candidate = zonedWallClockToUtc({ ...candidateParts, hour, minute, second: 0 }, timeZone);
  if (candidate.getTime() > now.getTime()) {
    candidateParts = addDaysLocal(candidateParts as LocalParts & { isoWeekday: number }, -7);
    candidate = zonedWallClockToUtc({ ...candidateParts, hour, minute, second: 0 }, timeZone);
  }
  return candidate;
}

export function nextWeeklyCutoff(
  now: Date,
  isoWeekday: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const last = lastWeeklyCutoff(now, isoWeekday, hour, minute, timeZone);
  const local = localParts(last, timeZone);
  const nextParts = addDaysLocal(local, 7);
  return zonedWallClockToUtc({ ...nextParts, hour, minute, second: 0 }, timeZone);
}

export const FRIDAY_ISO = 5;

export function isoWeekKey(instant: Date, timeZone = 'UTC'): string {
  const p = localParts(instant, timeZone);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dayKey(instant: Date, timeZone = 'UTC'): string {
  const p = localParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
