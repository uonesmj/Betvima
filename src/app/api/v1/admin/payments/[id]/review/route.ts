import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().min(4).max(300).optional() });

export const POST = withErrorHandling('admin.payments.review', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'payments.approve');
  const body = await readJson(request, schema, ctx);
  const intent = await services.payments.reviewWithdrawal({ publicId: id, decision: body.decision, actorId: user.id, reason: body.reason });
  await services.admin.writeAudit({
    actorId: user.id, action: `payment.withdrawal_${body.decision}d`, entityType: 'payment_intent', entityId: id,
    after: { decision: body.decision }, reason: body.reason ?? 'withdrawal review', correlationId: actor.correlationId,
  });
  return jsonOk({ intent });
});
