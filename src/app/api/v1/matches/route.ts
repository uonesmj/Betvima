import { withErrorHandling, jsonOk } from '@/lib/errors';
import { getBetsApiSport } from '@/server/betsapi-feed';
import { sportByKey } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
/** Public search/catalogue never falls back to historical Odds API database records. */
export const GET = withErrorHandling('matches.list', async (_ctx, request: Request) => {
  const p = new URL(request.url).searchParams;
  const mode = p.get('live') === 'true' ? 'live' : 'upcoming';
  const sport = p.get('sport') || 'football';
  const page = Math.max(1, Math.min(100, Number.parseInt(p.get('page') || '1', 10) || 1));
  if (!sportByKey(sport)) return jsonOk({ items: [], total: 0, page, pageSize: 50, hasMore: false, source: 'betsapi_bet365' });
  const data = await getBetsApiSport(mode, sport, page);
  const search = (p.get('q') || '').trim().toLowerCase();
  const items = search ? data.matches.filter(m =>
    [m.leagueName, ...m.participants.map(x => x.name)].some(v => (v || '').toLowerCase().includes(search))) : data.matches;
  return jsonOk({
    items, total: search ? items.length : data.total,
    page, pageSize: items.length,
    hasMore: mode === 'upcoming' && data.pageCount !== null && page < data.pageCount,
    source: 'betsapi_bet365', readOnly: true, error: data.error,
  });
});
