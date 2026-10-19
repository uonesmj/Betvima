import { jsonOk, withErrorHandling } from '@/lib/errors';
import { readBetsApiMarkets } from '@/server/betsapi-market-cache';
import { betsApiToken } from '@/server/betsapi-feed';
import { BETSAPI_SPORTS } from '@/lib/betsapi-sports-map';
import { pickHeadlineMarket } from '@/lib/betsapi-headline-market';
import { getBetsApiSport } from '@/server/betsapi-feed';
import { attachCanonicalWagers } from '@/server/betsapi-wager-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


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

  const result = await readBetsApiMarkets(mode, sportId, fi);
  const listing = await getBetsApiSport(mode, BETSAPI_SPORTS.find(s => s.id === sportId)!.key);
  const fixture = listing.matches.find(m => m.id === 'betsapi:' + mode + ':' + sportId + ':' + fi);
  const home = fixture?.participants.find(p => p.role === 'HOME')?.name ?? '';
  const away = fixture?.participants.find(p => p.role === 'AWAY')?.name ?? '';
  const markets = await attachCanonicalWagers(result.markets, {
    fi, sportId, mode, home, away, eventId: fixture?.betsApiEventId,
  });
  const headline = result.error ? null : pickHeadlineMarket(markets);
  const market = headline ? markets.find(item => item.key === headline.key) ?? null : null;
  const wageringAvailable = Boolean(market?.selections.some(selection => selection.wager));
  return jsonOk({
    source: 'betsapi_bet365', readOnly: !wageringAvailable, wageringAvailable,
    market: market ? {
      name: market.title,
      selections: market.selections.slice(0, 3).map(s => ({ label: s.label, decimal: s.decimal, wager: s.wager })),
    } : null,
    marketCount: result.marketCount,
    refreshedAt: result.refreshedAt,
    pollAfterMs: mode === 'live' ? 10000 : 60000,
    error: result.error,
  });
});
