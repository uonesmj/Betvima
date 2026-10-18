/** Server-only BetsAPI Events adapter. Keep disconnected from wagering until settlement
 * and Bet365 full-market integration have passed explicit validation. */
import type { ProviderMatch, ProviderOddsBundle, ProviderResult, ProviderResultSnapshot, ProviderStatus, SportsDataProvider } from '@/lib/ports/providers';
import { BETSAPI_SPORTS, normalizeBetsapiEvent, normalizeBetsapiOdds, normalizeBetsapiResult, parseBetsapiIdentity, object } from './betsapi-normalization';
import { parseBet365Catalogue, type Bet365Catalogue } from './betsapi-bet365-catalogue';

const BASE = 'https://api.b365api.com';
type Envelope = { success?: number | string; results?: unknown; pager?: unknown };
const sports = new Map<string, number>(BETSAPI_SPORTS.map(s => [s.slug, s.id]));
const fail = <T>(code: string): ProviderResult<T> => ({ ok: false, value: null, errorCode: code, retryable: code === 'UPSTREAM_TIMEOUT' || code === 'UPSTREAM_NETWORK' || code === 'UPSTREAM_RATE_LIMIT' });
const ok = <T>(value: T): ProviderResult<T> => ({ ok: true, value });
const ids = (xs: unknown): Record<string, unknown>[] => Array.isArray(xs) ? xs.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)) : [];
const validToken = (token: string) => /^[A-Za-z0-9_-]{12,180}$/.test(token);

/** Limit in-flight upstream requests; preserve input order and fail closed on errors. */
async function mapBetsApiBounded<T, R>(items: readonly T[], mapper: (item: T) => Promise<R>, limit = 3): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index]!);
    }
  }));
  return result;
}

