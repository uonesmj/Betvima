-- 0163 - Atomic wallet withdrawal holds
-- Holds reduce available balance without changing the financial ledger balance.
-- Final payout captures the hold and posts the authoritative withdrawal ledger entry.
create table if not exists nova.wallet_withdrawal_holds (
  id                    uuid primary key default gen_random_uuid(),
  wallet_id             uuid not null references nova.wallets(id) on delete restrict,
  user_id               uuid not null references nova.profiles(id) on delete restrict,
  payment_transaction_id uuid not null references nova.payment_transactions(id) on delete restrict,
  currency              text not null,
  amount_minor          bigint not null check (amount_minor > 0),
  status                text not null default 'held'
    check (status in ('held','captured','released')),
  idempotency_key       text not null unique,
  reason                text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  captured_at           timestamptz,
  released_at           timestamptz,
  unique (payment_transaction_id)
);

create index if not exists wallet_withdrawal_holds_user_idx
  on nova.wallet_withdrawal_holds (user_id, created_at desc);

create index if not exists wallet_withdrawal_holds_status_idx
  on nova.wallet_withdrawal_holds (status, created_at desc);

comment on table nova.wallet_withdrawal_holds is
  'Atomic withdrawal reservations. Active holds reduce available balance but do not alter ledger balance.';

