import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

/** Real historical credits only; never expose estimated awards as wallet funds. */
export const GET = withErrorHandling('vip.cashback.history', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const [items, operation] = await Promise.all([
    services.db.query<{
      week_start: string; week_end: string; currency: string;
      deposit_minor: string; net_loss_minor: string;
      cashback_bps: number; amount_minor: string; credited_at: string;
    }>(
      'select week_start, week_end, currency, deposit_minor::text, ' +
      'net_loss_minor::text, cashback_bps, amount_minor::text, credited_at ' +
      'from nova.vip_cashback_payouts where user_id = $1 order by week_start desc limit 52',
      [user.id],
    ),
    services.db.queryOne<{ enabled: boolean }>(
      "select enabled from nova.system_operations where key='VIP_CASHBACK_PAYOUT'",
    ),
  ]);
  return jsonOk({
    currency: 'USD',
    actualPayoutsOnly: true,
    payoutEngineEnabled: operation?.enabled === true,
    items: items.map((entry) => ({
      weekStart: entry.week_start,
      weekEnd: entry.week_end,
      depositMinor: entry.deposit_minor,
      eligibleLossMinor: entry.net_loss_minor,
      cashbackRateBps: entry.cashback_bps,
      paidMinor: entry.amount_minor,
      creditedAt: entry.credited_at,
    })),
  });
});
