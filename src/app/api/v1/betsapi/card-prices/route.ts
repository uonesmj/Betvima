import { jsonOk, withErrorHandling } from '@/lib/errors';
import { exploreBetsApi, type ExplorerMarkets } from '@/providers/betsapi-explorer';
import { betsApiToken } from '@/server/betsapi-feed';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
import { pickHeadlineMarket } from '@/lib/betsapi-headline-market';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Avoid exhausting the trial subscription as visitors scroll through fixtures.
// The backend returns no private token and never creates wagerable selections.
const entries = new Map<string, { until: number; data: Promise<ExplorerMarkets> }>();
let currentHour = -1;
let callsThisHour = 0;
const MAX_DETAILS_PER_HOUR = 400;
const MAX_CACHE_ITEMS = 500;


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
  const market = result.error ? null : pickHeadlineMarket(result.markets);
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
