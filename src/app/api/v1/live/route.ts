import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { intParam, searchParams } from '@/server/http/request';
import { readLiveBettingEnabled, readLiveCatalogue } from '@/server/live-betting';

export const dynamic = 'force-dynamic';

/** In-play matches. Empty is a valid, honest answer when no provider is configured. */
export const GET = withErrorHandling('matches.live', async (ctx, request: Request) => {
  const services = createServices();
  const limit = intParam(searchParams(request), 'limit', 30, 100);
  const [matches, liveSportCounts] = await Promise.all([
    readLiveCatalogue(() => services.catalog.listLiveMatches(serviceRoleContext, limit), []),
    readLiveCatalogue(() => services.catalog.listLiveSportCounts(serviceRoleContext), {}),
  ]);
  const catalogueUnavailable = matches.unavailable || liveSportCounts.unavailable;
  const liveBettingEnabled = !catalogueUnavailable && await readLiveBettingEnabled(services.admin);
  return jsonOk({
    matches: matches.value,
    liveSportCounts: liveSportCounts.value,
    liveBettingEnabled,
    providerConfigured: services.providers.sports.configured,
    catalogueUnavailable,
    // Read-only public rollout guard: exactly one active sports source.
    sportsSourceRevision: 'the-odds-api-only-v1',
  });
});
