import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ reason: z.string().min(8).max(500) });

/**
 * Regrade after a corrected result. Performs a documented reversal of the previous
 * settlement and re-settles from the newest authoritative result; affiliate commission
 * is reversed with it. Never a silent edit of a settled bet.
 */
export const POST = withErrorHandling('admin.bets.regrade', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'bets.regrade');
  const body = await readJson(request, schema, ctx);
  const idempotencyKey = request.headers.get('idempotency-key') ?? `regrade:${id}:${Date.now()}`;
  const result = await services.settlement.regrade({
    betId: id, reason: body.reason, actorId: user.id, idempotencyKey,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'bet.regrade', entityType: 'bet', entityId: id,
    after: { reason: body.reason, settlement: result }, reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ regrade: result });
});
