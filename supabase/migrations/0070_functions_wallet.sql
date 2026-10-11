-- ============================================================================
-- 0070 - WALLET RPC: post_wallet_entry / credit_wallet / debit_wallet
-- Atomic, idempotent, row-locked. This is the ONLY path that may change a balance.
-- ============================================================================

create or replace function nova.post_wallet_entry(
  p_user_id               uuid,
  p_type                  wallet_tx_type,
  p_amount_minor          bigint,          -- signed
  p_currency              text,
  p_idempotency_key       text,
  p_reference             text default null,
  p_bet_id                uuid default null,
  p_payment_transaction_id uuid default null,
  p_reversal_of           uuid default null,
  p_reason                text default null,
  p_actor_id              uuid default null,
  p_metadata              jsonb default '{}'::jsonb,
  p_balance_floor         bigint default null,   -- reject when the resulting balance would be < floor
  p_allow_frozen          boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_wallet       nova.wallets%rowtype;
  v_existing     nova.wallet_transactions%rowtype;
  v_new_balance  bigint;
  v_tx_id        uuid;
begin
  if p_amount_minor is null or p_amount_minor = 0 then
    raise exception 'ZERO_AMOUNT_LEDGER_ENTRY' using errcode = '23514';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 6 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  if p_user_id is null then
    raise exception 'USER_REQUIRED' using errcode = '22023';
  end if;

  -- Serialise all money movements for this user+currency for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtext('wallet:' || p_user_id::text || ':' || p_currency));

  insert into nova.wallets (user_id, currency)
  values (p_user_id, p_currency)
  on conflict (user_id, currency) do nothing;

  select * into v_wallet from nova.wallets where user_id = p_user_id and currency = p_currency for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotency: a repeated key returns the ORIGINAL result, never a second movement.
  select * into v_existing from nova.wallet_transactions
   where wallet_id = v_wallet.id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'transaction_id', v_existing.id, 'balance_after_minor', v_existing.balance_after_minor,
      'amount_minor', v_existing.amount_minor, 'currency', v_existing.currency,
      'idempotent_replay', true, 'type', v_existing.type, 'status', v_existing.status);
  end if;

  if v_wallet.is_frozen and not p_allow_frozen then
    raise exception 'WALLET_FROZEN' using errcode = '42501';
  end if;

  v_new_balance := v_wallet.balance_minor + p_amount_minor;
  if p_balance_floor is not null and v_new_balance < p_balance_floor then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001',
      detail = jsonb_build_object('balance_minor', v_wallet.balance_minor, 'requested_minor', -p_amount_minor,
                                  'floor_minor', p_balance_floor)::text;
  end if;

  insert into nova.wallet_transactions (
    wallet_id, user_id, type, amount_minor, balance_after_minor, currency, status,
    reference, bet_id, payment_transaction_id, reversal_of, idempotency_key, reason, actor_id, metadata)
  values (
    v_wallet.id, p_user_id, p_type, p_amount_minor, v_new_balance, p_currency, 'posted',
    p_reference, p_bet_id, p_payment_transaction_id, p_reversal_of, p_idempotency_key, p_reason, p_actor_id,
    coalesce(p_metadata, '{}'::jsonb))
  returning id into v_tx_id;

  update nova.wallets
     set balance_minor = v_new_balance, version = version + 1
   where id = v_wallet.id;

  return jsonb_build_object(
    'transaction_id', v_tx_id, 'balance_after_minor', v_new_balance, 'amount_minor', p_amount_minor,
    'currency', p_currency, 'idempotent_replay', false, 'type', p_type, 'status', 'posted');
end $$;

/** Credit helper: amount supplied as a POSITIVE minor value. */
create or replace function nova.credit_wallet(
  p_user_id uuid, p_type wallet_tx_type, p_amount_minor bigint, p_currency text,
  p_idempotency_key text, p_reference text default null, p_bet_id uuid default null,
  p_payment_transaction_id uuid default null, p_reason text default null, p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language sql security definer set search_path = nova, public as $$
  select nova.post_wallet_entry(p_user_id, p_type, abs(p_amount_minor), p_currency, p_idempotency_key,
    p_reference, p_bet_id, p_payment_transaction_id, null, p_reason, p_actor_id, p_metadata, null, false)
$$;

/** Debit helper: amount supplied as a POSITIVE minor value; balance may never go below the floor. */
create or replace function nova.debit_wallet(
  p_user_id uuid, p_type wallet_tx_type, p_amount_minor bigint, p_currency text,
  p_idempotency_key text, p_balance_floor bigint default 0, p_reference text default null,
  p_bet_id uuid default null, p_reason text default null, p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language sql security definer set search_path = nova, public as $$
  select nova.post_wallet_entry(p_user_id, p_type, -abs(p_amount_minor), p_currency, p_idempotency_key,
    p_reference, p_bet_id, null, null, p_reason, p_actor_id, p_metadata, p_balance_floor, false)
$$;

/** Administrative adjustment: always audited, always reasoned (spec §38). */
create or replace function nova.admin_adjust_wallet(
  p_user_id uuid, p_amount_minor bigint, p_currency text, p_reason text, p_correlation_id text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_before bigint;
  v_result jsonb;
begin
  perform nova.require_admin();
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select balance_minor into v_before from nova.wallets where user_id = p_user_id and currency = p_currency;
  v_result := nova.post_wallet_entry(
    p_user_id, 'adjustment', p_amount_minor, p_currency,
    'admin_adjust:' || v_actor::text || ':' || extract(epoch from clock_timestamp())::text,
    null, null, null, null, p_reason, v_actor,
    jsonb_build_object('reason', p_reason, 'balance_before', v_before), 0, false);
  perform nova.audit_event(v_actor, 'wallet.adjustment', 'wallet', p_user_id::text,
    jsonb_build_object('balance_minor', v_before),
    jsonb_build_object('balance_minor', (v_result->>'balance_after_minor')::bigint, 'amount_minor', p_amount_minor),
    p_reason, p_correlation_id);
  return v_result;
end $$;

-- Tiny convenience view for the account area.
create or replace view nova.wallet_balances as
select w.user_id, w.currency, w.balance_minor, w.locked_minor,
       (w.balance_minor - w.locked_minor) as available_minor, w.updated_at
from nova.wallets w;

revoke all on function nova.post_wallet_entry(uuid, wallet_tx_type, bigint, text, text, text, uuid, uuid, uuid, text, uuid, jsonb, bigint, boolean) from public;
grant execute on function nova.post_wallet_entry(uuid, wallet_tx_type, bigint, text, text, text, uuid, uuid, uuid, text, uuid, jsonb, bigint, boolean) to service_role;
grant execute on function nova.credit_wallet(uuid, wallet_tx_type, bigint, text, text, text, uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function nova.debit_wallet(uuid, wallet_tx_type, bigint, text, text, bigint, text, uuid, text, uuid, jsonb) to service_role;
grant execute on function nova.admin_adjust_wallet(uuid, bigint, text, text, text) to authenticated;
