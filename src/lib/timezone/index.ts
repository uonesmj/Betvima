/**
 * TIMEZONE / SETTLEMENT-WINDOW LIBRARY
 *
 * The sportsbook settles affiliate periods on a configurable day and time in a configurable
 * IANA timezone (default: Friday, Asia/Tehran). Everything here is pure and dependency-free
 * (only `Intl`), so the same helpers run on the server, in workers and in the browser.
 *
 * Why not store offsets? An offset is wrong twice a year. Windows are therefore always derived
 * from the IANA zone, and DST transitions are handled by asking the runtime for the offset that
 * is in effect at a given instant.
 */

export interface SettlementWindow {
  /** Period the settlement closes (inclusive end, UTC). */
  periodEnd: Date;
  /** Next period start (the instant after periodEnd). */
  periodStart: Date;
  /** Settlement day (0 = Sunday … 6 = Saturday), in the configured zone. */
  day: number;
  hour: number;
  minute: number;
  timezone: string;
  /** Local wall-clock representation, for display only. */
  localLabel: string;
}

const DEFAULT_TIMEZONE = 'Asia/Tehran';

/** IANA validity check that never throws for a malformed value. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(timezone: string | null | undefined): string {
  const candidate = (timezone ?? '').trim();
  if (!candidate) return DEFAULT_TIMEZONE;
  return isValidTimezone(candidate) ? candidate : DEFAULT_TIMEZONE;
}

/** Wall-clock parts of an instant in a given zone. */
export function zonedParts(instant: Date, timezone: string): {
  year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimezone(timezone),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => Number.parseInt(parts.find((part) => part.type === type)?.value ?? '0', 10);
  const weekdayName = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName) % 7;
  const hour = get('hour');
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: hour === 24 ? 0 : hour, minute: get('minute'), second: get('second'),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

/** Offset of a zone at an instant, in milliseconds. */
export function zoneOffsetMs(instant: Date, timezone: string): number {
  const parts = zonedParts(instant, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock time in a zone to the corresponding UTC instant.
 * The zone offset is resolved twice (the offset at the naive instant and again with it applied),
 * which is what makes times on either side of a DST switch resolve correctly.
 */
export function zonedTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number, timezone: string,
): Date {
  const zone = normalizeTimezone(timezone);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = new Date(naive - zoneOffsetMs(new Date(naive), zone));
  const refined = new Date(naive - zoneOffsetMs(firstGuess, zone));
  return refined;
}

export function addDaysUtc(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

export function addMonths(year: number, month: number, months: number): { year: number; month: number } {
  const zeroBased = (month - 1) + months;
  return { year: year + Math.floor(zeroBased / 12), month: ((zeroBased % 12) + 12) % 12 + 1 };
}

export interface SettlementSchedule {
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}

/**
 * The settlement window that closed most recently at/before `now`, and the window that follows.
 * `day`/`hour`/`minute` are interpreted in `timezone`.
 */
export function settlementWindow(now: Date, schedule: SettlementSchedule): SettlementWindow {
  const timezone = normalizeTimezone(schedule.timezone);
  const day = ((schedule.day % 7) + 7) % 7;
  const hour = ((schedule.hour % 24) + 24) % 24;
  const minute = ((schedule.minute % 60) + 60) % 60;
  const local = zonedParts(now, timezone);

  const daysSince = (local.weekday - day + 7) % 7;
  let candidateDate = addDaysUtc(new Date(Date.UTC(local.year, local.month - 1, local.day)), -daysSince);
  let candidateParts = simpleParts(candidateDate);
  let candidate = zonedTimeToUtc(candidateParts.year, candidateParts.month, candidateParts.day, hour, minute, timezone);
  if (candidate.getTime() > now.getTime()) {
    candidateDate = addDaysUtc(candidateDate, -7);
    candidateParts = simpleParts(candidateDate);
    candidate = zonedTimeToUtc(candidateParts.year, candidateParts.month, candidateParts.day, hour, minute, timezone);
  }

  const nextBase = addDaysUtc(candidateDate, 7);
  const nextParts = simpleParts(nextBase);
  const next = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, hour, minute, timezone);
  const label = zonedParts(candidate, timezone);

  return {
    periodEnd: candidate,
    periodStart: next,
    day, hour, minute, timezone,
    localLabel: `${String(label.year).padStart(4, '0')}-${String(label.month).padStart(2, '0')}-${String(label.day).padStart(2, '0')} ${String(label.hour).padStart(2, '0')}:${String(label.minute).padStart(2, '0')} (${timezone})`,
  };
}

function simpleParts(instant: Date): { year: number; month: number; day: number } {
  return {
    year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1, day: instant.getUTCDate(),
  };
}

/** Weekly period [start, end) that contains `now`, in the settlement schedule. */
export function currentDailyPeriod(
  now = new Date(),
  timeZone = 'Asia/Tehran',
): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get('year');
  const month = get('month');
  const day = get('day');

  const probe = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  const offsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(probe);

  const offsetText = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = offsetText.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const offsetMinutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
    : 0;

  const start = new Date(probe.getTime() - offsetMinutes * 60_000);

  const tomorrowParts = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = tomorrowParts.getUTCFullYear();
  const nextMonth = tomorrowParts.getUTCMonth();
  const nextDay = tomorrowParts.getUTCDate();
  const nextProbe = new Date(Date.UTC(nextYear, nextMonth, nextDay, 0, 0, 0, 0));

  const nextOffsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(nextProbe);

  const nextOffsetText = nextOffsetParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const nextMatch = nextOffsetText.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const nextOffsetMinutes = nextMatch
    ? (nextMatch[1] === '-' ? -1 : 1) * (Number(nextMatch[2]) * 60 + Number(nextMatch[3] ?? 0))
    : 0;

  const end = new Date(nextProbe.getTime() - nextOffsetMinutes * 60_000);
  return { start, end };
}

export function currentWeeklyPeriod(now: Date, schedule: SettlementSchedule): { start: Date; end: Date } {
  const previous = settlementWindow(now, schedule);
  const earlier = settlementWindow(new Date(previous.periodEnd.getTime() - 1000), schedule);
  return { start: earlier.periodEnd, end: previous.periodEnd };
}

/** Copy an instant into a zone's ISO-like string, useful for logs and exports. */
export function formatInZone(instant: Date, timezone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeTimezone(timezone), dateStyle: 'medium', timeStyle: 'short',
  }).format(instant);
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'] as const;
export const DEFAULT_SETTLEMENT_SCHEDULE: SettlementSchedule = { day: 5, hour: 0, minute: 0, timezone: DEFAULT_TIMEZONE };