export class BetsApiEventsProvider implements SportsDataProvider {
  readonly name = 'betsapi';
  readonly configured: boolean;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  constructor(token = process.env.BETSAPI_TRIAL_TOKEN || '', fetcher: typeof fetch = fetch) {
    this.token = token;
    this.configured = validToken(token);
    this.fetcher = fetcher;
  }
  private async request(endpoint: string, params: Record<string, string>): Promise<unknown> {
    if (!this.configured) throw Error('NOT_CONFIGURED');
    const allowed = new Set(['/v3/events/inplay','/v3/events/upcoming','/v3/events/view','/v3/events/ended','/v2/event/odds','/v1/bet365/event','/v4/bet365/prematch']);
    if (!allowed.has(endpoint)) throw Error('INVALID_ENDPOINT');
    const url = new URL(endpoint, BASE);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('token', this.token);
    let response: Response;
    try { response = await this.fetcher(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(endpoint === '/v3/events/inplay' || endpoint === '/v3/events/upcoming' ? 25000 : 12000) }); }
    catch (e) { throw Error(e instanceof Error && /abort|timeout/i.test(e.name) ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK'); }
    if (response.status === 429) throw Error('UPSTREAM_RATE_LIMIT');
    if (response.status === 401 || response.status === 403) throw Error('UPSTREAM_DENIED');
    if (!response.ok) throw Error('UPSTREAM_HTTP');
    if (Number(response.headers.get('content-length') || 0) > 5_000_000) throw Error('UPSTREAM_TOO_LARGE');
    let data: Envelope;
    try {
      const body = await response.text();
      if (body.length > 5_000_000) throw Error('oversized');
      data = JSON.parse(body) as Envelope;
    } catch { throw Error('UPSTREAM_INVALID_RESPONSE'); }
    if (Number(data.success) !== 1) throw Error('UPSTREAM_REJECTED');
    return data.results;
  }
  private async guarded<T>(fn: () => Promise<T>): Promise<ProviderResult<T>> {
    try { return ok(await fn()); }
    catch (e) { const code = e instanceof Error ? e.message : 'UPSTREAM_UNKNOWN'; return fail<T>(/^[A-Z_]{3,60}$/.test(code) ? code : 'UPSTREAM_UNKNOWN'); }
  }
  async health(): Promise<ProviderStatus> {
    return { provider: this.name, category: 'sports', configured: this.configured,
      enabled: this.configured, reachable: null, lastError: null, lastSuccessAt: null,
      requiredEnv: ['BETSAPI_TRIAL_TOKEN'], notes: 'Events API basic markets only; not yet authoritative for wagering' };
  }
  async fetchLiveMatches(sport?: string): Promise<ProviderResult<ProviderMatch[]>> {
    if (sport && !sports.has(sport)) return ok([]);
    return this.guarded(async () => {
      const chosen = sport ? [sports.get(sport)!] : [...sports.values()];
      const pages = await mapBetsApiBounded(chosen, id => this.request('/v3/events/inplay', { sport_id: String(id) }));
      return pages.flatMap((page, i) => ids(page).map(event => normalizeBetsapiEvent({ ...event, sport_id: chosen[i] })).filter((m): m is ProviderMatch => m !== null));
    });
  }
  async fetchMatches(window: { from: string; to: string; sport?: string }): Promise<ProviderResult<ProviderMatch[]>> {
    if (window.sport && !sports.has(window.sport)) return ok([]);
    const start = new Date(window.from).getTime(), end = new Date(window.to).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 7 * 86400000) return fail('INVALID_WINDOW');
    return this.guarded(async () => {
      const selected = window.sport ? [sports.get(window.sport)!] : [...sports.values()];
      const days: string[] = [];
      for (let ms = Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), new Date(start).getUTCDate()); ms <= end; ms += 86400000) days.push(new Date(ms).toISOString().slice(0,10).replace(/-/g,''));
      const requests = selected.flatMap(sportId => days.map(day => ({sportId, day})));
      if (requests.length > 35) throw Error('REQUEST_BUDGET');
      const results = await mapBetsApiBounded(requests, x => this.request('/v3/events/upcoming', {sport_id: String(x.sportId), day: x.day, page: '1'}));
      const matches = results.flatMap((page, i) => ids(page).map(event => normalizeBetsapiEvent({...event, sport_id: requests[i]!.sportId})).filter((m): m is ProviderMatch => m !== null));
      return [...new Map(matches.filter(x => {const time = new Date(x.scheduledAt).getTime(); return time >= start && time <= end;}).map(x => [x.providerId,x])).values()];
    });
  }
  private async quote(matchProviderIds: string[], live: boolean): Promise<ProviderResult<ProviderOddsBundle[]>> {
    if (matchProviderIds.length > 15) return fail('REQUEST_BUDGET');
    return this.guarded(async () => mapBetsApiBounded(matchProviderIds, async id => {
      const parsed = parseBetsapiIdentity(id);
      if (!parsed) throw Error('INVALID_EVENT_ID');
      const raw = await this.request('/v2/event/odds', {event_id: parsed.eventId});
      return normalizeBetsapiOdds(id, raw, new Date(), live, live ? 12 : 45);
    })));
  }
  async fetchOdds(ids: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> { return this.quote(ids, true); }
  async fetchEventOdds(ids: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> { return this.quote(ids, false); }
  /** Full bookmaker catalogue is available for display only; it cannot enter
   * real-money selection tables until mapping and grading are proven. */
  async fetchBet365Catalogue(fi: string, mode: 'live' | 'upcoming'): Promise<ProviderResult<Bet365Catalogue>> {
    if (!/^[0-9]{1,16}$/.test(fi)) return fail('INVALID_BET365_FI');
    return this.guarded(async () => {
      const path = mode === 'live' ? '/v1/bet365/event' : '/v4/bet365/prematch';
      const data = await this.request(path, { FI: fi });
      return parseBet365Catalogue(fi, mode, data);
    });
  }
  async fetchResult(id: string): Promise<ProviderResult<ProviderResultSnapshot>> {
    const parsed = parseBetsapiIdentity(id);
    if (!parsed) return fail('INVALID_EVENT_ID');
    return this.guarded(async () => {
      const result = await this.request('/v3/events/view', {event_id: parsed.eventId});
      const raw = Array.isArray(result) ? result[0] : result;
      const snapshot = normalizeBetsapiResult(id, {...object(raw), sport_id: parsed.sportId}, new Date(), false);
      if (!snapshot) throw Error('RESULT_NOT_AVAILABLE');
      return snapshot;
    });
  }
  async fetchResults(from: string, to: string, eventIds?: string[]): Promise<ProviderResult<ProviderResultSnapshot[]>> {
    if (!eventIds?.length) return fail('EVENT_IDS_REQUIRED');
    if (eventIds.length > 15) return fail('REQUEST_BUDGET');
    return this.guarded(async () => {
      const results = await Promise.all(eventIds.map(async id => {
        const parsed = parseBetsapiIdentity(id);
        if (!parsed) throw Error('INVALID_EVENT_ID');
        const response = await this.request('/v3/events/view', {event_id: parsed.eventId});
        const raw = Array.isArray(response) ? response[0] : response;
        return normalizeBetsapiResult(id, {...object(raw), sport_id: parsed.sportId}, new Date(), false);
      }));
      void from; void to;
      return results.filter((r): r is ProviderResultSnapshot => r !== null);
    });
  }
}
