import { withErrorHandling, jsonOk } from '@/lib/errors';
import { convertAdminAmountToUsd, getAdminUsdRates } from '@/server/utils/admin-usd';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.payments.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'payments.view');
  const params = searchParams(request);
  const page = await services.payments.listIntents({
    direction: (params.get('direction') as 'deposit' | 'withdrawal') ?? undefined,
    status: params.get('status') ?? undefined,
    from: params.get('from') ?? undefined, to: params.get('to') ?? undefined,
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  const rates = await getAdminUsdRates(page.items.map((row) => row.currency ?? 'USD'));
  return jsonOk({ ...page, items: page.items.map((row) => { const currency = row.currency ?? 'USD'; return { ...row, usdAmountMinor: convertAdminAmountToUsd(row.amountMinor, currency, rates)?.toString() ?? null, usdFeeMinor: convertAdminAmountToUsd(row.feeMinor, currency, rates)?.toString() ?? null, usdNetAmountMinor: convertAdminAmountToUsd(row.netAmountMinor, currency, rates)?.toString() ?? null }; }) });
});
