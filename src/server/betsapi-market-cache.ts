/**
 * Shared read-only market refresh coordinator for both event detail and cards.
 *
 * Source requests consume quota once per FI even if 1,000 visitors see it.
 * Active distinct fixtures dynamically increase cache age so a trial plan
 * cannot be exhausted by a scrolling visitor. Betting stays disabled.
 */
import { exploreBetsApi, type ExplorerMarkets } from '@/providers/betsapi-explorer';
import { betsApiToken } from '@/server/betsapi-feed';
type Mode = 'live' | 'upcoming';

const cache = new Map<string, { expires: number; data: Promise<ExplorerMarkets> }>();
const active = new Map<string, number>();
let budgetHour = -1;
let used = 0;
const LIMIT = Math.max(60, Math.min(600, Number(process.env.BETSAPI_DETAILS_REQUESTS_PER_HOUR) || 360));
const LIVE_MIN_TTL = Math.max(12_000, Math.min(60_000, Number(process.env.BETSAPI_LIVE_MARKET_MIN_CACHE_MS) || 12_000));
const MAX_ENTRIES = 800;

export async function readBetsApiMarkets(mode: Mode, sportId: number, fi: string): Promise<ExplorerMarkets> {
  const key = `${mode}:${sportId}:${fi}`;
  const now = Date.now();
  active.set(key, now);
  // Visible requests from any browser share the same supplier budget.
  if (active.size > 2000) for (const [k, time] of active)
    if (time < now - 65_000) active.delete(k);
  const visible = [...active.values()].filter(time => time >= now - 60_000).length;
  // At least 20% spare capacity for match detail views, admin trial probes,
  // sport/league catalogues, and periods with unusual activity.
  const adaptiveMs = Math.ceil(3_600_000 * Math.max(1, visible) / (LIMIT * 0.8));
  const ttl = mode === 'live'
    ? Math.max(LIVE_MIN_TTL, Math.min(300_000, adaptiveMs))
    : 180_000;
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.data;

  const hour = Math.floor(now / 3_600_000);
  if (hour !== budgetHour) { budgetHour = hour; used = 0; }
  if (used >= LIMIT) {
    if (previous) return previous.data; // show last verified quote, never invent a new one
    return {
      source: 'betsapi_bet365', readOnly: true, configured: Boolean(betsApiToken()),
      mode, fi, refreshedAt: new Date(now).toISOString(),
      marketCount: 0, selectionCount: 0, markets: [], error: 'UPSTREAM_QUOTA',
    };
  }
  used++;
  const data = exploreBetsApi(betsApiToken(), { mode, sportId, fi }) as Promise<ExplorerMarkets>;
  const entry = { expires: now + ttl, data };
  cache.set(key, entry);
  if (cache.size > MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  }
  return data;
}
