/**
 * Site-side Bet365 match and market explorer.
 *
 * This is a deliberately READ-ONLY transitional catalogue. BetsAPI market IDs
 * never enter existing The Odds API selection IDs, the wager ledger, or
 * settlement. The public GET endpoint works only with a private server token.
 * Admin POST may submit a freshly rotated one-time token over HTTPS.
 */
import { createHash } from 'node:crypto';
import { object, string } from './betsapi-normalization';
import {
  parseBet365LivePreview, parseBet365PrematchPreview,
  type Bet365PreviewMarket,
} from './betsapi-bet365-preview';

/** Official BetsAPI sport IDs (some sports may have no Bet365 offers). */
export const BETSAPI_EXPLORER_SPORTS = [
  { id: 1, name: 'Football' }, { id: 18, name: 'Basketball' },
  { id: 13, name: 'Tennis' }, { id: 91, name: 'Volleyball' },
  { id: 17, name: 'Ice Hockey' }, { id: 3, name: 'Cricket' },
  { id: 78, name: 'Handball' }, { id: 16, name: 'Baseball' },
  { id: 12, name: 'American Football' }, { id: 92, name: 'Table Tennis' },
  { id: 15, name: 'Darts' }, { id: 14, name: 'Snooker' },
  { id: 83, name: 'Futsal' }, { id: 94, name: 'Badminton' },
  { id: 8, name: 'Rugby Union' }, { id: 19, name: 'Rugby League' },
  { id: 36, name: 'Australian Rules' }, { id: 90, name: 'Floorball' },
  { id: 95, name: 'Beach Volleyball' }, { id: 110, name: 'Water Polo' },
  { id: 107, name: 'Squash' }, { id: 151, name: 'E-sports' },
  { id: 162, name: 'MMA / UFC' }, { id: 9, name: 'Boxing' },
  { id: 2, name: 'Horse Racing' }, { id: 4, name: 'Greyhounds' },
  { id: 66, name: 'Bowls' }, { id: 75, name: 'Gaelic Sports' },
] as const;

export interface ExplorerFixture {
  fi: string;
  eventId: string | null;
  sportId: number;
  league: string;
  country: string | null;
  home: string;
  away: string;
  kickoff: string | null;
  score: string | null;
  minute: number | null;
  marketStatus: 'not_requested';
}

export interface ExplorerList {
  source: 'betsapi_bet365';
  readOnly: true;
  configured: boolean;
  mode: 'live' | 'upcoming';
  sportId: number;
  page: number;
  pageCount: number | null;
  total: number | null;
  refreshedAt: string;
  fixtures: ExplorerFixture[];
  error: string | null;
}

export interface ExplorerMarkets {
  source: 'betsapi_bet365';
  readOnly: true;
  configured: boolean;
  mode: 'live' | 'upcoming';
  fi: string;
  refreshedAt: string;
  marketCount: number;
  selectionCount: number;
  markets: Bet365PreviewMarket[];
  error: string | null;
}

// Do not leak raw provider errors. They sometimes contain complete URLs with
// query-string tokens.
export type ExplorerError =
  | 'NOT_CONFIGURED' | 'UPSTREAM_DENIED' | 'UPSTREAM_QUOTA'
  | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNAVAILABLE' | 'UPSTREAM_INVALID';
const rec = object;
const val = string;
const number = (x: unknown): number | null => {
  const n = Number(x);
  return x !== null && x !== undefined && x !== '' && Number.isFinite(n) ? n : null;
};
const sourceEvent = (r: Record<string, unknown>, side: 'home' | 'away') =>
  val(rec(r[side]).name).slice(0, 140);
