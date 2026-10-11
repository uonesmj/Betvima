import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAffiliate } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('affiliate.ledger', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const params = searchParams(request);
  const page = await services.affiliate.listLedger(affiliate.id, {
    from: params.get('from') ?? undefined, to: params.get('to') ?? undefined,
    type: params.get('type') ?? undefined,
    page: intParam(params, 'page', 1, 1000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  return jsonOk({
    ...page,
    items: page.items.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amountMinor: entry.amountMinor.toString(),
      direction: entry.amountMinor < 0n ? 'debit' : 'credit',
      status: 'posted',
      appliedRateBps: null,
      sourceKind: entry.betId ? 'bet' : entry.payoutId ? 'payout' : entry.settlementId ? 'settlement' : null,
      userId: entry.sourceUserId,
      createdAt: entry.createdAt,
      reason: entry.description,
    })),
  });
});
