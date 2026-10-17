/**
 * BetsAPI Events API adapter. Full source contract, but deliberately excluded
 * from the real-money provider registry until operator-verified cutover.
 *
 * Quota-bound, strict-source, no automatic bookmaker fallback, no secrets in
 * logs/errors. Bet365 FI identifiers are NOT Events API IDs.
 */
import type {
  ProviderMatch, ProviderOddsBundle, ProviderResult, ProviderResultSnapshot,
  ProviderStatus, SportsDataProvider,
} from '@/lib/ports/providers';
import {
  BETSAPI_SPORTS, normalizeBetsapiEvent, normalizeBetsapiOdds,
  normalizeBetsapiResult, object, parseBetsapiIdentity, string,
} from './betsapi-normalization';

const BASE = 'https://api.b365api.com';
const SPARE_BASE = 'https://api.betsapi.com';
const MAX_PER_CALL = 12;
const MAX_DISCOVERY_PAGES = 3;
const DEFAULT_HOURLY_BUDGET = 1500;
const supportedId = (id: string) => /^\d{1,16}$/.test(id);
type Json = Record<string, unknown>;
const failed = <T>(code: string, retryable = false): ProviderResult<T> => ({
  ok: false, value: null, errorCode: code, errorMessage: code, retryable,
});
const ok = <T>(value: T): ProviderResult<T> => ({ ok: true, value });
const errorCode = (err: unknown): string => {
  const message = err instanceof Error ? err.message : '';
  return ['NOT_CONFIGURED', 'BETSAPI_RATE_LIMITED', 'BETSAPI_PERMISSION_DENIED',
    'BETSAPI_UNAVAILABLE', 'BETSAPI_SCHEMA_INVALID', 'BETSAPI_BUDGET_EXHAUSTED',
    'BETSAPI_REQUEST_TIMEOUT'].includes(message) ? message : 'BETSAPI_UNAVAILABLE';
};
const events = (payload: unknown): unknown[] =>
  Array.isArray(payload) ? payload.slice(0, 1500) : [];

// All instances in a process share the same budget. In addition to upstream
// limits this avoids a 3-day trial burning requests from concurrent jobs.
let hourWindow = 0;
let consumed = 0;
let lastRemaining: number | null = null;
const quota = () => {
  const now = Math.floor(Date.now() / 3_600_000);
  if (hourWindow !== now) { hourWindow = now; consumed = 0; lastRemaining = null; }
  const cap = Number(process.env.BETSAPI_HOURLY_REQUEST_BUDGET || DEFAULT_HOURLY_BUDGET);
  const limit = Number.isSafeInteger(cap) ? Math.max(50, Math.min(cap, 3000)) : DEFAULT_HOURLY_BUDGET;
  if (consumed >= limit || (lastRemaining !== null && lastRemaining < 50)) {
    throw new Error('BETSAPI_BUDGET_EXHAUSTED');
  }
  consumed++;
};

export class BetsApiSportsProvider implements SportsDataProvider {
  readonly name = 'betsapi';
  private readonly key: string;
  readonly configured: boolean;
  private readonly requester: typeof fetch;
  private readonly knownMatchLive = new Map<string, boolean>();
  private remember(match: ProviderMatch) {
    if (this.knownMatchLive.size >= 2500) this.knownMatchLive.clear();
    this.knownMatchLive.set(match.providerId, match.status === 'live');
  }
  constructor(options?: { token?: string; fetcher?: typeof fetch }) {
    this.key = options?.token ?? process.env.BETSAPI_TRIAL_TOKEN ?? '';
    this.requester = options?.fetcher ?? fetch;
    this.configured = Boolean(this.key) && process.env.BETSAPI_TRIAL_ENABLED === 'true';
  }

