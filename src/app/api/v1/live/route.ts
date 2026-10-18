import { withErrorHandling, jsonOk } from '@/lib/errors';
import { getBetsApiHomepage, betsApiToken } from '@/server/betsapi-feed';
export const dynamic = 'force-dynamic';
/** Live listings and sport badges use BetsAPI exclusively. No wager-enable signal. */
export const GET = withErrorHandling('matches.live', async () => {
  const data = await getBetsApiHomepage();
  return jsonOk({
    matches: data.live, liveSportCounts: data.liveSportCounts,
    liveBettingEnabled: false, providerConfigured: Boolean(betsApiToken()),
    catalogueUnavailable: data.errors.length > 0,
    liveTotal: data.liveTotal, sportsSourceRevision: 'betsapi-bet365-only-v1',
  });
});
