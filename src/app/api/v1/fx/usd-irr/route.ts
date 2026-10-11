import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { getUsdIrtRate } from '@/server/providers/arzhaam/client';

export const dynamic = 'force-dynamic';

let cachedRate: { value: string; timestamp: string | null; expiresAt: number } | null = null;

export const GET = withErrorHandling('fx.usdIrr', async (ctx, request: Request) => {
  await withUser(request, ctx);

  const now = Date.now();
  if (cachedRate && cachedRate.expiresAt > now) {
    return jsonOk({
      symbol: 'usd',
      value: cachedRate.value,
      timestamp: cachedRate.timestamp,
      cached: true,
    });
  }

  const rate = await getUsdIrtRate();

  cachedRate = {
    value: rate.value,
    timestamp: rate.timestamp,
    expiresAt: now + 30_000,
  };

  return jsonOk({
    symbol: 'usd',
    value: rate.value,
    timestamp: rate.timestamp,
    cached: false,
  });
});
