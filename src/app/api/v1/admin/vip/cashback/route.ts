import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
/** Finance-facing read-only observability; no HTTP-based money mutation. */
export const GET = withErrorHandling('admin.vip_cashback.report', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'reconciliation.run');
  const [weeks, anomalies, operation] = await Promise.all([
    services.db.query<{
      week_start: string; paid_users: string; paid_minor: string; highest_amount_minor: string;
    }>(
      'select week_start, count(*)::text as paid_users, ' +
      'sum(amount_minor)::text as paid_minor, max(amount_minor)::text as highest_amount_minor ' +
      'from nova.vip_cashback_payouts group by week_start order by week_start desc limit 20',
    ),
    services.db.query<{ week_start: string; unresolved: string }>(
      'select week_start, count(*)::text as unresolved ' +
      'from nova.vip_cashback_discrepancies where resolved_at is null ' +
      'group by week_start order by week_start desc',
    ),
    services.db.queryOne<{ enabled: boolean }>(
      "select enabled from nova.system_operations where key='VIP_CASHBACK_PAYOUT'",
    ),
  ]);
  return jsonOk({ currency: 'USD', enabled: operation?.enabled === true,
    weeks, unresolvedDiscrepancies: anomalies });
});
