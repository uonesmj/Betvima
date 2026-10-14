-- 0202: historical USD/toman FX evidence for VIP cashback, with fail-closed coverage.
-- NO CASHBACK PAYOUTS ENABLED BY THIS MIGRATION.
begin;

create table if not exists nova.vip_cashback_fx_rates (
  id uuid primary key default gen_random_uuid(),
  asset text not null default 'usd' check (asset='usd'),
  source text not null default 'arzhaam_history' check (source='arzhaam_history'),
  sampled_at timestamptz not null,
  price_toman_per_usd numeric(24,6) not null check(price_toman_per_usd > 0),
  fetched_at timestamptz not null default clock_timestamp(),
  range_requested text not null check(range_requested in ('24h','7d','30d','90d')),
  source_payload_hash text not null check(source_payload_hash ~ '^[a-f0-9]{64}$'),
  unique (asset,source,sampled_at),
  check (sampled_at <= fetched_at + interval '1 minute')
);
create index if not exists vip_cb_fx_time on nova.vip_cashback_fx_rates(sampled_at desc);
drop trigger if exists vip_cb_fx_immutable on nova.vip_cashback_fx_rates;
create trigger vip_cb_fx_immutable before update or delete on nova.vip_cashback_fx_rates
for each row execute function nova.prevent_mutation();

alter table nova.vip_cashback_fx_rates enable row level security;
revoke all on nova.vip_cashback_fx_rates from public,anon,authenticated;
grant select,insert on nova.vip_cashback_fx_rates to service_role;

-- Signed monetary values use exact numeric integer arithmetic, HALF_UP.
-- IRR has 0 decimals (1 minor = 1 rial), IRT has 0 decimals (1 minor = 1 toman).
-- USD has 2 decimals. Arzhaam quotes TOMAN per USD.
-- Thus USD cents = IRR * 10 / toman_per_USD; IRT * 100 / toman_per_USD.
create or replace function nova.vip_cb_fx_convert(
  p_amount bigint, p_currency text, p_at timestamptz
) returns table(usd_minor bigint, fx_rate_id uuid)
language sql stable security definer set search_path=nova,public
as $$
  select
    case when p_currency='USD' then p_amount
         when r.id is null then null::bigint
         when p_currency='IRR' then nova.round_div(p_amount::numeric*10,r.price_toman_per_usd)
         when p_currency='IRT' then nova.round_div(p_amount::numeric*100,r.price_toman_per_usd)
         else null::bigint end as usd_minor,
    case when p_currency='USD' then null::uuid else r.id end as fx_rate_id
  from (select 1) anchor
  left join lateral (
    select id,price_toman_per_usd
    from nova.vip_cashback_fx_rates
    where p_currency in ('IRR','IRT')
      and asset='usd' and source='arzhaam_history'
      and sampled_at <= p_at
      and sampled_at >= p_at - interval '90 minutes'
    order by sampled_at desc limit 1
  ) r on true
$$;

-- A single normalized activity stream is shared by quote, FX auditing and
-- blocked-user detection. Only final, nonreversed settlement revisions count.
create or replace function nova.vip_cb_activities(p_week_start date)
returns table(
  user_id uuid,source_id uuid,source_kind text,
  source_amount_minor bigint,source_currency text,effective_at timestamptz,
  usd_minor bigint,fx_rate_id uuid
)
language sql stable security definer set search_path=nova,public
as $$
  with bounds as (
    select (p_week_start::timestamp at time zone 'Asia/Tehran') as starts_at,
      ((p_week_start+7)::timestamp at time zone 'Asia/Tehran') as ends_at
  ),
  original as (
    select p.user_id,p.id source_id,'deposit'::text source_kind,
           wt.amount_minor as source_amount_minor,p.currency::text source_currency,
           p.completed_at effective_at
    from nova.payment_transactions p
    join nova.wallet_transactions wt on wt.id=p.wallet_transaction_id
      and wt.user_id=p.user_id
      and wt.status='posted' and wt.type='deposit'
      and wt.currency=p.currency and wt.amount_minor>0
    cross join bounds
    where p.type='deposit' and p.status='succeeded'
      and p.completed_at>=bounds.starts_at and p.completed_at<bounds.ends_at
      and not exists (
        select 1 from nova.wallet_transactions rev
        where rev.reversal_of=wt.id and rev.status='posted'
      )
    union all
    select b.user_id,s.id source_id,'settlement'::text source_kind,
           s.net_user_result_minor source_amount_minor,b.currency::text source_currency,
           s.created_at effective_at
    from nova.bets b
    join lateral (
      select bs.id,bs.net_user_result_minor,bs.created_at,bs.status_after
      from nova.bet_settlements bs where bs.bet_id=b.id and bs.kind='settlement'
        and bs.reversed_by is null
      order by bs.revision desc limit 1
    ) s on true
    cross join bounds
    where b.funding_source='main' and b.status='settled'
      and s.status_after='settled' and s.net_user_result_minor is not null
      and s.created_at>=bounds.starts_at and s.created_at<bounds.ends_at
  )
  select a.user_id,a.source_id,a.source_kind,a.source_amount_minor,
         a.source_currency,a.effective_at,c.usd_minor,c.fx_rate_id
  from original a
  cross join lateral nova.vip_cb_fx_convert(
    a.source_amount_minor,a.source_currency,a.effective_at
  ) c
