import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ approve: z.boolean(), reason: z.string().min(4).max(300).optional() });

/** Second-operator approval. Self-approval is impossible (DB trigger + actor check). */
export const POST = withErrorHandling('admin.adjustments.approve', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'wallet.approve_adjustment');
  const body = await readJson(request, schema, ctx);
  const adjustment = await services.wallet.approveAdminAdjustment({ requestId: id, actorId: user.id, approve: body.approve, reason: body.reason });
  await services.admin.writeAudit({
    actorId: user.id, action: body.approve ? 'wallet.adjustment_approved' : 'wallet.adjustment_rejected',
    entityType: 'admin_adjustment', entityId: id, after: { approve: body.approve, reason: body.reason ?? null },
    reason: body.reason ?? 'adjustment decision', correlationId: actor.correlationId,
  });
  return jsonOk({ adjustment });
});
