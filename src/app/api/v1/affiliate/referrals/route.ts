import { withErrorHandling, jsonOk, ApiError } from '@/lib/errors';
import { withAffiliate } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';
import { referralDateRange } from '@/lib/affiliate/referral-date-range';

export const dynamic = 'force-dynamic';

/**
 * Server-authoritative affiliate report. Always scopes *every* query to the
 * logged-in affiliate and never exposes players' email, phone or IP.
 *
 * Registration status (review/confirmed) is independent of acquisition counts.
 * Financial amounts remain in the transaction's native currency: no fake totals
 * calculated by adding USD and IRR minor units.
 */
const moneySql = `
  with payment_rows as (
    select p.user_id, p.currency,
      coalesce(sum(p.amount_minor) filter(where p.type='deposit'),0)::numeric as deposits,
      coalesce(sum(p.amount_minor) filter(where p.type='withdrawal'),0)::numeric as withdrawals,
      0::numeric as wagered, 0::numeric as player_net,
      0::numeric as commission
    from nova.payment_transactions p
    join nova.affiliate_attributions a on a.user_id=p.user_id
    where a.affiliate_id=$1
      and ($5::uuid[] is null or p.user_id=any($5::uuid[]))
      and p.status='succeeded'
      and ($2::text is null or (p.completed_at >= ($2::date::timestamp at time zone $4)
                           and p.completed_at < (($3::date + 1)::timestamp at time zone $4)))
    group by p.user_id,p.currency
  ),
  bet_rows as (
    select b.user_id,b.currency,
      0::numeric as deposits,0::numeric as withdrawals,
      coalesce(sum(b.stake_minor) filter(where
        $2::text is null or (b.placed_at >= ($2::date::timestamp at time zone $4)
                         and b.placed_at < (($3::date + 1)::timestamp at time zone $4))
      ),0)::numeric as wagered,
      coalesce(sum(b.payout_minor-b.stake_minor) filter(where
        b.status in ('settled','partially_settled','cashed_out')
        and ($2::text is null or (coalesce(b.settled_at,b.placed_at) >= ($2::date::timestamp at time zone $4)
                              and coalesce(b.settled_at,b.placed_at) < (($3::date + 1)::timestamp at time zone $4)))
      ),0)::numeric as player_net,
      0::numeric as commission
    from nova.bets b
    join nova.affiliate_attributions a on a.user_id=b.user_id
    where a.affiliate_id=$1
      and ($5::uuid[] is null or b.user_id=any($5::uuid[]))
    group by b.user_id,b.currency
  ),
  commission_rows as (
    select l.user_id,l.currency,
      0::numeric as deposits,0::numeric as withdrawals,
      0::numeric as wagered,0::numeric as player_net,
      coalesce(sum(l.amount_minor),0)::numeric as commission
    from nova.affiliate_ledger l
    join nova.affiliate_attributions a on a.user_id=l.user_id
       and a.affiliate_id=l.affiliate_id
    where l.affiliate_id=$1
      and ($5::uuid[] is null or l.user_id=any($5::uuid[]))
      and l.type in ('user_loss_commission','adjustment','carry_forward_release')
      and ($2::text is null or (l.created_at >= ($2::date::timestamp at time zone $4)
                           and l.created_at < (($3::date + 1)::timestamp at time zone $4)))
    group by l.user_id,l.currency
  ),
  money as (
    select * from payment_rows
    union all select * from bet_rows
    union all select * from commission_rows
  )
  select user_id,currency,
         sum(deposits)::text as deposit_minor,
         sum(withdrawals)::text as withdrawal_minor,
         sum(wagered)::text as wagered_minor,
         sum(player_net)::text as player_net_minor,
         sum(commission)::text as ledger_minor
    from money
   where currency is not null
   group by user_id,currency
   order by user_id,currency
`;

type MoneyRow = {
  user_id: string; currency: string;
  deposit_minor: string; withdrawal_minor: string;
  wagered_minor: string; player_net_minor: string; ledger_minor: string;
};

function moneyMap(rows: MoneyRow[]) {
  const result = new Map<string, Array<{
    currency: string; depositMinor: string; withdrawalMinor: string;
    wageredMinor: string; playerNetMinor: string; ledgerMinor: string;
    hasDeposited: boolean;
  }>>();
  for (const r of rows) {
    const id = String(r.user_id);
    const items = result.get(id) ?? [];
    items.push({
      currency: r.currency,
      depositMinor: r.deposit_minor,
      withdrawalMinor: r.withdrawal_minor,
      wageredMinor: r.wagered_minor,
      playerNetMinor: r.player_net_minor,
      ledgerMinor: r.ledger_minor,
      hasDeposited: BigInt(r.deposit_minor) > 0n,
    });
    result.set(id,items);
  }
  return result;
}

