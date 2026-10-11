import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({
  decision: z.enum(['WIN', 'LOSS', 'VOID']),
  reason: z.string().min(8).max(500),
  notes: z.string().max(2000).optional(),
});

/**
 * Manual settlement by an operator. The payout is still computed from the authoritative
 * placement odds by the settlement service; the operator chooses the OUTCOME only.
 */
export const POST = withErrorHandling('admin.bets.settle', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'bets.settle');
  const body = await readJson(request, schema, ctx);
  const idempotencyKey = request.headers.get('idempotency-key') ?? `manual:${id}:${body.decision}:${Date.now()}`;
  const result = await services.betting.manualSettle({
    betId: id, decision: body.decision, reason: body.reason, actorId: user.id,
    idempotencyKey, notes: body.notes,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'bet.manual_settle', entityType: 'bet', entityId: id,
    after: { decision: body.decision, reason: body.reason }, reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({
    bet: result.bet,
    balanceAfterMinor: result.balanceAfterMinor === null || result.balanceAfterMinor === undefined ? null : result.balanceAfterMinor.toString(),
  });
});
