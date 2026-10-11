import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { idempotencyKeyFrom } from '@/server/http/request';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

/** Cash-out quote for a specific bet. Feature-flagged; returns FEATURE_DISABLED when off. */
export const GET = withErrorHandling('bets.cashout.quote', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withUser(request, ctx);
  const quote = await services.bettingService.cashoutQuote({ actor, userId: user.id, betId: id });
  return jsonOk({
    quote: {
      ...quote,
      offerMinor: quote.offerMinor === null ? null : quote.offerMinor.toString(),
      originalStakeMinor: quote.originalStakeMinor.toString(),
      potentialPayoutMinor: quote.potentialPayoutMinor.toString(),
    },
  });
});

export const POST = withErrorHandling('bets.cashout.accept', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withUser(request, ctx);
  const idempotencyKey = idempotencyKeyFrom(request);
  const url = new URL(request.url);
  const quoteId = url.searchParams.get('quoteId');
  if (!quoteId) throw new ApiError('VALIDATION_FAILED', 'quoteId query parameter is required');
  const result = await services.bettingService.acceptCashout({
    actor, userId: user.id, betId: id, quoteId, idempotencyKey,
  });
  return jsonOk({
    cashout: {
      betId: result.betId, offerMinor: result.offerMinor.toString(),
      balanceAfterMinor: result.balanceAfterMinor.toString(), idempotentReplay: result.replay,
    },
  });
});
