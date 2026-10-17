/**
 * BetsAPI trial diagnostics. Read-only, admin-only, and never a sportsbook
 * bookmaker/settlement source. No request or token is logged or serialized.
 * The client must stay on the first-party backend; never ship API keys in APKs.
 */
import { parseBet365LivePreview } from './betsapi-bet365-preview';
import { normalizeBetsapiOdds } from './betsapi-normalization';

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
  pager?: unknown;
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
  sample: Array<{ id: string; bet365Id: string | null; home: string; away: string; minute: number | null; score: string | null; league: string }>;
  upcomingSample: Array<{ id: string; home: string; away: string; league: string; time: string | null }>;
  error: string | null;
}

export interface BetsApiTrialResult {
  configured: boolean;
  feed: 'betsapi';
  mode: 'read_only';
  checkedAt: string;
  sports: BetsApiTrialSport[];
  focusCountries: Array<{ code: string; live: number; upcoming: number }>;
  oddsSample: Array<{ sport: string; eventId: string; marketKeys: number; latestOffers: number; freshMarkets: number; freshSelections: number; error: string | null }>;
  bet365: { permitted: boolean; eventCount: number; sampleFixtureId: string | null;
    marketCount: number; priceCount: number; error: string | null;
    upcomingAccess: string; upcomingCount: number;
    pricedEventCount: number; sampledEventCount: number;
    samples: Array<{
      fixtureId: string; linkedEventId: string | null; match: string;
      markets: number; selections: number; error: string | null;
    }> };
  remainingHourlyRequests: number | null;
  callsInProbe: number;
  durationMs: number;
  notes: string[];
}