  private async request(path: string, params: Record<string, string>): Promise<Json> {
    if (!this.configured) throw new Error('NOT_CONFIGURED');
    quota();
    const url = new URL(path, BASE);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('token', this.key);
    const fetchOne = async (base: string) => {
      // Restrict host and never reflect the request URL containing a token.
      const resource = base === BASE ? url : new URL(url.pathname + url.search, base);
      const response = await this.requester(resource.toString(), {
        headers: { Accept: 'application/json' }, method: 'GET', cache: 'no-store',
        redirect: 'error', signal: AbortSignal.timeout(7000),
      });
      if (response.status === 429) throw new Error('BETSAPI_RATE_LIMITED');
      if (response.status === 401 || response.status === 403) throw new Error('BETSAPI_PERMISSION_DENIED');
      if (!response.ok) throw new Error('BETSAPI_UNAVAILABLE');
      const left = Number(response.headers.get('X-RateLimit-Remaining'));
      if (response.headers.has('X-RateLimit-Remaining') && Number.isFinite(left)) lastRemaining = left;
      const size = Number(response.headers.get('content-length') || 0);
      if (size > 3_000_000) throw new Error('BETSAPI_SCHEMA_INVALID');
      const json: unknown = await response.json();
      const envelope = object(json);
      if (Number(envelope.success) !== 1) {
        throw new Error(String(envelope.error_code || '') === 'PERMISSION_DENIED'
          ? 'BETSAPI_PERMISSION_DENIED' : 'BETSAPI_UNAVAILABLE');
      }
      return envelope;
    };
    try { return await fetchOne(BASE); }
    catch (err) {
      // Only transport failures may try the second *official* load-balancer.
      // Never retry permission/quota responses.
      if (err instanceof Error &&
        ['BETSAPI_RATE_LIMITED', 'BETSAPI_PERMISSION_DENIED', 'BETSAPI_BUDGET_EXHAUSTED'].includes(err.message)) throw err;
      if (!(err instanceof TypeError) && !(err instanceof DOMException && err.name === 'TimeoutError')) throw err;
      quota();
      return fetchOne(SPARE_BASE);
    }
  }

  async health(): Promise<ProviderStatus> {
    if (!this.configured) return {
      provider: this.name, category: 'sports', enabled: false, configured: false,
      reachable: false, lastError: null, lastSuccessAt: null,
      requiredEnv: ['BETSAPI_TRIAL_ENABLED', 'BETSAPI_TRIAL_TOKEN'],
      notes: 'Read-only shadow adapter, disabled. Existing sportsbook stays on The Odds API.',
    };
    try {
      await this.request('/v3/events/inplay', { sport_id: '1' });
      return {
        provider: this.name, category: 'sports', enabled: true, configured: true,
        reachable: true, lastError: null, lastSuccessAt: new Date().toISOString(),
        requiredEnv: ['BETSAPI_TRIAL_TOKEN'],
        notes: 'BetsAPI is reachable in SHADOW mode; not authorized to price real-money bets.',
      };
    } catch (err) {
      return {
        provider: this.name, category: 'sports', enabled: true, configured: true,
        reachable: false, lastError: errorCode(err), lastSuccessAt: null,
        requiredEnv: ['BETSAPI_TRIAL_TOKEN'],
        notes: 'BetsAPI trial unreachable; no automatic production fallback.',
      };
    }
  }

  async fetchMatches(window: { from: string; to: string; sport?: string }): Promise<ProviderResult<ProviderMatch[]>> {
    if (!this.configured) return failed('NOT_CONFIGURED');
    const from = Date.parse(window.from), to = Date.parse(window.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from ||
      to - from > 31 * 86_400_000) return failed('BETSAPI_SCHEMA_INVALID');
    const selected = BETSAPI_SPORTS.filter(s => !window.sport || s.slug === window.sport);
    const all = new Map<string, ProviderMatch>();
    let successes = 0;
    for (const sport of selected) {
      try {
        // First page is a bounded read; future day+league pagination will be
        // scheduled separately after the operator validates trial quota.
        const requested = Number(process.env.BETSAPI_DISCOVERY_PAGES || 2);
        const pageLimit = Number.isSafeInteger(requested)
          ? Math.max(1, Math.min(requested, MAX_DISCOVERY_PAGES)) : 2;
        for (let page = 1; page <= pageLimit; page++) {
          const envelope = await this.request('/v3/events/upcoming', {
            sport_id: String(sport.id), page: String(page),
          });
          successes++;
          const batch = events(envelope.results);
          for (const event of batch) {
            const parsed = normalizeBetsapiEvent(event);
            if (parsed && parsed.status === 'scheduled' &&
              Date.parse(parsed.scheduledAt) >= from && Date.parse(parsed.scheduledAt) <= to) {
              all.set(parsed.providerId, parsed);
              this.remember(parsed);
            }
          }
          if (batch.length < 50) break;
        }
      } catch (e) {
        if (errorCode(e) === 'BETSAPI_RATE_LIMITED' ||
          errorCode(e) === 'BETSAPI_BUDGET_EXHAUSTED') return failed(errorCode(e), true);
      }
    }
    return successes > 0 ? ok([...all.values()]) : failed('BETSAPI_UNAVAILABLE', true);
  }

