import { jsonOk, withErrorHandling } from '@/lib/errors';
import { exploreBetsApi, type ExplorerMarkets } from '@/providers/betsapi-explorer';
import { betsApiToken } from '@/server/betsapi-feed';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Avoid exhausting the trial subscription as visitors scroll through fixtures.
// The backend returns no private token and never creates wagerable selections.
const entries = new Map<string, { until: number; data: Promise<ExplorerMarkets> }>();
let currentHour = -1;
let callsThisHour = 0;
const MAX_DETAILS_PER_HOUR = 400;
const MAX_CACHE_ITEMS = 500;

function preferredMarket(markets: ExplorerMarkets['markets']) {
  const available = markets
    .map(m => ({
      ...m,
      selections: m.selections.filter(s =>
        s.id && Number.isFinite(Number(s.decimal)) &&
        Number(s.decimal) > 1 &&
        s.label.trim() && !/Unlabelled outcome/i.test(s.label),
      ),
    }))
    .filter(m => m.selections.length > 0);
  const rank = (name: string): number => {
    const n = name.toLowerCase();
    if (/^(full ?time result|match result|match winner|1x2|3.way result|money ?line)$/.test(n)) return 0;
    if (/^(winner|to win|match betting|two.way result)$/.test(n)) return 1;
    if (/^(double chance|total goals|match goals|total points|over\/under)/.test(n)) return 2;
    if (/^(result|game winner|handicap|spread)/.test(n)) return 3;
    return 10;
  };
  available.sort((a, b) => rank(a.title) - rank(b.title));
  return available[0] ?? null;
}

export const GET = withErrorHandling('betsapi.card.prices', async (_ctx, request: Request) => {
  const params = new URL(request.url).searchParams;
  const fi = params.get('fi') ?? '';
  const mode = params.get('mode');
  const sportId = Number(params.get('sportId'));
  if (!/^\d{1,16}$/.test(fi) || (mode !== 'live' && mode !== 'upcoming') ||
    !BETSAPI_SPORTS.some(s => s.id === sportId)) {
    return jsonOk({ source: 'betsapi_bet365', readOnly: true, market: null, error: 'INVALID_FIXTURE' });
  }

  const token = betsApiToken();
  if (!token) return jsonOk({ source: 'betsapi_bet365', readOnly: true, market: null, error: 'NOT_CONFIGURED' });

  const hour = Math.floor(Date.now() / 3_600_000);
  if (hour !== currentHour) { currentHour = hour; callsThisHour = 0; }
  const key = [mode, sportId, fi].join(':');
  const now = Date.now();
  let entry = entries.get(key);
  if (!entry || entry.until < now) {
    if (callsThisHour >= MAX_DETAILS_PER_HOUR) {
      return jsonOk({ source: 'betsapi_bet365', readOnly: true, market: null, error: 'PREVIEW_BUDGET_EXHAUSTED' });
    }
    callsThisHour++;
    const promise = exploreBetsApi(token, { mode, fi, sportId }) as Promise<ExplorerMarkets>;
    entry = { until: now + (mode === 'live' ? 180_000 : 600_000), data: promise };
    entries.set(key, entry);
    // Remove aged entries on demand, never allow unlimited growth.
    if (entries.size > MAX_CACHE_ITEMS) {
      for (const [k, v] of entries) if (v.until < now) entries.delete(k);
      while (entries.size > MAX_CACHE_ITEMS) entries.delete(entries.keys().next().value!);
    }
  }
  const result = await entry.data;
  if (result.error) entries.delete(key); // allow a later retry without persisting failures
  const market = result.error ? null : preferredMarket(result.markets);
  return jsonOk({
    source: 'betsapi_bet365', readOnly: true,
    market: market ? {
      name: market.title,
      selections: market.selections.slice(0, 3).map(s => ({ label: s.label, decimal: s.decimal })),
    } : null,
    marketCount: result.marketCount,
    refreshedAt: result.refreshedAt,
    error: result.error,
  });
});