$$;

-- Unresolved rates block the ENTIRE user's quote; a missing losing or winning
-- bet must never be silently left out of a net calculation.
create or replace function nova.vip_cashback_fx_blockers(p_week_start date)
returns table(user_id uuid,missing_count bigint,currencies text[])
language sql stable security definer set search_path=nova,public
as $$
  select a.user_id,count(*)::bigint,array_agg(distinct a.source_currency)
  from nova.vip_cb_activities(p_week_start) a
  where a.usd_minor is null
  group by a.user_id
$$;

-- Preserve the prior quote signature for existing workers, history and audits.
create or replace function nova.vip_cashback_quote_week(p_week_start date)
returns table(
  user_id uuid,deposit_minor bigint,loss_minor bigint,
  rate_bps integer,cashback_minor bigint
)
language plpgsql stable security definer set search_path=nova,public
as $$
declare v_end timestamptz;
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'VIP_INVALID_MONDAY_WEEK' using errcode='22023';
  end if;
  v_end := (p_week_start+7)::timestamp at time zone 'Asia/Tehran';
  if v_end>now() then
    raise exception 'VIP_UNCLOSED_WEEK' using errcode='22023';
  end if;
  return query
  with summarized as (
    select a.user_id,
      coalesce(sum(a.usd_minor) filter(where a.source_kind='deposit'),0)::bigint as deposits,
      greatest(0::numeric,
         -coalesce(sum(a.usd_minor) filter(where a.source_kind='settlement'),0))::bigint as losses,
      count(*) filter (where a.usd_minor is null) as missing_rates
    from nova.vip_cb_activities(p_week_start) a
    group by a.user_id
  ),
  eligible as (
    select s.user_id,s.deposits,s.losses,
      case when s.deposits>=1500000 then 1100
           when s.deposits>=900000 then 800
           when s.deposits>=600000 then 600
           when s.deposits>=400000 then 500
           when s.deposits>=200000 then 300
           else 0 end as bps
    from summarized s
    where s.missing_rates=0 and s.deposits>=200000
  )
  select e.user_id,e.deposits,e.losses,e.bps,
    nova.apply_bps(e.losses,e.bps)
  from eligible e order by e.user_id;
end $$;

-- Immutable auditable FX identifiers, source amounts and transformed amounts
-- included with the credited wallet metadata and payout snapshot.
create or replace function nova.vip_cb_fx_provenance(p_week_start date,p_user_id uuid)
returns jsonb language sql stable security definer set search_path=nova,public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_id',a.source_id,'kind',a.source_kind,'settled_at',a.effective_at,
    'currency',a.source_currency,'source_minor',a.source_amount_minor,
    'usd_minor',a.usd_minor,'fx_rate_id',a.fx_rate_id
  ) order by a.effective_at,a.source_id),'[]'::jsonb)
  from nova.vip_cb_activities(p_week_start) a where a.user_id=p_user_id
$$;

revoke execute on function nova.vip_cb_fx_convert(bigint,text,timestamptz) from public,anon,authenticated;
revoke execute on function nova.vip_cb_activities(date) from public,anon,authenticated;
revoke execute on function nova.vip_cashback_fx_blockers(date) from public,anon,authenticated;
revoke execute on function nova.vip_cb_fx_provenance(date,uuid) from public,anon,authenticated;
grant execute on function nova.vip_cb_fx_convert(bigint,text,timestamptz) to service_role;
grant execute on function nova.vip_cb_activities(date) to service_role;
grant execute on function nova.vip_cashback_fx_blockers(date) to service_role;
grant execute on function nova.vip_cb_fx_provenance(date,uuid) to service_role;

commit;
