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
  // A referred user can have USD, IRR and IRT transactions. Never label
  // mixed minor-unit sums with the affiliate's payout currency.
  // Group underlying, already recorded transactions by their *own* currency.
  const financialRows = ids.length
    ? await services.db.query<{
        user_id: string;
        currency: string;
        deposit_minor: string;
        withdrawal_minor: string;
        wagered_minor: string;
        player_net_minor: string;
        ledger_minor: string;
      }>(
        `with money_rows as (
          select p.user_id, p.currency,
                 coalesce(sum(p.amount_minor) filter
                   (where p.type = 'deposit' and p.status = 'succeeded'), 0) deposit_minor,
                 coalesce(sum(p.amount_minor) filter
                   (where p.type = 'withdrawal' and p.status = 'succeeded'), 0) withdrawal_minor,
                 0::numeric wagered_minor, 0::numeric player_net_minor,
                 0::numeric ledger_minor
            from nova.payment_transactions p
           where p.user_id = any($2::uuid[])
           group by p.user_id, p.currency
          union all
          select b.user_id, b.currency, 0::numeric, 0::numeric,
                 coalesce(sum(b.stake_minor),0),
                 coalesce(sum(case
                   when b.status in ('settled','partially_settled','cashed_out')
                   then b.payout_minor-b.stake_minor else 0 end),0),
                 0::numeric
            from nova.bets b
           where b.user_id = any($2::uuid[])
           group by b.user_id, b.currency
          union all
          select l.user_id, l.currency, 0::numeric, 0::numeric, 0::numeric,
                 0::numeric, coalesce(sum(l.amount_minor),0)
            from nova.affiliate_ledger l
           where l.affiliate_id = $1 and l.user_id = any($2::uuid[])
           group by l.user_id, l.currency
        )
        select user_id, currency,
               sum(deposit_minor)::text as deposit_minor,
               sum(withdrawal_minor)::text as withdrawal_minor,
               sum(wagered_minor)::text as wagered_minor,
               sum(player_net_minor)::text as player_net_minor,
               sum(ledger_minor)::text as ledger_minor
          from money_rows
         where currency is not null
         group by user_id, currency
         order by user_id, currency`,
        [affiliate.id, ids],
      )
    : [];
  const byUser = new Map<string, typeof financialRows>();
  for (const row of financialRows) {
    const userId = String(row.user_id);
    const entry = byUser.get(userId) ?? [];
    entry.push(row);
    byUser.set(userId, entry);
  }
  const [statuses] = await services.db.query<{
    total: string; confirmed: string; review: string; pending: string;
  }>(
    `select count(*)::text total,
            count(*) filter(where status='confirmed')::text confirmed,
            count(*) filter(where status='review')::text review,
            count(*) filter(where status='pending')::text pending
       from nova.affiliate_attributions where affiliate_id=$1`,
    [affiliate.id],
  );
  const fraud = await services.affiliate.fraudSignals(affiliate.id);
  return jsonOk({
    statusCounts: {
      total: Number(statuses?.total ?? page.total),
      confirmed: Number(statuses?.confirmed ?? 0),
      review: Number(statuses?.review ?? 0),
      pending: Number(statuses?.pending ?? 0),
    },
    ...page,
    items: page.items.map((entry) => ({
      ...entry,
      registeredAt: registeredAt.get(entry.userId) ?? null,
      financialByCurrency: (byUser.get(entry.userId) ?? []).map((row) => ({
        currency: String(row.currency),
        depositMinor: String(row.deposit_minor),
        withdrawalMinor: String(row.withdrawal_minor),
        wageredMinor: String(row.wagered_minor),
        playerNetMinor: String(row.player_net_minor),
        ledgerMinor: String(row.ledger_minor),
        hasDeposited: BigInt(String(row.deposit_minor)) > 0n,
      })),
    })),
    fraud,
  });
});
