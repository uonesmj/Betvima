-- ===========================================================================
-- 0199 VIP cashback: recorded, exactly-once ledger credits; default OFF.
-- Monday-to-Monday Asia/Tehran calendar weeks, USD minor units only.
-- No money movement is possible until BOTH operator and worker flags are enabled.
-- ===========================================================================
begin;

insert into nova.system_operations(key, enabled, reason)
values ('VIP_CASHBACK_PAYOUT', false, 'DISABLED pending independently approved finance rollout')
on conflict(key) do nothing;

create table if not exists nova.vip_cashback_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete restrict,
  week_start date not null check (extract(isodow from week_start) = 1),
  week_end date not null,
  currency text not null default 'USD' check(currency = 'USD'),
  deposit_minor bigint not null check(deposit_minor >= 200000),
  net_loss_minor bigint not null check(net_loss_minor >= 0),
  cashback_bps integer not null check(cashback_bps in (300,500,600,800,1100)),
  amount_minor bigint not null check(amount_minor > 0),
  wallet_transaction_id uuid not null unique references nova.wallet_transactions(id) on delete restrict,
  source_snapshot jsonb not null,
  credited_at timestamptz not null default now(),
  unique(user_id, week_start),
  constraint vip_cb_week_range check(week_end = week_start + 7)
);

-- Awards are immutable, like the authoritative wallet ledger.
drop trigger if exists vip_cb_payout_immutable on nova.vip_cashback_payouts;
create trigger vip_cb_payout_immutable
before update or delete on nova.vip_cashback_payouts
for each row execute function nova.prevent_mutation();

create index if not exists vip_cb_payout_week_idx
on nova.vip_cashback_payouts(week_start, credited_at);

create table if not exists nova.vip_cashback_discrepancies (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references nova.vip_cashback_payouts(id) on delete restrict,
  user_id uuid not null references nova.profiles(id) on delete restrict,
  week_start date not null,
  previous_snapshot jsonb not null,
  recomputed_snapshot jsonb not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_reason text,
  resolved_by uuid references nova.profiles(id),
  unique(payout_id, recomputed_snapshot)
);
create index if not exists vip_cb_discrepancies_unresolved
on nova.vip_cashback_discrepancies(user_id, week_start)
where resolved_at is null;

alter table nova.vip_cashback_payouts enable row level security;
alter table nova.vip_cashback_discrepancies enable row level security;
revoke all on nova.vip_cashback_payouts, nova.vip_cashback_discrepancies from public, anon, authenticated;
grant select on nova.vip_cashback_payouts to authenticated;
create policy vip_cb_payout_select_own on nova.vip_cashback_payouts
for select to authenticated using(user_id = nova.current_user_id());
-- Discrepancy evidence is for finance, not publicly exposed.
grant all on nova.vip_cashback_payouts, nova.vip_cashback_discrepancies to service_role;

-- Returns a snapshot, never writes. No floating-point accounting.
-- NET weekly sportsbook loss = max(0, -sum(net_user_result_minor)).
-- Winning bet profits offset losing bets; no payout if week has no net loss.
-- Foreign currencies intentionally excluded until authoritative FX snapshots exist.
create or replace function nova.vip_cashback_quote_week(p_week_start date)
returns table (
  user_id uuid,
  deposit_minor bigint,
  loss_minor bigint,
  rate_bps integer,
  cashback_minor bigint
)
language plpgsql stable
security definer
set search_path = nova, public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'VIP_INVALID_MONDAY_WEEK' using errcode = '22023';
  end if;
  v_start := p_week_start::timestamp at time zone 'Asia/Tehran';
  v_end := (p_week_start + 7)::timestamp at time zone 'Asia/Tehran';
  if v_end > now() then
    raise exception 'VIP_UNCLOSED_WEEK' using errcode = '22023';
  end if;

  return query
  with deposits as (
    select p.user_id, sum(wt.amount_minor)::bigint as amount_minor
    from nova.payment_transactions p
    join nova.wallet_transactions wt
      on wt.id = p.wallet_transaction_id
     and wt.user_id = p.user_id
     and wt.status = 'posted'
     and wt.type = 'deposit'
     and wt.currency = 'USD'
     and wt.amount_minor > 0
    where p.type = 'deposit'
      and p.status = 'succeeded'
      and p.completed_at >= v_start
      and p.completed_at < v_end
      and not exists (
        select 1 from nova.wallet_transactions rev
        where rev.reversal_of = wt.id and rev.status = 'posted'
      )
    group by p.user_id
  ),
  net_results as (
    select b.user_id,
      greatest(0::numeric, -sum(s.net_user_result_minor::numeric))::bigint as amount_minor
    from nova.bets b
    join lateral (
      select bs.net_user_result_minor, bs.created_at, bs.status_after
      from nova.bet_settlements bs
      where bs.bet_id = b.id
        and bs.kind = 'settlement'
        and bs.reversed_by is null
      order by bs.revision desc
      limit 1
    ) s on true
    where b.currency = 'USD'
      and b.funding_source = 'main'
      and b.status = 'settled'
      and s.status_after = 'settled'
      and s.net_user_result_minor is not null
      and s.created_at >= v_start
      and s.created_at < v_end
    group by b.user_id
  ),
  qualified as (
    select d.user_id, d.amount_minor as deposits,
      coalesce(l.amount_minor, 0::bigint) as losses,
      case
        when d.amount_minor >= 1500000 then 1100
        when d.amount_minor >=  900000 then  800
        when d.amount_minor >=  600000 then  600
        when d.amount_minor >=  400000 then  500
        when d.amount_minor >=  200000 then  300
        else 0
      end as bps
    from deposits d
    left join net_results l on l.user_id = d.user_id
  )
  select q.user_id, q.deposits, q.losses, q.bps,
    case when q.bps > 0 then nova.apply_bps(q.losses, q.bps) else 0 end
  from qualified q
  where q.deposits >= 200000
  order by q.user_id;
