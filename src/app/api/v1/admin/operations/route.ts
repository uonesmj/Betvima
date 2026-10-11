import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.operations.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'settings.view');
  const [operations, killSwitches, maintenance] = await Promise.all([
    services.admin.operations(), services.admin.killSwitches(), services.admin.maintenanceMode(),
  ]);
  return jsonOk({ operations, killSwitches, maintenance });
});

const schema = z.object({
  key: z.string().min(3).max(60),
  isEnabled: z.boolean(),
  reason: z.string().min(4).max(300),
});

/** Kill switches / operation toggles (betting, deposits, payouts, maintenance, ...). */
export const PATCH = withErrorHandling('admin.operations.update', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'killswitch.toggle');
  const body = await readJson(request, schema, ctx);
  const result = await services.admin.setOperation({ key: body.key, isEnabled: body.isEnabled, reason: body.reason, actorId: user.id });
  await services.admin.writeAudit({
    actorId: user.id, action: body.isEnabled ? 'operation.enabled' : 'operation.disabled',
    entityType: 'system_operation', entityId: body.key, after: { isEnabled: body.isEnabled },
    reason: body.reason, correlationId: actor.correlationId,
  });
  return jsonOk({ operation: result });
});
