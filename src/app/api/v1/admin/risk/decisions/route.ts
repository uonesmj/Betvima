import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';
import { getAdminUsdRates, convertAdminAmountToUsd } from '@/server/utils/admin-usd';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.risk.decisions', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'risk.view');
  const params = searchParams(request);
  const pageSize = intParam(params, 'pageSize', 25, 100);
  const page = intParam(params, 'page', 1, 5000);
  const rows = await services.db.query<Record<string, unknown>>(
    `select d.*, p.email as user_email from nova.risk_decisions d
       left join nova.profiles p on p.id = d.user_id
      where ($1::text is null or d.decision = $1) and ($2::uuid is null or d.user_id = $2)
      order by d.created_at desc limit $3 offset $4`,
    [params.get('decision'), params.get('userId'), pageSize, (page - 1) * pageSize],
  );
  const currencies = rows
    .map((row) => typeof row.currency === 'string' ? row.currency : null)
    .filter((currency): currency is string => Boolean(currency));
  const rates = await getAdminUsdRates(currencies);

  const items = rows.map((row) => {
    const currency = typeof row.currency === 'string' ? row.currency : null;
    const stakeMinor = row.stake_minor == null ? null : BigInt(String(row.stake_minor));
    const payoutMinor = row.payout_minor == null ? null : BigInt(String(row.payout_minor));

    return {
      ...row,
      usdStakeMinor:
        stakeMinor === null || !currency
          ? null
          : convertAdminAmountToUsd(stakeMinor, currency, rates).toString(),
      usdPayoutMinor:
        payoutMinor === null || !currency
          ? null
          : convertAdminAmountToUsd(payoutMinor, currency, rates).toString(),
      ruleKey:
        Array.isArray(row.rule_ids)
          ? row.rule_ids.join(', ')
          : row.rule_ids == null
            ? null
            : String(row.rule_ids),
      reason:
        Array.isArray(row.reasons)
          ? row.reasons.join(', ')
          : row.reasons == null
            ? null
            : String(row.reasons),
    };
  });

  return jsonOk({ items, page, pageSize });
});
