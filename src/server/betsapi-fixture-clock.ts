/**
 * Quota-aware supplement for real Bet365 football minutes in Home + Live cards.
 * InPlay Filter often supplies the result but not the clock. Events inplay is
 * preferred; only a bounded number of unlinked clocks reach /bet365/event.
 *
 * Never infer a football minute from kickoff, odds, or the current wall clock
 * without an authoritative Bet365 TM/TS/TT/TU clock and update timestamp.
 */
import { request } from '@/providers/betsapi-explorer';
import { betsApiLiveClock } from '@/providers/betsapi-match-clock';
import { object, string } from '@/providers/betsapi-normalization';

type RawClock = Record<string, unknown> | null;
type Read = (fi: string) => Promise<RawClock>;
const MAX_PER_HOUR = 230;
const MAX_IN_FLIGHT = 4;
const MAX_PER_LIST = 4;
const GOOD_TTL = 9 * 60_000;
const BAD_TTL = 2 * 60_000;

type Entry = { expires: number; clock: RawClock; pending?: Promise<RawClock> };
const cache = new Map<string, Entry>();
let busy = 0;
let hour = -1;
let count = 0;

function getClock(payload: unknown, depth = 0): RawClock {
  if (depth > 7) return null;
  if (Array.isArray(payload)) {
    for (const row of payload) {
      const clock = getClock(row, depth + 1);
      if (clock) return clock;
    }
    return null;
  }
  const row = object(payload);
  if (string(row.type) === 'EV' && row.TM != null) {
    return { TM: row.TM, TS: row.TS, TT: row.TT, TU: row.TU };
  }
  if (Object.keys(object(row.timer)).length && object(row.timer).tm != null) return row;
  return row.results ? getClock(row.results, depth + 1) : null;
}

const providerRead: Read = async fi => {
  const token = process.env.BETSAPI_PUBLIC_PREVIEW_ENABLED === 'true' &&
    process.env.BETSAPI_TRIAL_ENABLED === 'true'
    ? process.env.BETSAPI_TRIAL_TOKEN?.trim() : null;
  if (!token) return null;
  // Shared hashed URL cache and global quota guards are in request().
  const response = await request(token, '/v1/bet365/event', { FI: fi },
    fetch, GOOD_TTL);
  return getClock(response.results);
};

/** Supply only clocks confirmed by the provider, not synthetic timers. */
export async function supplementBet365LiveMinutes<T extends { fi: string | null; minute: number | null;
  clockSeconds?: number | null; clockRunning?: boolean; clockObservedAt?: string | null }>(
  fixtures: T[], reader: Read = providerRead,
  now = Date.now(),
): Promise<T[]> {
  const candidates = fixtures.filter(f => f.minute === null && f.fi &&
    /^\d{1,16}$/.test(f.fi));
  if (!candidates.length) return fixtures;
  if (hour !== Math.floor(now / 3_600_000)) {
    hour = Math.floor(now / 3_600_000);
    count = 0;
  }
  const starts: Promise<RawClock>[] = [];
  let initiated = 0;
  for (const fixture of candidates) {
    const fi = fixture.fi!;
    const current = cache.get(fi);
    if (current && (current.pending || current.expires > now)) continue;
    if (initiated >= MAX_PER_LIST || busy >= MAX_IN_FLIGHT ||
        count >= MAX_PER_HOUR) break;
    count++;
    busy++;
    initiated++;
    const pending = Promise.resolve().then(() => reader(fi)).catch(() => null)
      .then(clock => {
        const value: Entry = {
          expires: Date.now() + (clock ? GOOD_TTL : BAD_TTL),
          clock,
        };
        cache.set(fi, value);
        return clock;
      }).finally(() => { busy--; });
    cache.set(fi, { expires: now + BAD_TTL, clock: null, pending });
    starts.push(pending);
  }
  if (starts.length) await Promise.all(starts);
  // Keep bounded process memory; the next request handles the next missing set.
  if (cache.size > 600) {
    for (const [key, entry] of cache) {
      if (!entry.pending && entry.expires < Date.now()) cache.delete(key);
    }
    while (cache.size > 600) cache.delete(cache.keys().next().value!);
  }
  return fixtures.map(fixture => {
    if (fixture.minute !== null || !fixture.fi) return fixture;
    const saved = cache.get(fixture.fi);
    if (!saved || saved.pending || !saved.clock || saved.expires < Date.now()) return fixture;
    const clock = betsApiLiveClock(saved.clock);
    return clock.minute === null ? fixture : { ...fixture, minute: clock.minute,
      clockSeconds: clock.clockSeconds, clockRunning: clock.clockRunning,
      clockObservedAt: new Date().toISOString() };
  });
}
