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
  const ids = page.items.map((entry) => entry.userId);
  // Return registration timestamps only for users actually attributed to
  // this authorized affiliate. Do not expose email, phone, IP, or documents.
  const timestamps = ids.length
    ? await services.db.query<{ id: string; registered_at: string | null }>(
        `select p.id, p.created_at as registered_at
           from nova.profiles p
           join nova.affiliate_attributions a on a.user_id = p.id
          where a.affiliate_id = $1
            and p.id = any($2::uuid[])`,
        [affiliate.id, ids],
      )
    : [];
  const registeredAt = new Map(timestamps.map((row) => [
    String(row.id), row.registered_at ? new Date(row.registered_at).toISOString() : null,
  ]));
  const fraud = await services.affiliate.fraudSignals(affiliate.id);
  return jsonOk({
    ...page,
    items: page.items.map((entry) => ({
      ...entry,
      registeredAt: registeredAt.get(entry.userId) ?? null,
    })),
    fraud,
  });
});
