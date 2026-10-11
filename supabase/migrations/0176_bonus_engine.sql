begin;

-- ============================================================
-- NOVA 0176 — 100% Deposit Bonus Engine
-- One independent bonus grant per successful deposit.
-- Bonus lifetime: exactly 24 hours from granted_at.
-- ============================================================

create table if not exists nova.bonus_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete cascade,
  promotion_id uuid not null references nova.promotions(id),
  deposit_payment_transaction_id uuid not null references nova.payment_transactions(id),
  currency text not null,
  amount_minor bigint not null check (amount_minor > 0),
  remaining_amount_minor bigint not null check (remaining_amount_minor >= 0),
  status text not null default 'active'
    check (status in ('active','locked','won','lost','expired','cancelled')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  locked_at timestamptz,
  used_at timestamptz,
  bet_id uuid references nova.bets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bonus_grants_expiry_after_grant
    check (expires_at > granted_at),
  constraint bonus_grants_remaining_lte_amount
    check (remaining_amount_minor <= amount_minor),
  constraint bonus_grants_locked_consistency
    check (
      (status = 'locked' and bet_id is not null and remaining_amount_minor = 0)
      or status <> 'locked'
      or bet_id is not null
    ),
  unique (deposit_payment_transaction_id)
);

create index if not exists bonus_grants_user_status_idx
  on nova.bonus_grants(user_id, status, expires_at desc);

create index if not exists bonus_grants_user_currency_idx
  on nova.bonus_grants(user_id, currency, status, expires_at desc);

create index if not exists bonus_grants_bet_idx
  on nova.bonus_grants(bet_id)
  where bet_id is not null;

create index if not exists bonus_grants_expiry_idx
  on nova.bonus_grants(status, expires_at)
  where status = 'active';

alter table nova.bonus_ledger
  add column if not exists bonus_grant_id uuid references nova.bonus_grants(id);

create index if not exists bonus_ledger_grant_idx
  on nova.bonus_ledger(bonus_grant_id, created_at desc);

alter table nova.bets
  add column if not exists funding_source text not null default 'main';

alter table nova.bets
  add column if not exists bonus_grant_id uuid references nova.bonus_grants(id);

