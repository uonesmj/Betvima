import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAffiliate } from '@/server/http/guard';
import { searchParams } from '@/server/http/request';
import { currentDailyPeriod } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * Affiliate dashboard payload: payable balance (with raw/carry/suppressed split so the
 * MODEL A vs MODEL B difference is visible), stats for the period, and payouts.
 */
export const GET = withErrorHandling('affiliate.overview', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND', 'No affiliate account is linked to this user');
  const params = searchParams(request);
  const daily = currentDailyPeriod(new Date(), affiliate.settlementTimezone || 'Asia/Tehran');
  const end = params.get('to') ?? daily.end.toISOString();
  const start = params.get('from') ?? daily.start.toISOString();
  const [payable, stats, payouts, hierarchy, dailyRows] = await Promise.all([
    services.affiliate.payableBalance(affiliate.id),
    services.affiliate.getStats(affiliate.id, { start, end }),
    services.affiliate.listPayouts({ affiliateId: affiliate.id, page: 1, pageSize: 10 }),
    services.affiliate.hierarchy(affiliate.id),
    services.db.query<Record<string, unknown>>(
      `select day, currency, clicks, registrations, first_deposits, active_users,
              settled_bets, turnover_minor, user_wins_minor, user_losses_minor, commission_minor
         from nova.affiliate_daily_stats
        where affiliate_id = $1
          and day between $2::date and $3::date
        order by day asc`,
      [affiliate.id, start, end],
    ),
  ]);
  const dailyStats = dailyRows.map((r: Record<string, unknown>) => ({
    day: String(r.day),
    currency: String(r.currency ?? affiliate.currency),
    clicks: Number(r.clicks ?? 0),
    registrations: Number(r.registrations ?? 0),
    firstDeposits: Number(r.first_deposits ?? 0),
    activeUsers: Number(r.active_users ?? 0),
    settledBets: Number(r.settled_bets ?? 0),
    turnoverMinor: String(r.turnover_minor ?? 0),
    userWinsMinor: String(r.user_wins_minor ?? 0),
    userLossesMinor: String(r.user_losses_minor ?? 0),
    commissionMinor: String(r.commission_minor ?? 0),
  }));

  return jsonOk({
    affiliate, payable, stats, payouts, hierarchy, dailyStats,
    model: affiliate.commissionModel,
    note: affiliate.commissionModel === 'PROFIT_LOSS_35'
      ? 'MODEL A: negative balances carry forward and are deducted from future commission.'
      : 'MODEL B: payable balance never goes below zero; negative periods are suppressed and recorded.',
    period: { start, end },
  });
});
