import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { section, type DegradedSection } from '@/server/http/degrade';
import { convertAdminAmountToUsd, getAdminUsdRates } from '@/server/utils/admin-usd';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.bets.get', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services } = await withAdmin(request, ctx, 'bets.view');
  const bet = await services.betting.getBet({ userId: null, role: 'service_role', adminId: null, ip: null, userAgent: null, correlationId: null }, id, null);
  if (!bet) throw new ApiError('BET_NOT_FOUND');
  const degraded: DegradedSection[] = [];
  const [settlements, events, risk] = await Promise.all([
    section('settlements', degraded, () => services.db.query<Record<string, unknown>>(
      `select * from nova.bet_settlements where bet_id = $1 order by revision`, [id]), [], ctx.correlationId),
    section('settlement_events', degraded, () => services.db.query<Record<string, unknown>>(
      `select * from nova.settlement_events where bet_id = $1 order by created_at`, [id]), [], ctx.correlationId),
    section('risk_decisions', degraded, () => services.db.query<Record<string, unknown>>(
      `select * from nova.risk_decisions where bet_id = $1 order by created_at desc limit 5`, [id]), [], ctx.correlationId),
  ]);
  const currencies = [
    typeof (bet as unknown as { currency?: unknown }).currency === 'string'
      ? (bet as unknown as { currency: string }).currency
      : null,
    ...settlements.map((row) => typeof row.currency === 'string' ? row.currency : null),
  ].filter((currency): currency is string => Boolean(currency));

  const rates = await getAdminUsdRates(currencies);
  const betCurrency =
    typeof (bet as unknown as { currency?: unknown }).currency === 'string'
      ? (bet as unknown as { currency: string }).currency
      : null;

  const projectedBet = {
    ...bet,
    usdStakeMinor:
      betCurrency
        ? convertAdminAmountToUsd(bet.stakeMinor, betCurrency, rates)?.toString() ?? null
        : null,
    usdPotentialPayoutMinor:
      betCurrency
        ? convertAdminAmountToUsd(bet.potentialPayoutMinor, betCurrency, rates)?.toString() ?? null
        : null,
    usdSettledPayoutMinor:
      bet.settledPayoutMinor === null
        ? null
        : betCurrency
          ? convertAdminAmountToUsd(bet.settledPayoutMinor, betCurrency, rates)?.toString() ?? null
          : null,
    usdNetResultMinor:
      bet.netResultMinor === null
        ? null
        : betCurrency
          ? convertAdminAmountToUsd(bet.netResultMinor, betCurrency, rates)?.toString() ?? null
          : null,
  };

  const projectedSettlements = settlements.map((row) => {
    const currency = typeof row.currency === 'string' ? row.currency : null;
    const payoutMinor = row.payout_minor == null ? null : BigInt(String(row.payout_minor));
    const netMinor = row.net_user_result_minor == null ? null : BigInt(String(row.net_user_result_minor));

    return {
      ...row,
      usdSettledPayoutMinor:
        payoutMinor === null || !currency
          ? null
          : convertAdminAmountToUsd(payoutMinor, currency, rates)?.toString() ?? null,
      usdNetUserResultMinor:
        netMinor === null || !currency
          ? null
          : convertAdminAmountToUsd(netMinor, currency, rates)?.toString() ?? null,
    };
  });

  return jsonOk({
    bet: projectedBet,
    settlements: projectedSettlements,
    events,
    riskDecisions: risk,
    degraded,
  });
});
