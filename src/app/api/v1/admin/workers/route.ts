import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { section, type DegradedSection } from '@/server/http/degrade';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.workers', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'dashboard.view');
  const degraded: DegradedSection[] = [];
  const [heartbeats, jobs, runs] = await Promise.all([
    section('heartbeats', degraded, () => services.admin.workerHeartbeats(), [], ctx.correlationId),
    section('job_stats', degraded, () => services.admin.jobStats(), [], ctx.correlationId),
    section('worker_runs', degraded, () => services.db.query<Record<string, unknown>>(
      `select worker, queue, status, started_at, finished_at, processed, failed, last_error
         from nova.worker_runs order by started_at desc limit 20`,
    ), [], ctx.correlationId),
  ]);
  return jsonOk({ heartbeats, jobs, runs, degraded });
});
