import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson, idempotencyKeyFrom } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ amountMinor: z.string().regex(/^\d{1,19}$/), reason: z.string().min(8).max(300) });

export const POST = withErrorHandling('admin.payments.refund', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'payments.refund');
  const idempotencyKey = idempotencyKeyFrom(request);
  const body = await readJson(request, schema, ctx);
  const result = await services.payments.refund({
    intentId: id, amountMinor: body.amountMinor, reason: body.reason, actorId: user.id, idempotencyKey,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'payment.refunded', entityType: 'payment_intent', entityId: id,
    after: { amountMinor: body.amountMinor }, reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ refund: { intent: result.refundIntent, walletEntryId: result.walletEntryId } });
});