alter table nova.bets
  add column if not exists bonus_reward_minor bigint;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'bets_funding_source_check'
       and conrelid = 'nova.bets'::regclass
  ) then
    alter table nova.bets
      add constraint bets_funding_source_check
      check (funding_source in ('main','bonus'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'bets_bonus_fields_check'
       and conrelid = 'nova.bets'::regclass
  ) then
    alter table nova.bets
      add constraint bets_bonus_fields_check
      check (
        (funding_source = 'main' and bonus_grant_id is null and bonus_reward_minor is null)
        or
        (funding_source = 'bonus' and bonus_grant_id is not null and bonus_reward_minor is not null and bonus_reward_minor > 0)
      );
  end if;
end $$;

create unique index if not exists bets_bonus_grant_unique
  on nova.bets(bonus_grant_id)
  where bonus_grant_id is not null;

create index if not exists bets_funding_source_idx
  on nova.bets(user_id, funding_source, created_at desc);

-- ============================================================
-- Active campaign: 100% on every successful deposit.
-- No weekly usage cap. No artificial minimum/maximum introduced.
-- ============================================================

insert into nova.promotions (
  slug,
  title,
  title_fa,
  description,
  type,
  currency,
  amount_minor,
  percentage_bps,
  wagering_multiplier,
  min_deposit_minor,
  max_bonus_minor,
  starts_at,
  ends_at,
  is_active,
  requires_flag
)
values (
  'nova-100-deposit-bonus',
  '100% Deposit Bonus',
  '100% Deposit Bonus',
  'Get a 100% bonus on every successful deposit. Each bonus is valid for 24 hours and must be used in an eligible 4-selection accumulator.',
  'bonus',
  null,
  null,
  10000,
  null,
  null,
  null,
  now(),
  null,
  true,
  null
)
on conflict (slug) do update
set title = excluded.title,
    title_fa = excluded.title_fa,
    description = excluded.description,
    type = excluded.type,
    percentage_bps = excluded.percentage_bps,
    wagering_multiplier = excluded.wagering_multiplier,
    min_deposit_minor = excluded.min_deposit_minor,
    max_bonus_minor = excluded.max_bonus_minor,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    is_active = excluded.is_active,
    requires_flag = excluded.requires_flag,
    updated_at = now();

-- ============================================================
-- RLS: users can inspect only their own bonus grants.
-- Writes remain SECURITY DEFINER/server-side.
-- ============================================================

alter table nova.bonus_grants enable row level security;

drop policy if exists bonus_grants_own on nova.bonus_grants;

create policy bonus_grants_own
  on nova.bonus_grants
  for select
  using (
    user_id = nova.current_user_id()
    or nova.is_admin()
  );

-- ============================================================
-- Grant exactly one 100% bonus for one successful deposit.
-- Idempotency key = deposit payment transaction ID.
-- ============================================================

create or replace function nova.grant_deposit_bonus(
  p_payment_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'nova', 'public'
as $function$
declare
  v_payment nova.payment_transactions%rowtype;
  v_promotion nova.promotions%rowtype;
  v_existing nova.bonus_grants%rowtype;
  v_grant nova.bonus_grants%rowtype;
  v_amount bigint;
  v_ledger_id uuid;
begin
  select *
    into v_payment
    from nova.payment_transactions
   where id = p_payment_transaction_id
   for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_payment.type::text <> 'deposit' then
    raise exception 'BONUS_DEPOSIT_REQUIRED' using errcode = '22023';
  end if;

  if v_payment.status::text <> 'succeeded' then
    return jsonb_build_object(
      'granted', false,
      'reason', 'DEPOSIT_NOT_SUCCESSFUL'
    );
  end if;

  select *
    into v_existing
    from nova.bonus_grants
   where deposit_payment_transaction_id = p_payment_transaction_id
   limit 1;

  if found then
    return jsonb_build_object(
      'granted', true,
      'idempotent_replay', true,
      'bonus_id', v_existing.id,
      'amount_minor', v_existing.amount_minor,
      'status', v_existing.status
    );
  end if;

  select *
    into v_promotion
    from nova.promotions
   where slug = 'nova-100-deposit-bonus'
     and type = 'bonus'
     and is_active = true
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now())
   for update;

  if not found then
    return jsonb_build_object(
      'granted', false,
      'reason', 'BONUS_CAMPAIGN_INACTIVE'
    );
  end if;

  if v_promotion.min_deposit_minor is not null
     and v_payment.amount_minor < v_promotion.min_deposit_minor then
    return jsonb_build_object(
      'granted', false,
      'reason', 'DEPOSIT_BELOW_MINIMUM'
    );
  end if;

  if v_promotion.percentage_bps is not null then
    v_amount := floor(
      (v_payment.amount_minor::numeric * v_promotion.percentage_bps::numeric) / 10000
    )::bigint;
  elsif v_promotion.amount_minor is not null then
    v_amount := v_promotion.amount_minor;
  else
    raise exception 'BONUS_CAMPAIGN_AMOUNT_INVALID' using errcode = '22023';
  end if;

  if v_promotion.max_bonus_minor is not null then
    v_amount := least(v_amount, v_promotion.max_bonus_minor);
  end if;

  if v_amount <= 0 then
    return jsonb_build_object(
      'granted', false,
      'reason', 'BONUS_AMOUNT_ZERO'
    );
  end if;

  insert into nova.bonus_grants (
    user_id,
    promotion_id,
    deposit_payment_transaction_id,
    currency,
    amount_minor,
    remaining_amount_minor,
    status,
    granted_at,
    expires_at
  )
  values (
    v_payment.user_id,
    v_promotion.id,
    v_payment.id,
    v_payment.currency,
    v_amount,
    v_amount,
    'active',
    now(),
    now() + interval '24 hours'
  )
  returning * into v_grant;

  insert into nova.bonus_ledger (
    user_id,
    promotion_id,
    bonus_grant_id,
    type,
    amount_minor,
    currency,
    wagering_remaining_minor,
    idempotency_key,
    reason
  )
  values (
    v_payment.user_id,
    v_promotion.id,
    v_grant.id,
    'grant',
    v_amount,
    v_payment.currency,
    v_amount,
    'deposit-bonus:' || v_payment.id::text,
    '100% bonus granted for successful deposit'
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'granted', true,
    'idempotent_replay', false,
    'bonus_id', v_grant.id,
    'ledger_id', v_ledger_id,
    'amount_minor', v_amount,
    'currency', v_payment.currency,
    'granted_at', v_grant.granted_at,
    'expires_at', v_grant.expires_at
  );

exception
  when unique_violation then
    select *
      into v_existing
      from nova.bonus_grants
     where deposit_payment_transaction_id = p_payment_transaction_id
     limit 1;

    if found then
      return jsonb_build_object(
        'granted', true,
        'idempotent_replay', true,
        'bonus_id', v_existing.id,
        'amount_minor', v_existing.amount_minor,
        'status', v_existing.status
      );
    end if;

    raise;
end
$function$;

-- ============================================================
-- Expire active grants whose exact 24h lifetime has elapsed.
-- Idempotent append-only expiry ledger.
-- ============================================================

create or replace function nova.expire_bonus_grants()
returns integer
language plpgsql
security definer
set search_path to 'nova', 'public'
as $function$
declare
  v_count integer := 0;
begin
  with expired as (
    update nova.bonus_grants
       set status = 'expired',
           remaining_amount_minor = 0,
           used_at = coalesce(used_at, now()),
           updated_at = now()
     where status = 'active'
       and expires_at <= now()
    returning *
  )
  insert into nova.bonus_ledger (
    user_id,
    promotion_id,
    bonus_grant_id,
    type,
    amount_minor,
    currency,
    wagering_remaining_minor,
    idempotency_key,
    reason
  )
  select
    e.user_id,
    e.promotion_id,
    e.id,
    'expiry',
    -e.amount_minor,
    e.currency,
    0,
    'bonus-expiry:' || e.id::text,
    'Bonus expired after 24 hours'
  from expired e
  on conflict (idempotency_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

grant execute on function nova.grant_deposit_bonus(uuid) to service_role;
grant execute on function nova.expire_bonus_grants() to service_role;

commit;
