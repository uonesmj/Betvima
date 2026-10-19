/**
 * Match CLOCK fields only. Bet365 InPlay Filter deliberately omits its clock
 * for many fixtures. Never infer minutes from scheduledAt or market prices.
 *
 * The detailed event returns TM/TS/TT/TU. Official BetsAPI FAQ specifies TU as
 * YYYYMMDDHHMMSS in Europe/London local time (including BST in summer).
 */
import { object, string } from './betsapi-normalization';

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const s = string(value);
  if (!/^\d{1,4}$/.test(s)) return null;
  const parsed = Number(s);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
function londonTimestamp(stamp: unknown): number | null {
  const s = string(stamp);
  if (!/^\d{14}$/.test(s)) return null;
  const year = Number(s.slice(0,4)), month = Number(s.slice(4,6)),
    day = Number(s.slice(6,8)), hour = Number(s.slice(8,10)),
    minute = Number(s.slice(10,12)), second = Number(s.slice(12,14));
  const naive = Date.UTC(year, month-1, day, hour, minute, second);
  const nominal = new Date(naive);
  if (!Number.isFinite(naive) || year < 2010 || month < 1 || month > 12 ||
      day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 ||
      nominal.getUTCFullYear() !== year || nominal.getUTCMonth() !== month-1 ||
      nominal.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/London',hourCycle:'h23',year:'numeric',month:'2-digit',
    day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',
  }).formatToParts(new Date(naive));
  const part = (kind:string) => Number(parts.find(p=>p.type===kind)?.value);
  const represented = Date.UTC(part('year'),part('month')-1,part('day'),
    part('hour'),part('minute'),part('second'));
  const offset = represented - naive;
  return naive - offset;
}

export function betsApiLiveMinute(value: unknown, nowMs = Date.now()): number | null {
  const parent = object(value);
  const timer = Object.keys(object(parent.timer)).length ? object(parent.timer) : parent;
  const minute = number(timer.tm ?? timer.TM), seconds = number(timer.ts ?? timer.TS);
  if (minute === null || minute > 200 || seconds !== null && seconds > 59) return null;
  let extraSeconds = 0;
  const ticking = string(timer.tt ?? timer.TT) === '1';
  if (ticking) {
    const updated = londonTimestamp(timer.tu ?? timer.TU);
    if (updated !== null) {
      const elapsed = Math.floor((nowMs-updated)/1000);
      // Ignore stale or future update stamps instead of fabricating a clock.
      if (elapsed >= 0 && elapsed <= 70 * 60) extraSeconds = elapsed;
    }
  }
  const result = Math.floor((minute*60+(seconds??0)+extraSeconds)/60);
  return result >= 0 && result <= 200 ? result : null;
}


/**
 * A client may run its own short-lived clock ONLY when Bet365 confirms TT=1
 * and a plausible TU for the current playing period. TU can mark the start
 * of a half and can legitimately be over 45 minutes old. Never freeze at 120s.
 * A provider pause or absent TU means a frozen display.
 * This never converts fixture kickoff time to an invented playing minute.
 */
export function betsApiLiveClock(value: unknown, nowMs = Date.now()): {
  minute: number | null; clockSeconds: number | null; clockRunning: boolean;
} {
  const timer = object(value);
  const tm = number(timer.tm ?? timer.TM);
  const ts = number(timer.ts ?? timer.TS) ?? 0;
  if (tm === null || tm > 200 || ts > 59) {
    return { minute: null, clockSeconds: null, clockRunning: false };
  }
  const timestamp = londonTimestamp(timer.tu ?? timer.TU);
  const age = timestamp === null ? null : Math.floor((nowMs - timestamp) / 1000);
  const clockRunning = string(timer.tt ?? timer.TT) === '1' &&
    age !== null && age >= 0 && age <= 70 * 60;
  const clockSeconds = tm * 60 + ts + (clockRunning ? age! : 0);
  return {
    minute: Math.floor(clockSeconds / 60),
    clockSeconds, clockRunning,
  };
}
