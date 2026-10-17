import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson, idempotencyKeyFrom, intParam, searchParams } from '@/server/http/request';
import { withAffiliate } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amountMinor: z.string().regex(/^\d{1,19}$/),
  method: z.literal('crypto'),
  payoutAsset: z.enum(['USDT_TRC20', 'TRX', 'DOGE']),
});

export const GET = withErrorHandling('affiliate.payouts.list', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const params = searchParams(request);
  const payouts = await services.affiliate.listPayouts({
    affiliateId: affiliate.id,
    page: intParam(params, 'page', 1, 1000),
    pageSize: intParam(params, 'pageSize', 50, 100),
  });
  const payable = await services.affiliate.payableBalance(affiliate.id);
  return jsonOk({
    ...payouts,
    items: payouts.items.map((payout) => ({
      ...payout,
      destinationAddress: undefined,
    })),
    payable,
  });
});

/** Payout request. Minimum threshold, payable balance and dual approval are DB-enforced. */
export const POST = withErrorHandling('affiliate.payouts.request', async (ctx, request: Request) => {
  const { services, user, actor } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const idempotencyKey = idempotencyKeyFrom(request);
  const body = await readJson(request, schema, ctx);
  const payout = await services.affiliate.requestPayout({
    affiliateId: affiliate.id, amountMinor: body.amountMinor, currency: affiliate.currency,
    method: body.method, payoutAsset: body.payoutAsset, idempotencyKey,
  });
  await services.admin.writeAudit({
    actorId: user.id, action: 'affiliate.payout_requested', entityType: 'affiliate_payout', entityId: payout.id,
    after: { amountMinor: body.amountMinor, method: body.method, payoutAsset: body.payoutAsset }, reason: 'affiliate self-service payout request',
    correlationId: actor.correlationId,
  });
  return jsonCreated({ payout });
});
