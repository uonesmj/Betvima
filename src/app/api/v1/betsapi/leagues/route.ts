import { jsonOk, withErrorHandling } from '@/lib/errors';
import { listBetsApiLeagues } from '@/providers/betsapi-explorer';
import { betsApiToken } from '@/server/betsapi-feed';
import { sportByKey } from '@/lib/betsapi-sports-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Bookmaker's own league directory. Does not include old provider leagues. */
export const GET = withErrorHandling('betsapi.leagues', async (_ctx, request: Request) => {
  const sport = sportByKey(new URL(request.url).searchParams.get('sport') || 'football');
  if (!sport) return jsonOk({ leagues: [], error: 'UNSUPPORTED_SPORT' });
  const data = await listBetsApiLeagues(betsApiToken(), sport.id);
  return jsonOk(data);
});
