import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { searchParams, intParam } from '@/server/http/request';
import type { Currency } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Wallet summary + paginated statement. The ledger sum is asserted by the database. */
export const GET = withErrorHandling('wallet.get', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const params = searchParams(request);
  const currency = (params.get('currency') ?? user.currency) as Currency;

  const [statement, payments] = await Promise.all([
    services.wallet.listEntries(actor, user.id, {
      currency,
      type: params.get('type') ?? undefined,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      page: intParam(params, 'page', 1, 1000),
      pageSize: intParam(params, 'pageSize', 25, 100),
    }),
    services.payments.listIntents({
      userId: user.id,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      page: 1,
      pageSize: 100,
    }),
  ]);

  const paymentItems = payments.items
    .filter((item) => item.currency === currency)
    .map((item) => ({
      id: item.id,
      publicId: item.publicId,
      direction: item.direction,
      status: item.status,
      amountMinor: item.amountMinor.toString(),
      currency: item.currency,
      providerReference: item.providerReference,
      failureCode: item.failureCode,
      failureMessage: item.failureMessage,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    }));

  const availableMinor =
    BigInt(statement.wallet.balanceMinor) - BigInt(statement.wallet.heldMinor);

  return jsonOk({
    wallet: {
      ...statement.wallet,
      availableMinor: (availableMinor > 0n ? availableMinor : 0n).toString(),
    },
    integrity:
      statement.wallet.balanceMinor === statement.totals.netMinor
        ? 'ok'
        : 'mismatch',
    transactions: {
      items: statement.entries,
      totals: statement.totals,
      page: statement.page,
      pageSize: statement.pageSize,
      hasMore: statement.hasMore,
    },
    payments: {
      items: paymentItems,
      page: payments.page,
      pageSize: payments.pageSize,
      hasMore: payments.hasMore,
    },
  });
});
