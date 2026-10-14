-- VIP cashback: isolated transaction, no production fixture changes.
begin;
do $test$
declare
  v_user uuid;
  v_payment uuid;
  v_wallet_tx uuid;
  v_bet uuid;
  v_week date;
  v_deposit_date timestamptz;
  v_quote record;
  v_credit jsonb;
  v_retry jsonb;
  v_count integer;
  v_before bigint;
  v_payout uuid;
  v_local timestamp := timezone('Asia/Tehran', now());
  v_band_user uuid;
  v_band_pay uuid;
  v_band_tx uuid;
  v_band_bet uuid;
  v_band_deposit bigint;
  v_band_rate integer;
  v_band_idx integer;
  v_quote_band record;
begin
  v_week := v_local::date - (extract(isodow from v_local)::int - 1) - 7;
  v_deposit_date := (v_week::timestamp at time zone 'Asia/Tehran') + interval '1 day';
  v_user := tests.make_user('vip-cb-' || gen_random_uuid()::text || '@test.local','user','active',true,'USD');

  insert into nova.payment_transactions (
    public_id,user_id,type,provider,status,amount_minor,currency,
    idempotency_key,completed_at,signature_verified
  ) values (
    'VIP-TEST-' || gen_random_uuid()::text,v_user,'deposit','test',
    'succeeded',400000,'USD','vip-test-deposit:' || v_user::text,
    v_deposit_date,true
  ) returning id into v_payment;

  v_wallet_tx := (nova.credit_wallet(v_user,'deposit',400000,'USD',
    'vip-test-deposit-credit:' || v_user::text,null,null,v_payment,
    'verified test deposit',null,'{}'::jsonb)->>'transaction_id')::uuid;

  update nova.payment_transactions
    set wallet_transaction_id=v_wallet_tx
    where id=v_payment;

  insert into nova.bets (
    public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
    payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
    placement_idempotency_key,funding_source,settled_at
  ) values (
    'VIP-LOSS-'||gen_random_uuid()::text,v_user,'SINGLE','settled',
    100000,'USD',200000,0,2,1,20000,'vip-test-bet:'||v_user::text,'main',v_deposit_date
  ) returning id into v_bet;

  insert into nova.bet_settlements (
    bet_id,revision,kind,status_before,status_after,payout_minor,currency,
    stake_minor,net_user_result_minor,settled_by,created_at
  ) values (
    v_bet,1,'settlement','accepted','settled',0,'USD',100000,-100000,
    'vip-finance-test',v_deposit_date
  );


  -- A settled WIN with net profit USD 600 offsets the losing USD 1,000.
  -- Net weekly loss = 1,000 - 600 = USD 400, not USD 1,000 gross.
  insert into nova.bets (
    public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
    payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
    placement_idempotency_key,funding_source,settled_at
  ) values (
    'VIP-WIN-'||gen_random_uuid()::text,v_user,'SINGLE','settled',
    100000,'USD',160000,160000,1.6,1,16000,
    'vip-test-winning-bet:'||v_user::text,'main',v_deposit_date
  ) returning id into v_bet;

  insert into nova.bet_settlements (
    bet_id,revision,kind,status_before,status_after,payout_minor,currency,
    stake_minor,net_user_result_minor,settled_by,created_at
  ) values (
    v_bet,1,'settlement','accepted','settled',160000,'USD',100000,60000,
    'vip-finance-test',v_deposit_date
  );

  select * into v_quote
  from nova.vip_cashback_quote_week(v_week) q where q.user_id=v_user;
  perform tests.assert(v_quote.deposit_minor=400000,'must use posted successful USD deposits');
  perform tests.assert(v_quote.loss_minor=40000,'net settled loss offsets winning profit');
  perform tests.assert(v_quote.rate_bps=500,'4000 USD maps to 5%');
  perform tests.assert(v_quote.cashback_minor=2000,'5% of 400 USD net loss is 20 USD');

  v_credit := nova.vip_cashback_credit_user(v_week,v_user,true);
  perform tests.assert(v_credit->>'status'='preview','dry-run never credits');
  select balance_minor into v_before
  from nova.wallets where user_id=v_user and currency='USD';
  perform tests.assert(v_before=400000,'dry-run preserves wallet balance');
  select count(*) into v_count
  from nova.vip_cashback_payouts where user_id=v_user and week_start=v_week;
  perform tests.assert(v_count=0,'dry-run creates zero awards');

  perform tests.assert_raises(
    format('select nova.vip_cashback_credit_user(%L::date,%L::uuid,false)',v_week,v_user),
    'VIP_PAYOUTS_DISABLED','disabled switch blocks real funds'
  );

  -- Real money integration exercise only after cutoff; test transaction rolls back.
  if not (extract(isodow from v_local)=1 and v_local::time < time '09:00') then
    update nova.system_operations set enabled=true
    where key='VIP_CASHBACK_PAYOUT';
    v_credit := nova.vip_cashback_credit_user(v_week,v_user,false);
    perform tests.assert(v_credit->>'status'='credited','verified credit is successful');
    v_retry := nova.vip_cashback_credit_user(v_week,v_user,false);
    perform tests.assert(v_retry->>'status'='already_paid','repeat is idempotent');
    select count(*), min(id::text)::uuid into v_count,v_payout
      from nova.vip_cashback_payouts where user_id=v_user and week_start=v_week;
    perform tests.assert(v_count=1,'exactly one award per user-week');
    select balance_minor into v_before from nova.wallets
     where user_id=v_user and currency='USD';
    perform tests.assert(v_before=402000,'wallet is credited only once by 20 USD');
    select count(*) into v_count from nova.wallet_transactions
     where user_id=v_user and type='vip_cashback';
    perform tests.assert(v_count=1,'immutable cashback ledger contains one credit');
    perform tests.assert_raises(
      format('delete from nova.vip_cashback_payouts where id=%L::uuid',v_payout),
      'IMMUTABLE','awards cannot be deleted'
    );

    -- Chargeback after payout: permanent anomaly, no silent debit.
    update nova.payment_transactions set status='refunded' where id=v_payment;
    perform tests.assert(nova.vip_cashback_reconcile(12)=1,'chargeback generates discrepancy');
    select count(*) into v_count from nova.vip_cashback_discrepancies
      where user_id=v_user and resolved_at is null;
    perform tests.assert(v_count=1,'chargeback is auditable');
  end if;


  -- Verify each tier in REAL SQL (not merely a TypeScript string-match test).
  for v_band_idx in 1..5 loop
    v_band_deposit := (array[200000,400000,600000,900000,1500000]::bigint[])[v_band_idx];
    v_band_rate := (array[300,500,600,800,1100]::integer[])[v_band_idx];
    v_band_user := tests.make_user(
      'cashback-tier-'||v_band_idx::text||'-'||gen_random_uuid()::text||'@test.local',
      'user','active',true,'USD'
    );
    insert into nova.payment_transactions
      (public_id,user_id,type,provider,status,amount_minor,currency,idempotency_key,completed_at,signature_verified)
    values
      ('VIP-TIER-'||gen_random_uuid()::text,v_band_user,'deposit','test',
       'succeeded',v_band_deposit,'USD','vip-tier-pay:'||v_band_user::text,v_deposit_date,true)
    returning id into v_band_pay;
    v_band_tx := (
      nova.credit_wallet(v_band_user,'deposit',v_band_deposit,'USD',
        'vip-tier-ledger:'||v_band_user::text,null,null,v_band_pay,
        'test tier deposit',null,'{}'::jsonb)->>'transaction_id'
    )::uuid;
    update nova.payment_transactions set wallet_transaction_id=v_band_tx where id=v_band_pay;
    insert into nova.bets
      (public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
       payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
       placement_idempotency_key,funding_source,settled_at)
    values
      ('VIP-TIER-BET-'||gen_random_uuid()::text,v_band_user,'SINGLE','settled',
       10000,'USD',20000,0,2,1,20000,'vip-tier-bet:'||v_band_user::text,'main',v_deposit_date)
    returning id into v_band_bet;
    insert into nova.bet_settlements
      (bet_id,revision,kind,status_before,status_after,payout_minor,currency,
       stake_minor,net_user_result_minor,settled_by,created_at)
    values
      (v_band_bet,1,'settlement','accepted','settled',0,'USD',10000,-10000,'vip-tier-test',v_deposit_date);

    select * into v_quote_band from nova.vip_cashback_quote_week(v_week)
      where user_id=v_band_user;
    perform tests.assert(v_quote_band.deposit_minor=v_band_deposit,'tier weekly deposit exact');
    perform tests.assert(v_quote_band.rate_bps=v_band_rate,
      format('VIP tier %s: rate is %s bps',v_band_idx,v_band_rate));
    perform tests.assert(v_quote_band.cashback_minor=nova.apply_bps(10000,v_band_rate),
      'tier award applies percentage to settled net loss');
  end loop;

  -- Any non-USD settled result in the same week must suspend the entire
  -- quote until an auditable historical FX conversion is available.
  insert into nova.bets (
    public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
    payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
    placement_idempotency_key,funding_source,settled_at
  ) values (
    'VIP-IRR-' || gen_random_uuid()::text,v_band_user,'SINGLE','settled',
    10000000,'IRR',20000000,0,2,1,20000,
    'vip-mixed-currency:' || v_band_user::text,'main',v_deposit_date
  ) returning id into v_band_bet;
  insert into nova.bet_settlements(
    bet_id,revision,kind,status_before,status_after,payout_minor,currency,
    stake_minor,net_user_result_minor,settled_by,created_at
  ) values (
    v_band_bet,1,'settlement','accepted','settled',0,'IRR',10000000,
    -10000000,'vip-mixed-test',v_deposit_date
  );
  select count(*) into v_count from nova.vip_cashback_quote_week(v_week)
   where user_id=v_band_user;
  perform tests.assert(v_count=0,'mixed IRR/USD weekly results fail closed without trusted FX snapshot');

  -- Native Monday scheduler: dry run must be strictly read-only.
  v_credit := nova.vip_cashback_process_due_week(false);
  perform tests.assert(v_credit->>'status'='preview','Monday batch dry-run returns preview');
  select count(*) into v_count from nova.vip_cashback_run_audits;
  perform tests.assert(v_count=0,'preview must not mutate even audit tables');

  -- Finance cron has its own independent disabled-by-default switch.
  v_credit := nova.vip_cashback_process_due_week(true);
  perform tests.assert(v_credit->>'status'='disabled',
    'Monday batch cannot pay without separate cron approval');
  select count(*) into v_count from nova.vip_cashback_run_audits
    where is_live and status='disabled';
  perform tests.assert(v_count=1,'blocked live batch creates auditable disabled event');

  perform tests.assert(
    not has_function_privilege('authenticated','nova.vip_cashback_credit_user(date,uuid,boolean)','execute'),
    'ordinary authenticated users cannot call money-credit RPC'
  );
end $test$;
rollback;
