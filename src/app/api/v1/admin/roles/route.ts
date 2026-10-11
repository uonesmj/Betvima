import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.roles.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'admin.roles');
  return jsonOk({ roles: await services.admin.roles() });
});
