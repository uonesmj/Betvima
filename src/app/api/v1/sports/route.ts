import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling<[Request]>('sports.list', async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const services = createServices();
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  const [sports, countries] = await Promise.all([
    services.catalog.listSports(serviceRoleContext, { from, to }),
    services.catalog.listCountries(serviceRoleContext),
  ]);
  ctx.logger.debug('sports listed', { count: sports.length });
  return jsonOk({ sports, countries });
});
