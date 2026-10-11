import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

/** In-play matches. Empty is a valid, honest answer when no provider is configured. */
export const GET = withErrorHandling('matches.live', async (ctx, request: Request) => {
  const services = createServices();
  const limit = intParam(searchParams(request), 'limit', 30, 100);
  const [matches, liveSportCounts] = await Promise.all([
    services.catalog.listLiveMatches(serviceRoleContext, limit),
    services.catalog.listLiveSportCounts(serviceRoleContext),
  ]);
  const liveBettingEnabled = (await services.admin.operations()).find((o) => o.key === 'LIVE_BETTING')?.isEnabled ?? true;
  return jsonOk({ matches, liveSportCounts, liveBettingEnabled, providerConfigured: services.providers.sports.configured });
});
