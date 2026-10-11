import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.jobs.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'admin.view');
  const params = searchParams(request);
  const [stats, jobs] = await Promise.all([
    services.admin.jobStats(),
    services.admin.listJobs({
      queue: params.get('queue') ?? undefined, status: params.get('status') ?? undefined,
      page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
    }),
  ]);
  return jsonOk({ stats, ...jobs });
});