create or replace function nova.reserve_wallet_withdrawal(
  p_user_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_payment_transaction_id uuid,
  p_idempotency_key text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_wallet nova.wallets%rowtype;
  v_existing nova.wallet_withdrawal_holds%rowtype;
  v_available bigint;
  v_hold_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'INVALID_WITHDRAWAL_AMOUNT' using errcode = '22023';
  end if;
  if p_payment_transaction_id is null then
    raise exception 'PAYMENT_TRANSACTION_REQUIRED' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 6 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('wallet:' || p_user_id::text || ':' || p_currency)
  );

  select * into v_existing
    from nova.wallet_withdrawal_holds
   where idempotency_key = p_idempotency_key
   limit 1;

  if found then
    return jsonb_build_object(
      'hold_id', v_existing.id,
      'wallet_id', v_existing.wallet_id,
      'amount_minor', v_existing.amount_minor,
      'status', v_existing.status,
      'idempotent_replay', true
    );
  end if;

  select * into v_existing
    from nova.wallet_withdrawal_holds
   where payment_transaction_id = p_payment_transaction_id
   limit 1;

  if found then
    return jsonb_build_object(
      'hold_id', v_existing.id,
      'wallet_id', v_existing.wallet_id,
      'amount_minor', v_existing.amount_minor,
      'status', v_existing.status,
      'idempotent_replay', true
    );
  end if;

  insert into nova.wallets (user_id, currency)
  values (p_user_id, p_currency)
  on conflict (user_id, currency) do nothing;

  select * into v_wallet
    from nova.wallets
   where user_id = p_user_id
     and currency = p_currency
   for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_wallet.is_frozen then
    raise exception 'WALLET_FROZEN' using errcode = '42501';
  end if;

  v_available := v_wallet.balance_minor - v_wallet.locked_minor;

  if v_available < p_amount_minor then
    raise exception 'INSUFFICIENT_AVAILABLE_BALANCE'
      using errcode = 'P0001',
      detail = jsonb_build_object(
        'balance_minor', v_wallet.balance_minor,
        'locked_minor', v_wallet.locked_minor,
        'available_minor', v_available,
        'requested_minor', p_amount_minor
      )::text;
  end if;

  insert into nova.wallet_withdrawal_holds (
    wallet_id, user_id, payment_transaction_id, currency,
    amount_minor, status, idempotency_key, reason, metadata
  ) values (
    v_wallet.id, p_user_id, p_payment_transaction_id, p_currency,
    p_amount_minor, 'held', p_idempotency_key, p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_hold_id;

  update nova.wallets
     set locked_minor = locked_minor + p_amount_minor,
         version = version + 1
   where id = v_wallet.id;

  return jsonb_build_object(
    'hold_id', v_hold_id,
    'wallet_id', v_wallet.id,
    'amount_minor', p_amount_minor,
    'status', 'held',
    'available_minor', v_available - p_amount_minor,
    'idempotent_replay', false
  );
end;
$$;

create or replace function nova.release_wallet_withdrawal(
  p_hold_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_hold nova.wallet_withdrawal_holds%rowtype;
  v_wallet nova.wallets%rowtype;
begin
  if p_hold_id is null then
    raise exception 'HOLD_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('withdrawal-hold:' || p_hold_id::text));

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id
   for update;

  if not found then
    raise exception 'WITHDRAWAL_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_wallet
    from nova.wallets
   where id = v_hold.wallet_id
   for update;

  if v_hold.status = 'released' then
    return jsonb_build_object(
      'hold_id', v_hold.id,
      'status', 'released',
      'amount_minor', v_hold.amount_minor,
      'idempotent_replay', true
    );
  end if;

  if v_hold.status = 'captured' then
    raise exception 'WITHDRAWAL_HOLD_ALREADY_CAPTURED' using errcode = 'P0001';
  end if;

  if v_wallet.locked_minor < v_hold.amount_minor then
    raise exception 'WALLET_LOCK_INTEGRITY_ERROR' using errcode = 'P0001';
  end if;

  update nova.wallets
     set locked_minor = locked_minor - v_hold.amount_minor,
         version = version + 1
   where id = v_wallet.id;

  update nova.wallet_withdrawal_holds
     set status = 'released',
         released_at = now()
   where id = v_hold.id;

  return jsonb_build_object(
    'hold_id', v_hold.id,
    'status', 'released',
    'amount_minor', v_hold.amount_minor,
    'idempotent_replay', false
  );
end;
$$;

create or replace function nova.capture_wallet_withdrawal(
  p_hold_id uuid,
  p_idempotency_key text,
  p_reference text default null,
  p_reason text default 'Withdrawal paid by provider',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_hold nova.wallet_withdrawal_holds%rowtype;
  v_wallet nova.wallets%rowtype;
  v_entry jsonb;
begin
  if p_hold_id is null then
    raise exception 'HOLD_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('withdrawal-hold:' || p_hold_id::text));

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id
   for update;

  if not found then
    raise exception 'WITHDRAWAL_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_hold.status = 'captured' then
    return jsonb_build_object(
      'hold_id', v_hold.id,
      'status', 'captured',
      'amount_minor', v_hold.amount_minor,
      'idempotent_replay', true
    );
  end if;

  if v_hold.status = 'released' then
    raise exception 'WITHDRAWAL_HOLD_ALREADY_RELEASED' using errcode = 'P0001';
  end if;

  select * into v_wallet
    from nova.wallets
   where id = v_hold.wallet_id
   for update;

  if v_wallet.locked_minor < v_hold.amount_minor then
    raise exception 'WALLET_LOCK_INTEGRITY_ERROR' using errcode = 'P0001';
  end if;

  v_entry := nova.post_wallet_entry(
    v_hold.user_id,
    'withdrawal',
    -v_hold.amount_minor,
    v_hold.currency,
    p_idempotency_key,
    p_reference,
    null,
    v_hold.payment_transaction_id,
    null,
    p_reason,
    null,
    coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object('withdrawal_hold_id', v_hold.id),
    0,
    false
  );

  update nova.wallets
     set locked_minor = locked_minor - v_hold.amount_minor,
         version = version + 1
   where id = v_wallet.id;

  update nova.wallet_withdrawal_holds
     set status = 'captured',
         captured_at = now()
   where id = v_hold.id;

  return jsonb_build_object(
    'hold_id', v_hold.id,
    'status', 'captured',
    'amount_minor', v_hold.amount_minor,
    'wallet_transaction_id', v_entry->>'transaction_id',
    'balance_after_minor', v_entry->>'balance_after_minor',
    'idempotent_replay', false
  );
end;
$$;

create or replace view nova.active_withdrawal_holds as
select
  h.id,
  h.wallet_id,
  h.user_id,
  h.payment_transaction_id,
  h.currency,
  h.amount_minor,
  h.status,
  h.idempotency_key,
  h.created_at,
  w.balance_minor,
  w.locked_minor,
  (w.balance_minor - w.locked_minor) as available_minor
from nova.wallet_withdrawal_holds h
join nova.wallets w on w.id = h.wallet_id
where h.status = 'held';

revoke all on function nova.reserve_wallet_withdrawal(uuid,text,bigint,uuid,text,text,jsonb) from public;
revoke all on function nova.release_wallet_withdrawal(uuid,text) from public;
revoke all on function nova.capture_wallet_withdrawal(uuid,text,text,text,jsonb) from public;

grant execute on function nova.reserve_wallet_withdrawal(uuid,text,bigint,uuid,text,text,jsonb) to service_role;
grant execute on function nova.release_wallet_withdrawal(uuid,text) to service_role;
grant execute on function nova.capture_wallet_withdrawal(uuid,text,text,text,jsonb) to service_role;
