import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling<[Request]>('leagues.list', async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const services = createServices();

  const leagues = await services.catalog.listLeagues(serviceRoleContext, {
    sportKey: params.get('sport') ?? undefined,
    countryCode: params.get('country') ?? undefined,
    search: params.get('search') ?? undefined,
    leagueId: params.get('leagueId') ?? undefined,
    limit: Number(params.get('limit') ?? 100),
  });

  return jsonOk({ leagues });
});
