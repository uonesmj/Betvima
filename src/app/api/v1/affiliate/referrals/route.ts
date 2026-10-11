import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAffiliate } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('affiliate.referrals', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');
  const params = searchParams(request);
  const page = await services.affiliate.listReferrals(affiliate.id, {
    page: intParam(params, 'page', 1, 1000), pageSize: intParam(params, 'pageSize', 25, 100),
  });
  const fraud = await services.affiliate.fraudSignals(affiliate.id);
  return jsonOk({ ...page, fraud });
});
