import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { searchParams, intParam } from '@/server/http/request';
import type { BonusStatus, Currency } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: BonusStatus[] = [
  'active',
  'locked',
  'won',
  'lost',
  'expired',
  'cancelled',
];

export const GET = withErrorHandling('bonuses.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const params = searchParams(request);
  const currency = (params.get('currency') ?? user.currency) as Currency;
  const rawStatus = params.get('status');
  const status = rawStatus && STATUSES.includes(rawStatus as BonusStatus)
    ? rawStatus as BonusStatus
    : undefined;

  const result = await services.bonuses.listGrants(user.id, {
    currency,
    status,
    page: intParam(params, 'page', 1, 1000),
    pageSize: intParam(params, 'pageSize', 100, 100),
  });

  return jsonOk({
    promotion: result.promotion,
    summary: {
      total: result.summary.total,
      active: result.summary.active,
      locked: result.summary.locked,
      won: result.summary.won,
      lost: result.summary.lost,
      expired: result.summary.expired,
      cancelled: result.summary.cancelled,
      activeAmountMinor: result.summary.activeAmountMinor.toString(),
      lockedAmountMinor: result.summary.lockedAmountMinor.toString(),
    },
    items: result.items.map((item) => ({
      id: item.id,
      promotionId: item.promotionId,
      promotionKey: item.promotionKey,
      title: item.title,
      description: item.description,
      depositPaymentTransactionId: item.depositPaymentTransactionId,
      currency: item.currency,
      amountMinor: item.amountMinor.toString(),
      remainingAmountMinor: item.remainingAmountMinor.toString(),
      status: item.status,
      grantedAt: item.grantedAt,
      expiresAt: item.expiresAt,
      lockedAt: item.lockedAt,
      usedAt: item.usedAt,
      betId: item.betId,
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
  });
});