  async fetchLiveMatches(sport?: string): Promise<ProviderResult<ProviderMatch[]>> {
    if (!this.configured) return failed('NOT_CONFIGURED');
    const selected = BETSAPI_SPORTS.filter(s => !sport || s.slug === sport);
    if (selected.length === 0) return ok([]);
    const all = new Map<string, ProviderMatch>();
    let successes = 0;
    for (const selectedSport of selected) {
      try {
        const data = await this.request('/v3/events/inplay', {
          sport_id: String(selectedSport.id),
        });
        successes++;
        for (const row of events(data.results)) {
          const match = normalizeBetsapiEvent(row);
          if (match?.status === 'live') {
            all.set(match.providerId, match);
            this.remember(match);
          }
        }
      } catch (e) {
        if (['BETSAPI_RATE_LIMITED', 'BETSAPI_BUDGET_EXHAUSTED'].includes(errorCode(e))) {
          return failed(errorCode(e), true);
        }
      }
    }
    return successes > 0 ? ok([...all.values()]) : failed('BETSAPI_UNAVAILABLE', true);
  }

  async fetchOdds(ids: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> {
    if (!this.configured) return failed('NOT_CONFIGURED');
    if (ids.length > MAX_PER_CALL) return failed('BETSAPI_BUDGET_EXHAUSTED');
    if (ids.some(id => !parseBetsapiIdentity(id))) return failed('BETSAPI_SCHEMA_INVALID');
    // Fail closed for unknown fixture state. Without a provider-observed live
    // or scheduled status, no quote should be assigned a freshness window.
    if (ids.some(id => !this.knownMatchLive.has(id))) return failed('BETSAPI_SCHEMA_INVALID');
    const result: ProviderOddsBundle[] = [];
    let failures = 0;
    // Explicit upper bound and sequential pacing: maximum 12 upstream calls.
    for (const id of [...new Set(ids)]) {
      const identity = parseBetsapiIdentity(id)!;
      try {
        const payload = await this.request('/v2/event/odds', { event_id: identity.eventId, source: 'bet365' });
        // Only the Events API ID is accepted. Bet365 FI must NEVER be reused.
        const normalized = normalizeBetsapiOdds(
          id, payload.results, new Date(), this.knownMatchLive.get(id)!,
        );
        result.push(normalized);
      } catch { failures++; }
    }
    return result.length > 0 || !ids.length ? ok(result) : failed('BETSAPI_UNAVAILABLE', true);
  }

  async fetchEventOdds(ids: string[]): Promise<ProviderResult<ProviderOddsBundle[]>> {
    return this.fetchOdds(ids);
  }

  async fetchResult(id: string): Promise<ProviderResult<ProviderResultSnapshot>> {
    if (!this.configured) return failed('NOT_CONFIGURED');
    const ident = parseBetsapiIdentity(id);
    if (!ident) return failed('BETSAPI_SCHEMA_INVALID');
    try {
      const response = await this.request('/v1/event/view', { event_id: ident.eventId });
      const candidate = Array.isArray(response.results) ? response.results[0] : response.results;
      const normalized = normalizeBetsapiResult(id, candidate);
      return normalized ? ok(normalized) : failed('BETSAPI_SCHEMA_INVALID');
    } catch (err) { return failed(errorCode(err), true); }
  }

  async fetchResults(from: string, to: string, ids: string[] = []):
    Promise<ProviderResult<ProviderResultSnapshot[]>> {
    if (!this.configured) return failed('NOT_CONFIGURED');
    if (ids.length > MAX_PER_CALL || ids.some(id => !parseBetsapiIdentity(id))) {
      return failed('BETSAPI_SCHEMA_INVALID');
    }
    // Return only verified event-id matches, never third-party score guesses.
    const results: ProviderResultSnapshot[] = [];
    for (const id of ids) {
      const item = await this.fetchResult(id);
      if (item.ok && item.value &&
        Date.parse(item.value.observedAt) >= Date.parse(from) &&
        Date.parse(item.value.observedAt) <= Date.parse(to)) results.push(item.value);
    }
    return ok(results);
  }
}
