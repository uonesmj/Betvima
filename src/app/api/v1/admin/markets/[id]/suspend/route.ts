import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({ suspended: z.boolean(), reason: z.string().min(4).max(300) });

/** Suspend / re-open a market. Suspension is immediate and blocks placement DB-side. */
export const POST = withErrorHandling('admin.markets.suspend', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'markets.suspend');
  const body = await readJson(request, schema, ctx);
  const row = await services.db.queryOne<Record<string, unknown>>(
    `update nova.markets set status = case when $2 then 'suspended'::market_status else 'open'::market_status end,
        suspended_reason = case when $2 then $3 else null end, suspended_at = case when $2 then now() else null end,
        updated_at = now()
      where id = $1 returning id, status, suspended_reason`,
    [id, body.suspended, body.reason],
  );
  await services.admin.writeAudit({
    actorId: user.id, action: body.suspended ? 'market.suspended' : 'market.reopened',
    entityType: 'market', entityId: id, after: { reason: body.reason },
    reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ market: row });
});
