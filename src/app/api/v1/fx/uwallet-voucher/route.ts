import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { getUwalletVoucherIrrPerUsd } from '@/server/providers/uwallet/voucher-fx';
import { signUwalletVoucherQuote } from '@/server/providers/uwallet/voucher-quote';

export const dynamic = 'force-dynamic';

// Informational one-way UUSD -> HotVoucher reference quote. This is NOT a
// provider bid/ask guarantee; withdrawal is revalidated server-side.
export const GET = withErrorHandling('fx.uwalletVoucher', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  const rateIrrPerUsd = await getUwalletVoucherIrrPerUsd();
  const quotedAt = new Date().toISOString();
  const signature = signUwalletVoucherQuote(user.id, rateIrrPerUsd, quotedAt);
  return jsonOk({
    source: 'uwallet',
    quoteType: 'UUSD_TO_HOTVOUCHER_REFERENCE',
    rateIrrPerUsd,
    quotedAt,
    signature,
    distinctBuySellRatesAvailable: false,
    minimumWithdrawalUsd: '1.50',
  });
});
