import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ reason: z.string().min(8).max(300) });

export const POST = withErrorHandling('admin.jobs.cancel', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'admin.view');
  const body = await readJson(request, schema, ctx);
  const job = await services.admin.cancelJob({ jobId: id, actorId: user.id, reason: body.reason });
  await services.admin.writeAudit({
    actorId: user.id, action: 'job.cancelled', entityType: 'job', entityId: id,
    after: { reason: body.reason }, reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ job });
});
