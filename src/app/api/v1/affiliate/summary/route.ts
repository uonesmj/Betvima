import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAffiliate } from '@/server/http/guard';
import { searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

function parseDate(value: string | null, field: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError('BAD_REQUEST', `${field} must use YYYY-MM-DD`);
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new ApiError('BAD_REQUEST', `${field} is not a valid date`);
  }
  return value;
}

function inclusiveDays(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS,
  ) + 1;
}

export const GET = withErrorHandling('affiliate.summary', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);

  if (!affiliate) {
    throw new ApiError('AFFILIATE_NOT_FOUND', 'No affiliate account is linked to this user');
  }

  const params = searchParams(request);
  const from = parseDate(params.get('from'), 'from');
  const to = parseDate(params.get('to'), 'to');

  if (!from || !to) {
    throw new ApiError('BAD_REQUEST', 'from and to are required');
  }

  if (from > to) {
    throw new ApiError('BAD_REQUEST', 'from must be before or equal to to');
  }

  const days = inclusiveDays(from, to);

  if (days < 1 || days > MAX_DAYS) {
    throw new ApiError('BAD_REQUEST', 'Summary range must be between 1 day and 1 year');
  }

  const start = `${from}T00:00:00.000Z`;
  const end = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY_MS).toISOString();

  const [stats, betRows] = await Promise.all([
    services.affiliate.getStats(affiliate.id, { start, end }),
    services.db.query<Record<string, unknown>>(
      `select count(*) filter (
         where b.status in ('settled','void','partially_settled','cashed_out')
       ) as settled_bets
       from nova.bets b
       where b.user_id in (
         select distinct a.user_id
         from nova.affiliate_attributions a
         where a.affiliate_id = $1
       )
       and b.placed_at >= $2
       and b.placed_at < $3`,
      [affiliate.id, start, end],
    ),
  ]);
  const settledBets = Number(betRows[0]?.settled_bets ?? 0);

  return jsonOk({
    period: { from, to, days },
    summary: {
      clicks: stats.clicks,
      users: stats.registrations,
      registrations: stats.registrations,
      firstDeposits: stats.firstDeposits,
      activeUsers: stats.activeUsers,
      withdrawals: stats.withdrawals,
      totalDepositMinor: stats.totalDepositMinor,
      totalWithdrawalMinor: stats.totalWithdrawalMinor,
      netDepositMinor: stats.totalDepositMinor - stats.totalWithdrawalMinor,
      settledBets,
      turnoverMinor: stats.wageredMinor,
      playerNetResultMinor: stats.playerNetResultMinor,
      commissionMinor: stats.commissionMinor,
      panelShareMinor: stats.panelShareMinor,
      currency: stats.currency,
    },
  });
});
