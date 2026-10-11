import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, readJson, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.reconciliation.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'reconciliation.run');
  const limit = intParam(searchParams(request), 'limit', 10, 50);
  return jsonOk({ runs: await services.admin.listReconciliations(limit) });
});

const schema = z.object({
  periodStart: z.string().datetime({ offset: true }).optional(),
  periodEnd: z.string().datetime({ offset: true }).optional(),
});

/** Runs the six financial control checks (ledger, bets, settlements, affiliate, payouts). */
export const POST = withErrorHandling('admin.reconciliation.run', async (ctx, request: Request) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'reconciliation.run');
  const body = await readJson(request, schema, ctx).catch(() => ({}) as z.infer<typeof schema>);
  const report = await services.admin.runReconciliation({ ...body, actorId: user.id });
  await services.admin.writeAudit({
    actorId: user.id, action: 'reconciliation.run', entityType: 'reconciliation', entityId: report.id,
    after: { passed: report.passed, findings: report.issues.length }, reason: 'manual reconciliation run',
    correlationId: actor.correlationId,
  });
  return jsonOk({ report });
});
