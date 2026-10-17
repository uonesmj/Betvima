/**
 * BetsAPI trial diagnostics. Read-only, admin-only, and never a sportsbook
 * bookmaker/settlement source. No request or token is logged or serialized.
 * The client must stay on the first-party backend; never ship API keys in APKs.
 */
import { parseBet365LivePreview } from './betsapi-bet365-preview';

export const BETSAPI_TRIAL_SPORTS = [
  { id: 1, name: 'Football' },
  { id: 18, name: 'Basketball' },
  { id: 13, name: 'Tennis' },
  { id: 91, name: 'Volleyball' },
  { id: 17, name: 'Ice Hockey' },
  { id: 3, name: 'Cricket' },
  { id: 78, name: 'Handball' },
] as const;

interface ResultEnvelope {
  success?: number | string;
  results?: unknown;
  error?: unknown;
  error_code?: unknown;
}

export interface BetsApiTrialSport {
  sport: string;
  sportId: number;
  liveFixtures: number;
  liveWithClock: number;
  liveWithScore: number;
  upcomingFixtures: number;
  sample: Array<{ id: string; bet365Id: string | null; home: string; away: string; minute: number | null }>;
  error: string | null;
}

export interface BetsApiTrialResult {
  configured: boolean;
  feed: 'betsapi';
  mode: 'read_only';
  checkedAt: string;
  sports: BetsApiTrialSport[];
  oddsSample: Array<{ sport: string; eventId: string; marketKeys: number; latestOffers: number; error: string | null }>;
  bet365: { permitted: boolean; eventCount: number; sampleFixtureId: string | null;
    marketCount: number; priceCount: number; error: string | null };
  remainingHourlyRequests: number | null;
  callsInProbe: number;
  durationMs: number;
  notes: string[];
}

const ORIGIN = 'https://api.b365api.com';
type Fetcher = typeof fetch;
const safeError = (value: unknown): string => {
  const text = typeof value === 'string' ? value : '';
  return ['PERMISSION_DENIED', 'TOO_MANY_REQUESTS', 'AUTHORIZE_FAILED',
    'NOT_FOUND', 'UNDER_MAINTENANCE', 'PARAM_INVALID', 'PARAM_REQUIRED'].includes(text)
    ? text : 'UPSTREAM_UNAVAILABLE';
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const stringField = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const numericField = (value: unknown): number | null => {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) ? n : null;
};
const eventList = (results: unknown): Record<string, unknown>[] =>
  Array.isArray(results) ? results.filter(x => x && typeof x === 'object') as Record<string, unknown>[] : [];
const eventName = (event: Record<string, unknown>, side: string) =>
  stringField(record(event[side]).name).slice(0, 90);

