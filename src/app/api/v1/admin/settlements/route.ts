import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

/**
 * Settlement queue (nova.settlement_jobs) - the authoritative work list behind automatic
 * settlement and regrade. Counts come from the same table the worker consumes, so this screen
 * can never disagree with the settlement engine.
 */
export const GET = withErrorHandling('admin.settlements.list', async (ctx, request: Request) => {
  const { services } = await // The settlement queue is the settlement face of bets, so it is gated by `bets.view`
  // (held by settlement_manager, risk_manager, admin and super_admin) rather than a permission
  // that no role would hold.
  withAdmin(request, ctx, 'bets.view');
  const params = searchParams(request);
  const page = intParam(params, 'page', 1, 5000);
  const pageSize = intParam(params, 'pageSize', 25, 100);
  const status = params.get('status') ?? undefined;
  const queue = await services.settlementPort.listSettlementQueue({ status, limit: pageSize, page });
  const rows = await services.db.query<{ status: string; total: string }>(
    `select status::text as status, count(*)::text as total from nova.settlement_jobs group by status`,
  );
  const stats = Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
  return jsonOk({
    items: queue.items, total: queue.total, page, pageSize,
    stats: {
      queued: stats.queued ?? 0, processing: stats.processing ?? 0, done: stats.done ?? 0,
      failed: stats.failed ?? 0, manual_review: stats.manual_review ?? 0, skipped: stats.skipped ?? 0,
    },
  });
});
