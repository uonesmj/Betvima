import { withErrorHandling, jsonOk } from '@/lib/errors';
import { convertAdminAmountToUsd, getAdminUsdRates } from '@/server/utils/admin-usd';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.affiliate_payouts.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'affiliates.view');
  const params = searchParams(request);
  const page = await services.affiliate.listPayouts({
    affiliateId: params.get('affiliateId') ?? undefined,
    status: params.get('status') ?? undefined,
    from: params.get('from') ?? undefined, to: params.get('to') ?? undefined,
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  const rates = await getAdminUsdRates(page.items.map((row) => row.currency));
  return jsonOk({ ...page, items: page.items.map((row) => ({ ...row, usdAmountMinor: convertAdminAmountToUsd(row.amountMinor, row.currency, rates)?.toString() ?? null, usdPayableAtRequestMinor: convertAdminAmountToUsd(row.payableAtRequestMinor, row.currency, rates)?.toString() ?? null })) });
});
