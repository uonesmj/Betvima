import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { syncVipHistoricalFx } from '@/server/providers/arzhaam/history';

export const dynamic = 'force-dynamic';

/** Finance-only rate refresh. The authoritative price is fetched server-side. */
export const POST = withErrorHandling('admin.vip_cashback.fx_sync', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'reconciliation.run');
  // Cookie-based sessions require same-origin for a database-mutating request.
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host ||
      new URL(origin).protocol !== 'https:') {
    throw new Error('VIP_FX_SAME_ORIGIN_REQUIRED');
  }
  const result = await syncVipHistoricalFx(services.db, '30d');
  return jsonOk({ ...result, asset: 'usd', unit: 'toman', walletCredits: 0 });
});
