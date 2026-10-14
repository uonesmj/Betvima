-- Finance FX regression: all writes automatically rolled back in the isolated test DB.
begin;
do $test$
declare
  v_week date;
  v_at timestamptz;
  v_rate_at timestamptz;
  v_user uuid;
  v_payment uuid;
  v_tx uuid;
  v_bet uuid;
  v_quote record;
  v_response jsonb;
  v_count int;
  v_paid_minor bigint;
  v_rate uuid;
begin
  v_week:=timezone('Asia/Tehran',now())::date
    -(extract(isodow from timezone('Asia/Tehran',now()))::integer-1)-7;
  v_at:=(v_week::timestamp at time zone 'Asia/Tehran')+interval '25 hours';
  v_rate_at:=v_at-interval '15 minutes';

  v_user:=tests.make_user('vip-fx-'||gen_random_uuid()::text||'@test.local',
    'user','active',true,'USD');

  insert into nova.payment_transactions (
    public_id,user_id,type,provider,status,amount_minor,currency,
    idempotency_key,completed_at,signature_verified
  ) values (
    'FXPAY-'||gen_random_uuid()::text,v_user,'deposit','test',
    'succeeded',400000,'USD','fx-pay:'||v_user::text,v_at,true
  ) returning id into v_payment;
  v_tx:=(nova.credit_wallet(v_user,'deposit',400000,'USD',
    'fx-credit:'||v_user::text,null,null,v_payment,'test paid',null,
    '{}'::jsonb)->>'transaction_id')::uuid;
  update nova.payment_transactions set wallet_transaction_id=v_tx where id=v_payment;

  -- Loss: 150,000,000 IRR = US$100.00 at 150,000 TOMAN/USD.
  insert into nova.bets (
    public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
    payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
    placement_idempotency_key,funding_source,settled_at
  ) values (
    'FXLOSS-'||gen_random_uuid()::text,v_user,'SINGLE','settled',
    150000000,'IRR',300000000,0,2,1,20000,
    'fx-loss:'||v_user::text,'main',v_at
  ) returning id into v_bet;
  insert into nova.bet_settlements (
    bet_id,revision,kind,status_before,status_after,payout_minor,currency,
    stake_minor,net_user_result_minor,settled_by,created_at
  ) values (
    v_bet,1,'settlement','accepted','settled',0,'IRR',150000000,
    -150000000,'vip-fx-test',v_at
  );

  -- Win: 6,000,000 TOMAN pure profit = US$40.00 at same historical rate.
  insert into nova.bets (
    public_id,user_id,type,status,stake_minor,currency,potential_payout_minor,
    payout_minor,combined_odds_num,combined_odds_den,combined_odds_scaled,
    placement_idempotency_key,funding_source,settled_at
  ) values (
    'FXWIN-'||gen_random_uuid()::text,v_user,'SINGLE','settled',
    1000000,'IRT',7000000,7000000,7,1,70000,
    'fx-win:'||v_user::text,'main',v_at
  ) returning id into v_bet;
  insert into nova.bet_settlements (
    bet_id,revision,kind,status_before,status_after,payout_minor,currency,
    stake_minor,net_user_result_minor,settled_by,created_at
  ) values (
    v_bet,1,'settlement','accepted','settled',7000000,'IRT',
    1000000,6000000,'vip-fx-test',v_at
  );

  -- Missing rates fail closed for the ENTIRE user/week.
  select count(*) into v_count from nova.vip_cashback_quote_week(v_week)
    where user_id=v_user;
  perform tests.assert(v_count=0,'missing IRR/IRT history must never silently pay');
  select count(*) into v_count from nova.vip_cashback_fx_blockers(v_week)
    where user_id=v_user and missing_count=2;
  perform tests.assert(v_count=1,'both missing settlements must be auditable blockers');

  perform tests.assert(
    nova.vip_cb_ingest_fx_history(jsonb_build_array(jsonb_build_object(
      'timestamp',to_char(v_rate_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'price','150000.00'
    )),'30d')=1,'provider historical sample inserted exactly once'
  );
  select id into v_rate from nova.vip_cashback_fx_rates
    where sampled_at=v_rate_at;
  perform tests.assert(v_rate is not null,'immutable fx rate id must exist');

  perform tests.assert(nova.vip_cb_fx_convert(150000000,'IRR',v_at)
      is not null, 'historical IRR lookup must be available');

  select * into v_quote from nova.vip_cashback_quote_week(v_week)
    where user_id=v_user;
  perform tests.assert(v_quote.deposit_minor=400000,'USD deposit unchanged');
  perform tests.assert(v_quote.loss_minor=6000,
    'historical rates convert -100 USD losing IRR and +40 USD winning IRT to -60 USD net');
  perform tests.assert(v_quote.rate_bps=500,'US$4000 weekly deposits = 5 percent cashback');
  perform tests.assert(v_quote.cashback_minor=300,'5 percent of US$60 net loss = US$3');

  v_response:=nova.vip_cashback_credit_user(v_week,v_user,true);
  perform tests.assert(v_response->>'status'='preview','dry run remains read-only');
  perform tests.assert(jsonb_array_length(v_response->'historical_fx_evidence')=3,
    'all source entries (including USD deposit) captured in payout provenance');

  select count(*) into v_count from nova.vip_cashback_fx_blockers(v_week)
    where user_id=v_user;
  perform tests.assert(v_count=0,'verified historical samples fully cover user-week');
  perform tests.assert(nova.vip_cb_fx_convert(150000000,'IRR',v_at+interval '2 hours')
    is not null,'query returns exactly one conversion result, even if rate missing');

  -- Later settlement cannot reuse a rate older than 90 minutes.
  select count(*) into v_count from nova.vip_cb_fx_convert(150000000,'IRR',
     v_at+interval '2 hours') where usd_minor is null;
  perform tests.assert(v_count=1,'old rates must not be accepted outside staleness window');

  perform tests.assert_raises(
    format('select nova.vip_cb_ingest_fx_history(%L::jsonb,%L)',
      jsonb_build_array(jsonb_build_object(
        'timestamp',to_char(v_rate_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'price','170000.00'))::text,'30d'),
    'VIP_FX_PROVIDER_HISTORY_CONFLICT','a provider revision cannot silently change paid historical rates'
  );

  if not (extract(isodow from timezone('Asia/Tehran',now()))=1
       and timezone('Asia/Tehran',now())::time<time '09:00') then
    update nova.system_operations set enabled=true where key='VIP_CASHBACK_PAYOUT';
    v_response:=nova.vip_cashback_credit_user(v_week,v_user,false);
    perform tests.assert(v_response->>'status'='credited','FX-audited wallet credit');
    v_response:=nova.vip_cashback_credit_user(v_week,v_user,false);
    perform tests.assert(v_response->>'status'='already_paid','retries cannot double credit');
    select count(*),max(amount_minor) into v_count,v_paid_minor
    from nova.vip_cashback_payouts where user_id=v_user and week_start=v_week;
    perform tests.assert(v_count=1 and v_paid_minor=300,
      'only one auditable FX cashback award of three USD');
    select jsonb_array_length(source_snapshot->'historical_fx_evidence')
      into v_count from nova.vip_cashback_payouts where user_id=v_user;
    perform tests.assert(v_count=3,'immutable wallet evidence includes exact rate IDs');
  end if;
end $test$;
rollback;