end $$;

-- Write and wallet credit share ONE PostgreSQL transaction.
-- The wallet's idempotency key + unique(user,week) + advisory lock prevent double credit.
create or replace function nova.vip_cashback_credit_user(
  p_week_start date,
  p_user_id uuid,
  p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_quote record;
  v_old nova.vip_cashback_payouts%rowtype;
  v_wallet nova.wallets%rowtype;
  v_profile nova.profiles%rowtype;
  v_current_monday date;
  v_now_local timestamp;
  v_enabled boolean;
  v_result jsonb;
  v_snapshot jsonb;
  v_key text;
begin
  if p_user_id is null then
    raise exception 'VIP_USER_REQUIRED' using errcode = '22023';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'VIP_INVALID_MONDAY_WEEK' using errcode = '22023';
  end if;

  -- Never pay for an open week or arbitrary historic backfills automatically.
  v_now_local := timezone('Asia/Tehran', clock_timestamp());
  v_current_monday := v_now_local::date - (extract(isodow from v_now_local)::integer - 1);
  if p_week_start <> v_current_monday - 7 then
    raise exception 'VIP_WEEK_NOT_CURRENTLY_DUE' using errcode = '22023';
  end if;
  if v_now_local < (v_current_monday::timestamp + interval '9 hours') then
    raise exception 'VIP_MONDAY_CUTOFF_NOT_REACHED' using errcode = '22023';
  end if;
  -- A dry run cannot mutate anything, regardless of the operation switch.
  if not p_dry_run then
    select enabled into v_enabled from nova.system_operations
    where key = 'VIP_CASHBACK_PAYOUT';
    if v_enabled is distinct from true then
      raise exception 'VIP_PAYOUTS_DISABLED' using errcode = '42501';
    end if;
  end if;

  select * into v_quote from nova.vip_cashback_quote_week(p_week_start)
  where user_id = p_user_id;
  if not found or v_quote.cashback_minor <= 0 then
    return jsonb_build_object('status','not_eligible','dry_run',p_dry_run);
  end if;
  v_snapshot := jsonb_build_object(
    'week_start',p_week_start,'week_end',p_week_start + 7,'currency','USD',
    'deposit_minor',v_quote.deposit_minor,'loss_minor',v_quote.loss_minor,
    'cashback_bps',v_quote.rate_bps,'amount_minor',v_quote.cashback_minor,
    'formula','net_settled_main_wallet_losses_v2'
  );
  if p_dry_run then
    return v_snapshot || jsonb_build_object('status','preview','dry_run',true);
  end if;

  -- Serializes the exact payment candidate in the same transaction as the ledger.
  perform pg_advisory_xact_lock(hashtext('vip-cb:' || p_user_id::text || ':' || p_week_start::text));
  select * into v_old from nova.vip_cashback_payouts
  where user_id = p_user_id and week_start = p_week_start;
  if found then
    return jsonb_build_object('status','already_paid','payout_id',v_old.id,
      'wallet_transaction_id',v_old.wallet_transaction_id,'amount_minor',v_old.amount_minor);
  end if;

  -- Reselect after lock: no race can re-use this user/week idempotency key.
  select * into v_quote from nova.vip_cashback_quote_week(p_week_start)
  where user_id = p_user_id;
  if not found or v_quote.cashback_minor <= 0 then
    return jsonb_build_object('status','no_longer_eligible');
  end if;
  if v_quote.deposit_minor <> (v_snapshot->>'deposit_minor')::bigint
     or v_quote.loss_minor <> (v_snapshot->>'loss_minor')::bigint
     or v_quote.cashback_minor <> (v_snapshot->>'amount_minor')::bigint
     or v_quote.rate_bps <> (v_snapshot->>'cashback_bps')::integer then
    raise exception 'VIP_SNAPSHOT_CHANGED_RETRY' using errcode = '40001';
  end if;

  select * into v_profile from nova.profiles where id = p_user_id for update;
  if not found or v_profile.role::text not in ('user','affiliate')
     or v_profile.status::text <> 'active' then
    raise exception 'VIP_ACCOUNT_REQUIRES_REVIEW' using errcode = '42501';
  end if;
  select * into v_wallet from nova.wallets
   where user_id = p_user_id and currency = 'USD' for update;
  if not found or v_wallet.is_frozen then
    raise exception 'VIP_WALLET_UNAVAILABLE_OR_FROZEN' using errcode = '42501';
  end if;
  if exists (
    select 1 from nova.vip_cashback_discrepancies d
    where d.user_id = p_user_id and d.resolved_at is null
  ) then
    raise exception 'VIP_OPEN_DISCREPANCY_REVIEW_REQUIRED' using errcode = '42501';
  end if;
  -- No arbitrary maximum reward cap: all verified eligible tiers pay automatically.
  -- Suspended/frozen accounts and unresolved discrepancies remain blocked.

  v_key := 'vip-cashback:v1:' || p_week_start::text || ':' || p_user_id::text;
  v_result := nova.credit_wallet(
    p_user_id, 'vip_cashback', v_quote.cashback_minor, 'USD',
    v_key, 'VIP_CASHBACK_' || p_week_start::text, null, null,
    'Weekly VIP cashback on eligible settled USD sports losses', null,
    v_snapshot
  );

  insert into nova.vip_cashback_payouts(
    user_id, week_start, week_end, deposit_minor, net_loss_minor,
    cashback_bps, amount_minor, wallet_transaction_id, source_snapshot)
  values (p_user_id, p_week_start, p_week_start + 7, v_quote.deposit_minor,
     v_quote.loss_minor, v_quote.rate_bps, v_quote.cashback_minor,
     (v_result->>'transaction_id')::uuid, v_snapshot);

  return v_snapshot || jsonb_build_object('status','credited','dry_run',false,
    'wallet_transaction_id',v_result->>'transaction_id');
end $$;

-- Detect later chargebacks/regrades (no automatic clawback; block future awards).
create or replace function nova.vip_cashback_reconcile(p_lookback_weeks integer default 12)
returns integer
language plpgsql
security definer
set search_path = nova, public
as $$
declare v_count integer;
begin
  if p_lookback_weeks not between 1 and 104 then
    raise exception 'VIP_INVALID_RECONCILIATION_WINDOW' using errcode = '22023';
  end if;
  with mismatches as (
    select a.*, coalesce(q.deposit_minor,0::bigint) as deposits,
      coalesce(q.loss_minor,0::bigint) as losses,
      coalesce(q.rate_bps,0) as bps,
      coalesce(q.cashback_minor,0::bigint) as amount
    from nova.vip_cashback_payouts a
    left join lateral (
      select * from nova.vip_cashback_quote_week(a.week_start) q
      where q.user_id = a.user_id
    ) q on true
    where a.week_start >= (timezone('Asia/Tehran',now())::date - p_lookback_weeks * 7)
  ), added as (
    insert into nova.vip_cashback_discrepancies
    (payout_id,user_id,week_start,previous_snapshot,recomputed_snapshot)
    select m.id,m.user_id,m.week_start,m.source_snapshot,
      jsonb_build_object('deposit_minor',m.deposits,'loss_minor',m.losses,
        'cashback_bps',m.bps,'amount_minor',m.amount)
    from mismatches m
    where m.deposit_minor <> m.deposits or m.net_loss_minor <> m.losses
       or m.cashback_bps <> m.bps or m.amount_minor <> m.amount
    on conflict(payout_id,recomputed_snapshot) do nothing
    returning 1
  ) select count(*) into v_count from added;
  return v_count;
end $$;

revoke execute on function nova.vip_cashback_quote_week(date) from public, anon, authenticated;
revoke execute on function nova.vip_cashback_credit_user(date,uuid,boolean) from public, anon, authenticated;
revoke execute on function nova.vip_cashback_reconcile(integer) from public, anon, authenticated;
grant execute on function nova.vip_cashback_quote_week(date) to service_role;
grant execute on function nova.vip_cashback_credit_user(date,uuid,boolean) to service_role;
grant execute on function nova.vip_cashback_reconcile(integer) to service_role;

commit;
