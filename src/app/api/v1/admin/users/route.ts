import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

const statusFilter = z.enum(['active', 'restricted', 'suspended', 'closed', 'self_excluded']).optional();

export const GET = withErrorHandling('admin.users.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'users.view');
  const params = searchParams(request);
  const page = await services.users.listForAdmin({
    search: params.get('q') ?? undefined,
    status: statusFilter.catch(undefined).parse(params.get('status') ?? undefined) ?? undefined,
    role: (params.get('role') as never) ?? undefined,
    kycStatus: params.get('kyc') ?? undefined,
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
    sortBy: 'registered_at', sortDirection: params.get('sort') === 'oldest' ? 'asc' : 'desc',
  });
  return jsonOk(page);
});
