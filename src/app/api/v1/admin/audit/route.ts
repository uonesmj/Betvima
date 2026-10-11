import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.audit.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'admin.audit');
  const params = searchParams(request);
  const page = await services.admin.auditLog({
    actorId: params.get('actorId') ?? undefined,
    action: params.get('action') ?? undefined,
    entityType: params.get('entityType') ?? undefined,
    entityId: params.get('entityId') ?? undefined,
    from: params.get('from') ?? undefined, to: params.get('to') ?? undefined,
    search: params.get('q') ?? undefined,
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 50, 200),
  });
  return jsonOk(page);
});
