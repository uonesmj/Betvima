import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { serviceRoleContext } from '@/server/context';
import { searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('search', async (ctx, request: Request) => {
  const q = (searchParams(request).get('q') ?? '').trim();
  if (q.length < 2) throw new ApiError('VALIDATION_FAILED', 'Search needs at least 2 characters');
  const services = createServices();
  const [matches, leagues] = await Promise.all([
    services.catalog.search(serviceRoleContext, q, 10),
    services.catalog.listLeagues(serviceRoleContext, { search: q, limit: 5 }),
  ]);
  return jsonOk({ query: q, matches, leagues });
});
