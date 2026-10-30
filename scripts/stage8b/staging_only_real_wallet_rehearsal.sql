-- BRANCH-ONLY qrirgzvxpjhhwvyazvpn. Never apply to production.
-- Exact function definition extracted from live isolated STAGING branch.
CREATE OR REPLACE FUNCTION public.stage8b_synthetic_financial_round(p_nonce text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'nova', 'public'
AS $function$
declare
  v_user constant uuid := '00000000-0000-0000-0000-0000000088b1'::uuid;
  v_profile constant text := 'STAGE8B-TEST-ONLY-88B1';
  v_round text;
  v_call text;
  v_initial bigint;
  v_final bigint;
  v_type text;
  v_action text;
  v_suffix text;
  v_amount bigint;
  v_result jsonb;
  v_tx uuid;
  v_original_debit uuid;
  v_original_credit uuid;
  v_original_debit_call text;
  v_original_credit_call text;
  v_replay_count integer := 0;
  v_step_ms numeric;
  v_steps jsonb := '{}'::jsonb;
  v_start timestamptz := clock_timestamp();
  v_step_start timestamptz;
  v_receipts integer;
  v_ledger integer;
  v_i int;
begin
  if p_nonce is null or p_nonce !~ '^[a-f0-9]{32}$' then
    raise exception 'STAGE8B_NONCE_REQUIRED' using errcode='22023';
  end if;
  if not exists (select 1 from nova.profiles where id=v_user and public_id=v_profile
      and not age_verified and preferred_currency='USD')
    or (select count(*) from auth.users) <> 1
    or (select count(*) from nova.profiles) <> 1
    or (select count(*) from nova.wallets) <> 1
    or (select count(*) from nova.wallets where user_id=v_user and currency='USD') <> 1
  then raise exception 'STAGE8B_SYNTHETIC_IDENTITY_GUARD'; end if;
  select balance_minor into v_initial from nova.wallets where user_id=v_user and currency='USD';
  if v_initial <> 1000 then raise exception 'STAGE8B_SEED_INVARIANT_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtext('stage8b:synthetic:'||p_nonce));
  v_round := 'stage8b-'||p_nonce;
  insert into nova.softaggregator_player_wallet_bindings(user_id,wallet_currency)
  values(v_user,'USD') on conflict (user_id) do nothing;
  insert into nova.softaggregator_round_fx(user_id,round_id,game_id,wallet_currency,rate_source)
  values(v_user,v_round,'stage8b-synthetic-game','USD','native_usd')
  on conflict(user_id,round_id,game_id) do nothing;
  for v_i in 1..4 loop
    case v_i
      when 1 then v_suffix:='d'; v_type:='bet_debit'; v_action:='debit'; v_amount:=-25;
      when 2 then v_suffix:='c'; v_type:='win_credit';v_action:='credit'; v_amount:=40;
      when 3 then v_suffix:='f'; v_type:='bet_refund';v_action:='credit';v_amount:=25;
      when 4 then v_suffix:='r'; v_type:='reversal';v_action:='debit';v_amount:=-40;
    end case;
    v_call:='stage8b-'||p_nonce||'-'||v_suffix;
    v_step_start := clock_timestamp();
    v_result:=nova.post_wallet_entry(
      v_user,v_type::wallet_tx_type,v_amount,'USD',v_call,
      'softaggregator:'||v_call,null,null,
      case when v_i=3 then v_original_debit
           when v_i=4 then v_original_credit else null end,
      'stage8b synthetic staging-only',null,'{"stage8b":true}'::jsonb,
      case when v_amount<0 then 0 else null end,false
    );
    v_step_ms:=round((extract(epoch from clock_timestamp()-v_step_start)*1000)::numeric,3);
    v_steps:=v_steps||jsonb_build_object(v_suffix,v_step_ms);
    v_tx:=(v_result->>'transaction_id')::uuid;
    if (v_result->>'idempotent_replay')::boolean then v_replay_count:=v_replay_count+1; end if;
    if v_i=1 then v_original_debit:=v_tx; v_original_debit_call:=v_call; end if;
    if v_i=2 then v_original_credit:=v_tx; v_original_credit_call:=v_call; end if;
    insert into nova.softaggregator_callback_receipts(
       call_id,identity_hash,user_id,action,amount_minor,response_error,
       response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,
       round_id,game_id,rollback,original_debit_call_id,original_credit_call_id
    ) values (
       v_call,repeat('a',64),v_user,v_action,abs(v_amount),0,
       (v_result->>'balance_after_minor')::bigint,v_tx,'USD',abs(v_amount),
       v_round,'stage8b-synthetic-game',v_i in (3,4),
       case when v_i=3 then v_original_debit_call else null end,
       case when v_i=4 then v_original_credit_call else null end
    ) on conflict (call_id) do nothing;
  end loop;
  select balance_minor into v_final from nova.wallets where user_id=v_user and currency='USD';
  select count(*) into v_receipts from nova.softaggregator_callback_receipts
     where round_id=v_round and game_id='stage8b-synthetic-game';
  select count(*) into v_ledger from nova.wallet_transactions
     where idempotency_key in (v_round||'-d',v_round||'-c',v_round||'-f',v_round||'-r');
  if v_final<>1000 or v_ledger<>4 or v_receipts<>4
    or (select sum(amount_minor) from nova.wallet_transactions where user_id=v_user)<>1000
  then raise exception 'STAGE8B_FINANCE_RECONCILIATION_FAILED'; end if;
  return jsonb_build_object(
    'ok',true,'mode','STAGE8B_REAL_POST_WALLET_ENTRY',
    'staging_only',true,'provider_contacted',false,
    'synthetic_round',v_round,'wallet_currency','USD',
    'balance_after_minor',v_final,'ledger_rows_for_round',v_ledger,
    'receipt_rows_for_round',v_receipts,'idempotent_movements',v_replay_count,
    'phases_db_ms',v_steps,
    'db_total_ms',round((extract(epoch from clock_timestamp()-v_start)*1000)::numeric,3)
  );
end;
$function$

revoke all on function public.stage8b_synthetic_financial_round(text) from public, anon, authenticated;
grant execute on function public.stage8b_synthetic_financial_round(text) to service_role;