export async function runBetsApiTrial(
  token: string,
  fetcher: Fetcher = fetch,
  sports: readonly { id: number; name: string }[] = BETSAPI_TRIAL_SPORTS,
): Promise<BetsApiTrialResult> {
  const beganAt = Date.now();
  const checkedAt = new Date().toISOString();
  let callsInProbe = 0;
  let remainingHourlyRequests: number | null = null;
  const call = async (path: string, params: Record<string, string>): Promise<ResultEnvelope> => {
    const url = new URL(path, ORIGIN);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('token', token);
    // Never log the URL. BetsAPI requires token= in the query string.
    callsInProbe++;
    const response = await fetcher(url.toString(), {
      method: 'GET', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(7000),
      headers: { Accept: 'application/json' },
    });
    const left = Number(response.headers.get('X-RateLimit-Remaining'));
    if (response.headers.has('X-RateLimit-Remaining') && Number.isFinite(left)) {
      remainingHourlyRequests = remainingHourlyRequests === null ? left : Math.min(left, remainingHourlyRequests);
    }
    if (response.status === 401 || response.status === 403) throw new Error('PERMISSION_DENIED');
    if (response.status === 429) throw new Error('TOO_MANY_REQUESTS');
    if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
    // Cap response sizes: a provider can return thousands of events.
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 3_000_000) throw new Error('RESPONSE_TOO_LARGE');
    const payload: unknown = await response.json();
    const envelope = record(payload) as ResultEnvelope;
    if (Number(envelope.success) !== 1) {
      throw new Error(safeError(envelope.error_code || envelope.error));
    }
    return envelope;
  };

  const output: BetsApiTrialResult = {
    configured: true, feed: 'betsapi', mode: 'read_only', checkedAt,
    sports: [], oddsSample: [],
    bet365: { permitted: false, eventCount: 0, sampleFixtureId: null,
      marketCount: 0, priceCount: 0, error: null },
    remainingHourlyRequests: null, callsInProbe: 0, durationMs: 0,
    notes: [
      'Nothing is written to the sportsbook database; all live betting and settlement remain on the existing source.',
      'Events API offers a limited number of main markets. Test Bet365 entitlement separately before full-market rollout.',
      'Do not treat historical or suspended odds as executable bookmaker offers.',
    ],
  };

  // Network calls across sports can otherwise exceed Vercel/Next worker
  // deadlines. All individual requests remain bounded to 7 seconds.
  const rows = await Promise.all(sports.slice(0, 7).map(async (sport) => {
    const row: BetsApiTrialSport = {
      sport: sport.name, sportId: sport.id, liveFixtures: 0,
      liveWithClock: 0, liveWithScore: 0,
      upcomingFixtures: 0, sample: [], error: null,
    };
    const [liveResult, upcomingResult] = await Promise.allSettled([
      call('/v3/events/inplay', { sport_id: String(sport.id) }),
      call('/v3/events/upcoming', { sport_id: String(sport.id), page: '1' }),
    ]);
    if (liveResult.status === 'fulfilled') {
      const live = eventList(liveResult.value.results);
      row.liveFixtures = live.length;
      row.liveWithClock = live.filter(event => numericField(record(event.timer).tm) !== null).length;
      row.liveWithScore = live.filter(event => /^\\d+-\\d+$/.test(stringField(event.ss))).length;
      row.sample = live.slice(0, 2).map(event => ({
        id: stringField(event.id).slice(0, 32),
        bet365Id: /^\\d{1,16}$/.test(stringField(event.bet365_id))
          ? stringField(event.bet365_id) : null,
        home: eventName(event, 'home'), away: eventName(event, 'away'),
        minute: numericField(record(event.timer).tm),
      }));
    } else row.error = safeError(liveResult.reason instanceof Error ? liveResult.reason.message : liveResult.reason);
    if (upcomingResult.status === 'fulfilled') {
      const data = upcomingResult.value;
      const total = numericField(record(data.pager).total);
      row.upcomingFixtures = total ?? eventList(data.results).length;
    } else row.error = row.error ?? safeError(upcomingResult.reason instanceof Error
      ? upcomingResult.reason.message : upcomingResult.reason);
    return row;
  }));
  output.sports.push(...rows);

  // Bounded sample, not 1 odds request per game across the entire league.
  for (const sport of output.sports) {
    if (output.oddsSample.length >= 5) break;
    for (const event of sport.sample.slice(0, 1)) {
      if (!/^\d{1,16}$/.test(event.id)) continue;
      const item = { sport: sport.sport, eventId: event.id, marketKeys: 0, latestOffers: 0, error: null as string | null };
      try {
        const data = await call('/v2/event/odds', { event_id: event.id });
        const odds = record(record(data.results).odds);
        item.marketKeys = Object.keys(odds).length;
        for (const entries of Object.values(odds)) {
          const latest = Array.isArray(entries) ? record(entries[0]) : {};
          if (['home_od', 'draw_od', 'away_od', 'over_od', 'under_od'].some(field => {
            const price = numericField(latest[field]);
            return price !== null && price > 1;
          })) item.latestOffers++;
        }
      } catch (error) {
        item.error = safeError(error instanceof Error ? error.message : error);
      }
      output.oddsSample.push(item);
    }
  }

  try {
    const data = await call('/v1/bet365/inplay_filter', { sport_id: '1' });
    output.bet365.permitted = true;
    const matches = eventList(data.results);
    output.bet365.eventCount = matches.length;
    // Events API includes a documented bet365_id. Prefer measuring the
    // exact same match in both feeds over an unrelated filtered event.
    const linkedId = output.sports.flatMap(sport => sport.sample)
      .map(event => event.bet365Id).find(id => id !== null);
    const first = linkedId ?? matches.map(match => stringField(match.id))
      .find(id => /^\d{1,16}$/.test(id));
    if (first) {
      output.bet365.sampleFixtureId = first;
      try {
        const rich = await call('/v1/bet365/event', { FI: first });
        const summary = parseBet365LivePreview(first, rich.results);
        output.bet365.marketCount = summary.marketCount;
        output.bet365.priceCount = summary.priceCount;
      } catch (error) {
        output.bet365.error = safeError(error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    output.bet365.error = safeError(error instanceof Error ? error.message : error);
  }
  output.remainingHourlyRequests = remainingHourlyRequests;
  output.callsInProbe = callsInProbe;
  output.durationMs = Date.now() - beganAt;
  return output;
}

// Bounded process-local coalescing: a browser refresh cannot start large
// parallel requests, and all returned content excludes credentials.
let pending: Promise<BetsApiTrialResult> | null = null;
let cache: { at: number; value: BetsApiTrialResult } | null = null;
export function inspectBetsApiTrial(): Promise<BetsApiTrialResult> {
  const token = process.env.BETSAPI_TRIAL_TOKEN?.trim();
  if (!token || process.env.BETSAPI_TRIAL_ENABLED !== 'true') {
    return Promise.resolve({
      configured: false, feed: 'betsapi', mode: 'read_only',
      checkedAt: new Date().toISOString(), sports: [], oddsSample: [],
      bet365: { permitted: false, eventCount: 0, sampleFixtureId: null,
        marketCount: 0, priceCount: 0, error: 'NOT_CONFIGURED' },
      remainingHourlyRequests: null, callsInProbe: 0, durationMs: 0,
      notes: ['Set BETSAPI_TRIAL_ENABLED=true and a freshly rotated BETSAPI_TRIAL_TOKEN on the server. Never commit a token.'],
    });
  }
  if (cache && Date.now() - cache.at < 120_000) return Promise.resolve(cache.value);
  if (pending) return pending;
  pending = runBetsApiTrial(token)
    .then(value => { cache = { at: Date.now(), value }; return value; })
    .finally(() => { pending = null; });
  return pending;
}
