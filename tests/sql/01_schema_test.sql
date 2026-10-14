-- ============================================================================
-- SCHEMA TEST - required tables/functions/constraints must exist
-- ============================================================================
\set ON_ERROR_STOP on
create schema if not exists tests;
\ir 00_fixtures.sql

do $$
declare
  v_missing text[] := '{}';
  v_required_tables text[] := array[
    'profiles','sports','countries','leagues','competitions_placeholder','seasons','teams','players','matches','match_events',
    'markets','selections','odds_history','bets','bet_legs','bet_settlements','settlement_events','settlement_jobs',
    'wallets','wallet_transactions','payment_transactions','favorites','notifications','user_sessions','user_restrictions',
    'promotions','user_promotions','bonus_ledger','affiliates','affiliate_links','affiliate_campaigns','affiliate_clicks',
    'affiliate_attributions','affiliate_relationships','affiliate_commission_configs','affiliate_ledger',
    'affiliate_settlements','affiliate_payouts','affiliate_adjustments','affiliate_fraud_flags','affiliate_daily_stats',
    'affiliate_weekly_stats','affiliate_referral_stats','affiliate_audit_logs','audit_logs','provider_health','worker_runs',
    'worker_locks','worker_heartbeats','system_settings','system_operations','risk_rules','risk_decisions','feature_flags',
    'reconciliation_records','job_queue','idempotency_keys','rate_limit_buckets','webhook_receipts','match_results','provider_entities'];
  t text;
  v_functions text[] := array[
    'round_div','apply_bps','post_wallet_entry','credit_wallet','debit_wallet','place_bet','settle_bet',
    'reverse_bet_settlement','enqueue_match_settlement','claim_settlement_jobs','complete_settlement_job',
    'apply_bet_commission','settle_affiliate_period','create_affiliate_payout','transition_affiliate_payout',
    'affiliate_payable_balance','resolve_commission_config','attach_attribution','set_affiliate_parent',
    'reconcile_financial_period','audit_event','operation_enabled','maintenance_mode','publish_odds_tick',
    'suspend_stale_selections','check_rate_limit','acquire_worker_lock','bet_payload','new_public_id'];
  f text;
begin
  foreach t in array v_required_tables loop
    if t = 'competitions_placeholder' then continue; end if;  -- competitions are represented by leagues+seasons
    if not exists (select 1 from information_schema.tables where table_schema='nova' and table_name=t) then
      v_missing := v_missing || t;
    end if;
  end loop;
  perform tests.assert(array_length(v_missing, 1) is null, 'missing tables: ' || array_to_string(v_missing, ', '));

  foreach f in array v_functions loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'nova' and p.proname = f) then
      raise exception 'ASSERTION FAILED: missing function nova.%', f;
    end if;
  end loop;

  -- every monetary column must be an integer minor-unit bigint, never float/numeric.
  -- (numeric is allowed ONLY for odds rationals, which are exact integers, not money.)
  if exists (
    select 1 from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'nova'
     where c.table_schema='nova' and pc.relkind = 'r'
       and c.column_name like '%minor%'
       and c.data_type in ('double precision','real','money','numeric')
  ) then
    raise exception 'ASSERTION FAILED: non-integer money column detected';
  end if;
  if exists (
    select 1 from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = 'nova'
     where c.table_schema='nova' and c.column_name like '%_minor' and pc.relkind = 'r'
       and c.data_type not in ('bigint','integer')
  ) then
    raise exception 'ASSERTION FAILED: money column without bigint minor units';
  end if;

  -- RLS must be enabled on all user-facing tables
  perform tests.assert(
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='nova' and c.relname in ('profiles','wallets','wallet_transactions','bets','bet_legs',
            'affiliate_ledger','affiliate_payouts','notifications','favorites','affiliates')
        and c.relrowsecurity) = 10,
    'RLS must be enabled on all user-facing tables');

  -- immutability triggers on financial history
  perform tests.assert(exists (select 1 from pg_trigger where tgname = 'wallet_tx_immutable'), 'wallet ledger immutability trigger');
  perform tests.assert(exists (select 1 from pg_trigger where tgname = 'bet_settlements_immutable'), 'settlement immutability trigger');
  perform tests.assert(exists (select 1 from pg_trigger where tgname = 'audit_logs_immutable'), 'audit log immutability trigger');

  -- unique idempotency constraints
  perform tests.assert(exists (select 1 from pg_constraint where conname = 'bets_user_id_placement_idempotency_key_key'),
    'bets idempotency unique constraint');
  perform tests.assert(exists (select 1 from pg_indexes where tablename='wallet_transactions' and indexdef ilike '%unique%idempotency_key%'),
    'wallet ledger idempotency unique index');
  perform tests.assert(exists (select 1 from pg_indexes where tablename='affiliate_settlements' and indexdef ilike '%unique%affiliate_id, period_end%'),
    'affiliate settlement weekly idempotency');
  perform tests.assert(exists (select 1 from pg_constraint where conname = 'affiliate_payouts_settlement_id_key'),
    'single payout per settlement');
end $$;

-- immutable ledger: direct UPDATE/DELETE must be refused
do $$
declare v_user uuid; v_blocked boolean := false;
begin
  v_user := tests.make_user('immutability@test.local', 'user', 'active', true, 'IRT', 100000);
  begin
    update nova.wallet_transactions set amount_minor = 1 where user_id = v_user;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'wallet ledger rows must be immutable (UPDATE blocked)');

  v_blocked := false;
  begin
    delete from nova.wallet_transactions where user_id = v_user;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'wallet ledger rows must be immutable (DELETE blocked)');

  v_blocked := false;
  begin
    perform nova.post_wallet_entry(v_user, 'adjustment', 0, 'IRT', 'zero-entry-test');
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'zero-value ledger entries must be rejected');
end $$;

select 'SCHEMA TESTS PASSED' as result;
