import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

/** Match list: filter by sport/league/live, paginated, ordered by kick-off. */
export const GET = withErrorHandling('matches.list', async (ctx, request: Request) => {
  const services = createServices();
  const params = searchParams(request);
  const page = intParam(params, 'page', 1, 500);
  const pageSize = intParam(params, 'pageSize', 20, 50);
  const liveParam = params.get('live');
  const live = liveParam === null ? undefined : liveParam === 'true';
  const isLive = live === true;
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const from = isLive
    ? undefined
    : fromParam
      ? new Date(fromParam).toISOString()
      : new Date().toISOString();
  const to = isLive || !toParam
    ? undefined
    : new Date(toParam).toISOString();
  const result = await services.catalog.listMatches(serviceRoleContext, {
    sportKey: params.get('sport') ?? undefined,
    leagueId: params.get('league') ?? undefined,
    live,
    status: isLive ? undefined : ['scheduled'],
    from,
    to,
    search: params.get('q') ?? undefined,
    page, pageSize,
    sortBy: 'scheduled_at',
    sortDirection: 'asc',
  });
  return jsonOk(result);
});