const ORIGIN = 'https://api.b365api.com';
type Fetcher = typeof fetch;
const safeError = (value: unknown): string => {
  // Only enum values are ever returned to admin clients. Provider errors can
  // contain URLs with credentials; never echo arbitrary strings.
  const text = typeof value === 'string' ? value : '';
  return ['PERMISSION_DENIED', 'TOO_MANY_REQUESTS', 'AUTHORIZE_FAILED',
    'NOT_FOUND', 'UNDER_MAINTENANCE', 'PARAM_INVALID', 'PARAM_REQUIRED',
    'INTERNAL_SERVER_ERROR', 'METHOD_NOT_ALLOWED', 'UPSTREAM_TIMEOUT',
    'UPSTREAM_NETWORK_ERROR', 'UPSTREAM_NON_JSON', 'UPSTREAM_HTTP_404',
    'UPSTREAM_HTTP_5XX', 'UPSTREAM_HTTP_4XX', 'UPSTREAM_ERROR',
    'UPSTREAM_RESPONSE_TOO_LARGE', 'NO_PRICED_MARKETS_IN_SAMPLES'].includes(text)
    ? text : 'UPSTREAM_ERROR';
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
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        method: 'GET', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(path.startsWith('/v1/bet365/') ? 11_000 : 7000),
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      throw new Error(error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR');
    }
    const left = Number(response.headers.get('X-RateLimit-Remaining'));
    if (response.headers.has('X-RateLimit-Remaining') && Number.isFinite(left)) {
      remainingHourlyRequests = remainingHourlyRequests === null ? left : Math.min(left, remainingHourlyRequests);
    }
    // JSON error responses often carry a more specific BetsAPI R-Error code.
    // Parse only bounded content and never include response text in errors.
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 3_000_000) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    let envelope: ResultEnvelope;
    try {
      envelope = record(await response.json()) as ResultEnvelope;
    } catch {
      if (response.status >= 500) throw new Error('UPSTREAM_HTTP_5XX');
      if (response.status === 404) throw new Error('UPSTREAM_HTTP_404');
      if (response.status === 401 || response.status === 403) throw new Error('PERMISSION_DENIED');
      if (response.status === 429) throw new Error('TOO_MANY_REQUESTS');
      if (!response.ok) throw new Error('UPSTREAM_HTTP_4XX');
      throw new Error('UPSTREAM_NON_JSON');
    }
    const upstreamCode = safeError(envelope.error_code || envelope.error);
    if (Number(envelope.success) !== 1) {
      if (upstreamCode !== 'UPSTREAM_ERROR') throw new Error(upstreamCode);
      if (response.status === 401 || response.status === 403) throw new Error('PERMISSION_DENIED');
      if (response.status === 429) throw new Error('TOO_MANY_REQUESTS');
      if (response.status >= 500) throw new Error('UPSTREAM_HTTP_5XX');
      throw new Error('UPSTREAM_ERROR');
    }
    if (!response.ok) throw new Error(response.status >= 500
      ? 'UPSTREAM_HTTP_5XX' : 'UPSTREAM_HTTP_4XX');
    return envelope;
  };

  const output: BetsApiTrialResult = {
    configured: true, feed: 'betsapi', mode: 'read_only', checkedAt,
    sports: [], focusCountries: ['ir', 'tr', 'af', 'ge', 'az'].map(code => ({ code, live: 0, upcoming: 0 })), oddsSample: [],
    bet365: { permitted: false, eventCount: 0, sampleFixtureId: null,
      marketCount: 0, priceCount: 0, error: null,
      upcomingAccess: 'NOT_TESTED', upcomingCount: 0, pricedEventCount: 0, sampledEventCount: 0, samples: [] },
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
      upcomingFixtures: 0, sample: [], upcomingSample: [], error: null,
    };
    const [liveResult, upcomingResult] = await Promise.allSettled([
      call('/v3/events/inplay', { sport_id: String(sport.id) }),
      call('/v3/events/upcoming', { sport_id: String(sport.id), page: '1' }),
    ]);
    if (liveResult.status === 'fulfilled') {
      const live = eventList(liveResult.value.results);
      row.liveFixtures = live.length;
      for (const event of live) {
        const cc = stringField(record(event.league).cc).toLowerCase();
        const region = output.focusCountries.find(x => x.code === cc);
        if (region) region.live++;
      }
      row.liveWithClock = live.filter(event => numericField(record(event.timer).tm) !== null).length;
      row.liveWithScore = live.filter(event => /^\d+-\d+$/.test(stringField(event.ss))).length;
      row.sample = live.slice(0, 20).map(event => ({
        id: stringField(event.id).slice(0, 32),
        bet365Id: /^\d{1,16}$/.test(stringField(event.bet365_id))
          ? stringField(event.bet365_id) : null,
        home: eventName(event, 'home'), away: eventName(event, 'away'),
        minute: numericField(record(event.timer).tm),
        score: /^\d+-\d+$/.test(stringField(event.ss)) ? stringField(event.ss) : null,
        league: stringField(record(event.league).name).slice(0, 90),
      }));
    } else row.error = safeError(liveResult.reason instanceof Error ? liveResult.reason.message : liveResult.reason);
    if (upcomingResult.status === 'fulfilled') {
      const data = upcomingResult.value;
      const total = numericField(record(data.pager).total);
      row.upcomingFixtures = total ?? eventList(data.results).length;
      for (const event of eventList(data.results)) {
        const cc = stringField(record(event.league).cc).toLowerCase();
        const region = output.focusCountries.find(x => x.code === cc);
        if (region) region.upcoming++;
      }
      row.upcomingSample = eventList(data.results).slice(0, 20).map(event => ({
        id: stringField(event.id).slice(0, 32),
        home: eventName(event, 'home'), away: eventName(event, 'away'),
        league: stringField(record(event.league).name).slice(0, 90),
        time: Number.isFinite(Number(event.time)) && Number(event.time) > 1_500_000_000
          ? new Date(Number(event.time) * 1000).toISOString() : null,
      }));
    } else row.error = row.error ?? safeError(upcomingResult.reason instanceof Error
      ? upcomingResult.reason.message : upcomingResult.reason);
    return row;
  }));
  output.sports.push(...rows);

  // Bound to five real live events, price probes run concurrently to meet
  // the short 3-day trial window without 5 * 7s request waterfalls.
  // First-event sampling falsely reports a whole sport as unavailable if
  // one isolated fixture has no prices. Include 3 football fixtures, then
  // sample other sports, respecting a total budget of six odds calls.
  const samples = [
    ...output.sports.filter(s => s.sportId === 1).flatMap(sport =>
      sport.sample.slice(0, 3).map(event => ({ sport, event }))),
    ...output.sports.filter(s => s.sportId !== 1).flatMap(sport =>
      sport.sample.slice(0, 1).map(event => ({ sport, event }))),
  ].filter(({ event }) => /^\d{1,16}$/.test(event.id)).slice(0, 6);
  output.oddsSample = await Promise.all(samples.map(async ({ sport, event }) => {
    const item = {
      sport: sport.sport, eventId: event.id, marketKeys: 0, latestOffers: 0,
      freshMarkets: 0, freshSelections: 0, error: null as string | null,
    };
    try {
      const data = await call('/v2/event/odds', { event_id: event.id });
      const odds = record(record(data.results).odds);
      item.marketKeys = Object.keys(odds).length;
      const fresh = normalizeBetsapiOdds(`${sport.sportId}:${event.id}`,
        data.results, new Date(), true);
      item.freshMarkets = fresh.markets.length;
      item.freshSelections = fresh.markets.reduce((sum, market) => sum + market.selections.length, 0);
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
    return item;
  }));

  // Check Bet365 in-play and prematch entitlements concurrently. A single
  // timeout on /upcoming must not be conflated with live market availability.
  const [upcomingCheck, liveCheck] = await Promise.allSettled([
    call('/v1/bet365/upcoming', { sport_id: '1', page: '1' }),
    call('/v1/bet365/inplay_filter', { sport_id: '1' }),
  ]);
  if (upcomingCheck.status === 'fulfilled') {
    output.bet365.upcomingAccess = 'AVAILABLE';
    output.bet365.upcomingCount = eventList(upcomingCheck.value.results).length;
  } else {
    output.bet365.upcomingAccess = safeError(
      upcomingCheck.reason instanceof Error ? upcomingCheck.reason.message : upcomingCheck.reason,
    );
  }

  if (liveCheck.status === 'fulfilled') {
    output.bet365.permitted = true;
    const matches = eventList(liveCheck.value.results)
      .filter(match => /^\\d{1,16}$/.test(stringField(match.id)));
    output.bet365.eventCount = matches.length;
    // FI=id in /bet365/inplay_filter. our_event_id links to the Events API.
    // Never substitute an unrelated Events API event ID for the Bet365 FI.
    const eventsIds = new Set(output.sports.filter(s => s.sportId === 1)
      .flatMap(sport => sport.sample.map(event => event.id)));
    const sorted = [
      ...matches.filter(match => eventsIds.has(stringField(match.our_event_id))),
      ...matches.filter(match => !eventsIds.has(stringField(match.our_event_id))),
    ];
    const distinctLeagues = new Set<string>();
    const selected: Record<string, unknown>[] = [];
    const used = new Set<string>();
    for (const match of sorted) {
      const fixtureId = stringField(match.id);
      const league = stringField(record(match.league).id);
      if (used.has(fixtureId) || (league && distinctLeagues.has(league))) continue;
      used.add(fixtureId);
      if (league) distinctLeagues.add(league);
      selected.push(match);
      if (selected.length === 4) break;
    }
    // If there were fewer than four leagues, use other distinct fixtures.
    for (const match of sorted) {
      if (selected.length >= 4) break;
      const fixtureId = stringField(match.id);
      if (used.has(fixtureId)) continue;
      used.add(fixtureId);
      selected.push(match);
    }
    output.bet365.sampledEventCount = selected.length;
    output.bet365.sampleFixtureId = selected[0] ? stringField(selected[0].id) : null;
    output.bet365.samples = await Promise.all(selected.map(async match => {
      const fixtureId = stringField(match.id);
      const sample = {
        fixtureId,
        linkedEventId: /^\\d{1,16}$/.test(stringField(match.our_event_id))
          ? stringField(match.our_event_id) : null,
        match: `${eventName(match, 'home')} — ${eventName(match, 'away')}`.slice(0, 185),
        markets: 0, selections: 0, error: null as string | null,
      };
      try {
        const rich = await call('/v1/bet365/event', { FI: fixtureId });
        const summary = parseBet365LivePreview(fixtureId, rich.results);
        sample.markets = summary.marketCount;
        sample.selections = summary.priceCount;
      } catch (error) {
        sample.error = safeError(error instanceof Error ? error.message : error);
      }
      return sample;
    }));
    output.bet365.marketCount = output.bet365.samples.reduce((sum, s) => sum + s.markets, 0);
    output.bet365.priceCount = output.bet365.samples.reduce((sum, s) => sum + s.selections, 0);
    output.bet365.pricedEventCount = output.bet365.samples.filter(s => s.markets > 0).length;
    if (output.bet365.samples.length && output.bet365.pricedEventCount === 0) {
      output.bet365.error = output.bet365.samples.find(s => s.error)?.error ?? 'NO_PRICED_MARKETS_IN_SAMPLES';
    }
  } else {
    output.bet365.error = safeError(
      liveCheck.reason instanceof Error ? liveCheck.reason.message : liveCheck.reason,
    );
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
      checkedAt: new Date().toISOString(), sports: [],
      focusCountries: [], oddsSample: [],
      bet365: { permitted: false, eventCount: 0, sampleFixtureId: null,
        marketCount: 0, priceCount: 0, error: 'NOT_CONFIGURED',
        upcomingAccess: 'NOT_TESTED', upcomingCount: 0, pricedEventCount: 0, sampledEventCount: 0, samples: [] },
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
