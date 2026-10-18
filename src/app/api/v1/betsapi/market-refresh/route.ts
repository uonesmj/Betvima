import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readBetsApiMarkets } from '@/server/betsapi-market-cache';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Read-only Bet365 market snapshot, same adaptive upstream cache as odds cards. */
export const GET = withErrorHandling('betsapi.market.refresh', async (_ctx, request: Request) => {
  const p = new URL(request.url).searchParams;
  const fi = p.get('fi') || '';
  const mode = p.get('mode');
  const sportId = Number(p.get('sportId'));
  if (!/^\d{1,16}$/.test(fi) || (mode !== 'live' && mode !== 'upcoming')
    || !BETSAPI_SPORTS.some(s => s.id === sportId)) {
    return jsonOk({ source: 'betsapi_bet365', readOnly: true, markets: [], error: 'INVALID_FIXTURE' });
  }
  const result = await readBetsApiMarkets(mode, sportId, fi);
  return jsonOk({
    source: 'betsapi_bet365', readOnly: true, mode, fi,
    markets: result.markets, marketCount: result.marketCount,
    refreshedAt: result.refreshedAt, error: result.error,
    pollAfterMs: mode === 'live' ? 10000 : 60000,
  });
});