export const GET = withErrorHandling('affiliate.referrals', async (ctx, request: Request) => {
  const { services, user } = await withAffiliate(request, ctx);
  const affiliate = await services.affiliate.getByUserId(user.id);
  if (!affiliate) throw new ApiError('AFFILIATE_NOT_FOUND');

  const params = searchParams(request);
  const { from, to, timezone } = referralDateRange(
    params.get('from'), params.get('to'), affiliate.settlementTimezone || 'Asia/Tehran',
  );
  const page = intParam(params, 'page', 1, 1000);
  const pageSize = intParam(params, 'pageSize', 20, 100);
  const offset = (page - 1) * pageSize;
  const registeredOnly = params.get('registeredOnly') === 'true';

  const [counts, pageRows, periodMoney] = await Promise.all([
    services.db.queryOne<{
      total: string; confirmed: string; review: string; pending: string; registered_in_period: string;
    }>(`
      select count(*)::text total,
        count(*) filter(where status='confirmed')::text confirmed,
        count(*) filter(where status='review')::text review,
        count(*) filter(where status='pending')::text pending,
        count(*) filter(where (created_at at time zone $2)::date between $3::date and $4::date)::text registered_in_period
      from nova.affiliate_attributions
      where affiliate_id=$1
    `, [affiliate.id,timezone,from,to]),
    services.db.query<{
      user_id: string; code: string; status: string;
      registered_at: string; confirmed_at: string|null;
      public_id: string|null; numeric_id: string|null;
    }>(`
      select at.user_id,at.code,at.status::text status,
             at.created_at as registered_at,at.confirmed_at,
             p.public_id,p.numeric_id::text numeric_id
        from nova.affiliate_attributions at
        left join nova.profiles p on p.id=at.user_id
       where at.affiliate_id=$1
         and (not $5::boolean or (at.created_at at time zone $2)::date between $3::date and $4::date)
       order by at.created_at desc,at.user_id desc
       limit $6 offset $7
    `,[affiliate.id,timezone,from,to,registeredOnly,pageSize,offset]),
    services.db.query<MoneyRow>(moneySql,[affiliate.id,from,to,timezone,null]),
  ]);

  const ids = pageRows.map(row => row.user_id);
  const [lifetimeMoney, registeredPageCount] = await Promise.all([
    ids.length ? services.db.query<MoneyRow>(moneySql,[affiliate.id,null,null,timezone,ids]) : Promise.resolve([]),
    registeredOnly ? services.db.queryOne<{total:string}>(`
      select count(*)::text total from nova.affiliate_attributions
      where affiliate_id=$1 and (created_at at time zone $2)::date between $3::date and $4::date
    `,[affiliate.id,timezone,from,to]) : Promise.resolve(null),
  ]);

  const periodByUser = moneyMap(periodMoney);
  const lifetimeByUser = moneyMap(lifetimeMoney);
  const summaryByCurrency = new Map<string, {
    currency:string; depositMinor:bigint; withdrawalMinor:bigint; wageredMinor:bigint;
    playerNetMinor:bigint; ledgerMinor:bigint; depositingUsers:number;
  }>();
  for (const r of periodMoney) {
    const currency = String(r.currency);
    const prior = summaryByCurrency.get(currency) ?? {
      currency,depositMinor:0n,withdrawalMinor:0n,wageredMinor:0n,
      playerNetMinor:0n,ledgerMinor:0n,depositingUsers:0,
    };
    prior.depositMinor += BigInt(r.deposit_minor);
    prior.withdrawalMinor += BigInt(r.withdrawal_minor);
    prior.wageredMinor += BigInt(r.wagered_minor);
    prior.playerNetMinor += BigInt(r.player_net_minor);
    prior.ledgerMinor += BigInt(r.ledger_minor);
    if(BigInt(r.deposit_minor) > 0n) prior.depositingUsers++;
    summaryByCurrency.set(currency,prior);
  }

  const total = Number(counts?.total ?? 0);
  const filteredTotal = registeredOnly ? Number(registeredPageCount?.total ?? 0) : total;
  const summary = Array.from(summaryByCurrency.values()).map(item=>({
    ...item,
    depositMinor:item.depositMinor.toString(),
    withdrawalMinor:item.withdrawalMinor.toString(),
    wageredMinor:item.wageredMinor.toString(),
    playerNetMinor:item.playerNetMinor.toString(),
    ledgerMinor:item.ledgerMinor.toString(),
  }));

  return jsonOk({
    statusCounts:{
      total,
      confirmed:Number(counts?.confirmed ?? 0),
      review:Number(counts?.review ?? 0),
      pending:Number(counts?.pending ?? 0),
    },
    period:{from,to,timezone,registeredOnly},
    periodSummary:{
      registrations:Number(counts?.registered_in_period ?? 0),
      byCurrency:summary,
    },
    total:filteredTotal,
    allTimeTotal:total,
    page,pageSize,hasMore:page*pageSize<filteredTotal,
    items:pageRows.map(row=>({
      userId:row.user_id,
      numericId:row.numeric_id,
      publicId:row.public_id,
      code:row.code,
      status:row.status,
      registeredAt:new Date(row.registered_at).toISOString(),
      confirmedAt:row.confirmed_at ? new Date(row.confirmed_at).toISOString():null,
      financialByCurrency:lifetimeByUser.get(row.user_id)??[],
      periodFinancialByCurrency:periodByUser.get(row.user_id)??[],
    })),
  },{headers:{'cache-control':'private, no-store'}});
});
