-- 0203: preserve exact historical FX evidence with every money-moving ledger entry.
begin;
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
    'formula','net_settled_mixed_currency_historical_fx_v3',
    'historical_fx_evidence',nova.vip_cb_fx_provenance(p_week_start,p_user_id)
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

  -- FX points are immutable, but a newly ingested older sample could be
  -- closer to the settlement time; refuse to credit if provenance changed.
  if v_snapshot->'historical_fx_evidence' is distinct from
     nova.vip_cb_fx_provenance(p_week_start,p_user_id) then
    raise exception 'VIP_HISTORICAL_FX_CHANGED_RETRY' using errcode='40001';
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
    'Weekly VIP cashback on FX-audited USD net settled sports loss', null,
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


revoke execute on function nova.vip_cashback_credit_user(date,uuid,boolean) from public,anon,authenticated;
grant execute on function nova.vip_cashback_credit_user(date,uuid,boolean) to service_role;
commit;
