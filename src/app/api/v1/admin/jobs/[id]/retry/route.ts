import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling('admin.jobs.retry', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'admin.view');
  const job = await services.admin.retryJob({ jobId: id, actorId: user.id });
  await services.admin.writeAudit({
    actorId: user.id, action: 'job.retry', entityType: 'job', entityId: id,
    after: null, reason: 'operator retry', correlationId: actor.correlationId,
  });
  return jsonOk({ job });
});
