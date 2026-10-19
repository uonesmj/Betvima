import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readBetsApiMarkets } from '@/server/betsapi-market-cache';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
import { getBetsApiSport } from '@/server/betsapi-feed';
import { attachCanonicalWagers } from '@/server/betsapi-wager-bridge';

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
  const listing = await getBetsApiSport(mode, BETSAPI_SPORTS.find(s => s.id === sportId)!.key);
  const fixture = listing.matches.find(m => m.id === 'betsapi:' + mode + ':' + sportId + ':' + fi);
  const home = fixture?.participants.find(p => p.role === 'HOME')?.name ?? '';
  const away = fixture?.participants.find(p => p.role === 'AWAY')?.name ?? '';
  const markets = await attachCanonicalWagers(result.markets, {
    fi, sportId, mode, eventId: fixture?.betsApiEventId, home, away,
  });
  return jsonOk({
    source: 'betsapi_bet365', readOnly: true, mode, fi,
    markets, marketCount: result.marketCount,
    refreshedAt: result.refreshedAt, error: result.error,
    pollAfterMs: mode === 'live' ? 10000 : 60000,
  });
});
