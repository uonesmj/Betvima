-- 0164 - Harden wallet withdrawal hold locking/idempotency.
-- Do not mutate 0163. These replacements make capture/release acquire
-- the wallet advisory lock before the hold row lock, matching reserve.

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

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id;

  if not found then
    raise exception 'WITHDRAWAL_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('wallet:' || v_hold.user_id::text || ':' || v_hold.currency)
  );

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id
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

  select * into v_wallet
    from nova.wallets
   where id = v_hold.wallet_id
   for update;

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

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id;

  if not found then
    raise exception 'WITHDRAWAL_HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('wallet:' || v_hold.user_id::text || ':' || v_hold.currency)
  );

  select * into v_hold
    from nova.wallet_withdrawal_holds
   where id = p_hold_id
   for update;

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

revoke all on function nova.release_wallet_withdrawal(uuid,text) from public;
revoke all on function nova.capture_wallet_withdrawal(uuid,text,text,text,jsonb) from public;

grant execute on function nova.release_wallet_withdrawal(uuid,text) to service_role;
grant execute on function nova.capture_wallet_withdrawal(uuid,text,text,text,jsonb) to service_role;
