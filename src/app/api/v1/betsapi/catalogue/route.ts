import { jsonOk, withErrorHandling } from '@/lib/errors';
import { getBetsApiHomepage, getBetsApiSport, sportByKey } from '@/server/betsapi-feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public, read-only, rate-budgeted BetsAPI catalogue; never returns an API token. */
export const GET = withErrorHandling('betsapi.catalogue', async (_ctx, request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') ?? 'home';
  if (mode === 'home') return jsonOk(await getBetsApiHomepage());
  if (mode !== 'live' && mode !== 'upcoming')
    return jsonOk({ source: 'betsapi_bet365', error: 'INVALID_MODE', matches: [] });
  const sportKey = url.searchParams.get('sport') || 'football';
  if (!sportByKey(sportKey)) return jsonOk({ source: 'betsapi_bet365', error: 'UNSUPPORTED_SPORT', matches: [] });
  const rawPage = Number(url.searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(100, rawPage)) : 1;
  return jsonOk(await getBetsApiSport(mode, sportKey, page));
});