const safeIso = (seconds: unknown): string | null => {
  const value = number(seconds);
  return value !== null && value >= 1500000000 && value <= 4102444800
    ? new Date(value * 1000).toISOString() : null;
};
export function parseExplorerFixture(raw: unknown, sportId: number): ExplorerFixture | null {
  const row = rec(raw);
  const fi = val(row.id);
  if (!/^\d{1,16}$/.test(fi)) return null;
  const home = sourceEvent(row, 'home'), away = sourceEvent(row, 'away');
  if (!home || !away) return null;
  const minute = number(rec(row.timer).tm);
  const ss = val(row.ss);
  const country = val(rec(row.league).cc).toLowerCase();
  const eventId = val(row.our_event_id);
  return {
    fi, eventId: /^\d{1,16}$/.test(eventId) ? eventId : null, sportId,
    home, away, league: val(rec(row.league).name).slice(0, 140) || 'Other competitions',
    country: /^[a-z]{2}$/.test(country) ? country : null,
    kickoff: safeIso(row.time),
    score: /^\d{1,3}-\d{1,3}$/.test(ss) ? ss : null,
    minute: minute !== null && minute >= 0 && minute <= 200 ? minute : null,
    marketStatus: 'not_requested',
  };
}

const ORIGIN = 'https://api.b365api.com';
type Fetcher = typeof fetch;
interface ProviderEnvelope { results?: unknown; pager?: unknown; success?: unknown; error_code?: unknown }
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();
const CACHE_LIMIT = 700;
// Trial budget is 1800/h; reserve capacity for admin diagnostics and other
// backend work. Shared on this server process and applied only on cache misses.
let quotaHour = -1;
let quotaRequests = 0;
function budgeted(): void {
  const hour = Math.floor(Date.now() / 3_600_000);
  if (hour !== quotaHour) { quotaHour = hour; quotaRequests = 0; }
  const raw = Number(process.env.BETSAPI_EXPLORER_REQUESTS_PER_HOUR ?? '1000');
  const limit = Number.isSafeInteger(raw) ? Math.max(20, Math.min(1500, raw)) : 1000;
  if (quotaRequests >= limit) throw new ExplorerUpstreamError('UPSTREAM_QUOTA');
  quotaRequests++;
}
export class ExplorerUpstreamError extends Error {
  constructor(readonly code: ExplorerError) { super(code); }
}
async function request(
  token: string, endpoint: string, params: Record<string, string>, fetcher: Fetcher = fetch,
  cacheMs = 12_000,
): Promise<ProviderEnvelope> {
  const allowed = [
    '/v1/bet365/inplay_filter',
    '/v1/bet365/upcoming',
    '/v1/bet365/event',
    '/v4/bet365/prematch',
  ];
  if (!allowed.includes(endpoint)) throw new ExplorerUpstreamError('UPSTREAM_INVALID');
  const url = new URL(endpoint, ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('token', token);
  const key = createHash('sha256').update(url.toString()).digest('hex');
  const now = Date.now();
  const previous = cache.get(key);
  if (previous && now - previous.at < cacheMs) return previous.promise as Promise<ProviderEnvelope>;
  if (cache.size >= CACHE_LIMIT) {
    for (const [entry, value] of cache) if (now - value.at > 60_000) cache.delete(entry);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  }
  const promise = (async () => {
    budgeted();
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        method: 'GET', headers: { Accept: 'application/json' },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new ExplorerUpstreamError(error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE');
    }
    if (response.status === 429) throw new ExplorerUpstreamError('UPSTREAM_QUOTA');
    if (response.status === 401 || response.status === 403) throw new ExplorerUpstreamError('UPSTREAM_DENIED');
    if (!response.ok) throw new ExplorerUpstreamError('UPSTREAM_UNAVAILABLE');
    if (Number(response.headers.get('content-length') || '0') > 9_000_000)
      throw new ExplorerUpstreamError('UPSTREAM_INVALID');
    let raw: unknown;
    try {
      const body = await response.text();
      if (body.length > 9_000_000) throw new Error('oversized');
      raw = JSON.parse(body) as unknown;
    } catch { throw new ExplorerUpstreamError('UPSTREAM_INVALID'); }
    const envelope = rec(raw) as ProviderEnvelope;
    if (Number(envelope.success) !== 1) {
      const upstream = val(envelope.error_code);
      if (/PERMISSION|AUTHORIZE|INVALID_TOKEN/.test(upstream)) throw new ExplorerUpstreamError('UPSTREAM_DENIED');
      if (/LIMIT|TOO_MANY_REQUESTS/.test(upstream)) throw new ExplorerUpstreamError('UPSTREAM_QUOTA');
      throw new ExplorerUpstreamError('UPSTREAM_UNAVAILABLE');
    }
    return envelope;
  })();
  cache.set(key, { at: now, promise });
  try { return await promise; }
  catch (error) { cache.delete(key); throw error; }
}

export interface ExplorerInput {
  mode: 'live' | 'upcoming';
  sportId: number;
  page?: number;
  day?: string;
  fi?: string;
}
const validSport = (sportId: number) => BETSAPI_EXPLORER_SPORTS.some(s => s.id === sportId);
const safeError = (error: unknown): ExplorerError =>
  error instanceof ExplorerUpstreamError ? error.code : 'UPSTREAM_UNAVAILABLE';
export async function exploreBetsApi(
  token: string | null | undefined,
  input: ExplorerInput,
  fetcher: Fetcher = fetch,
): Promise<ExplorerList | ExplorerMarkets> {
  const refreshedAt = new Date().toISOString();
  const configured = Boolean(token?.trim());
  const base = { source: 'betsapi_bet365' as const, readOnly: true as const, configured, refreshedAt };
  const fi = input.fi;
  if (!validSport(input.sportId) || (fi !== undefined && !/^\d{1,16}$/.test(fi)) ||
    (input.day && !/^\d{8}$/.test(input.day))) {
    throw new ExplorerUpstreamError('UPSTREAM_INVALID');
  }
  if (fi) {
    const out = { ...base, mode: input.mode, fi, marketCount: 0, selectionCount: 0,
      markets: [] as Bet365PreviewMarket[], error: null as ExplorerError | null };
    if (!configured) return { ...out, error: 'NOT_CONFIGURED' };
    try {
      const payload = await request(token!, input.mode === 'live' ? '/v1/bet365/event' : '/v4/bet365/prematch',
        { FI: fi }, fetcher, input.mode === 'live' ? 12_000 : 60_000);
      const result = input.mode === 'live'
        ? parseBet365LivePreview(fi, payload.results)
        : parseBet365PrematchPreview(fi, payload.results);
      return { ...out, markets: result.markets, marketCount: result.marketCount,
        selectionCount: result.priceCount };
    } catch (error) { return { ...out, error: safeError(error) }; }
  }
  const page = input.mode === 'live' ? 1 : Math.max(1, Math.min(100, input.page ?? 1));
  const empty: ExplorerList = { ...base, mode: input.mode, sportId: input.sportId, page,
    pageCount: null, total: null, fixtures: [], error: null };
  if (!configured) return { ...empty, error: 'NOT_CONFIGURED' };
  try {
    const payload = await request(token!, input.mode === 'live' ? '/v1/bet365/inplay_filter' : '/v1/bet365/upcoming',
      input.mode === 'live' ? { sport_id: String(input.sportId) } :
        { sport_id: String(input.sportId), page: String(page),
          ...(input.day ? { day: input.day } : {}) },
      fetcher, input.mode === 'live' ? 12_000 : 90_000);
    const data = Array.isArray(payload.results) ? payload.results : [];
    const fixtures = data.slice(0, 2200).map(row => parseExplorerFixture(row, input.sportId))
      .filter((row): row is ExplorerFixture => row !== null);
    const pager = rec(payload.pager);
    const total = number(pager.total);
    const perPage = number(pager.per_page);
    return { ...empty, fixtures, total: total ?? (input.mode === 'live' ? fixtures.length : null),
      pageCount: input.mode === 'upcoming' && total !== null && perPage !== null && perPage > 0
        ? Math.ceil(total / perPage) : null };
  } catch (error) { return { ...empty, error: safeError(error) }; }
}
