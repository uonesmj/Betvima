import { withErrorHandling, jsonOk } from '@/lib/errors';
import { convertAdminAmountToUsd, getAdminUsdRates } from '@/server/utils/admin-usd';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';
import type { CommissionModel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.affiliates.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'affiliates.view');
  const params = searchParams(request);
  const page = await services.affiliate.listForAdmin({
    search: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    model: (params.get('model') as CommissionModel) ?? undefined,
    flaggedOnly: params.get('flagged') === 'true',
    page: intParam(params, 'page', 1, 5000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  const rates = await getAdminUsdRates(page.items.map((row) => row.currency));
  return jsonOk({ ...page, items: page.items.map((row) => ({ ...row, usdPayableMinor: convertAdminAmountToUsd(row.payableMinor, row.currency, rates)?.toString() ?? null, usdCarryForwardMinor: convertAdminAmountToUsd(row.carryForwardMinor, row.currency, rates)?.toString() ?? null, usdSuppressedMinor: convertAdminAmountToUsd(row.suppressedMinor, row.currency, rates)?.toString() ?? null })) });
});
