-- ============================================================================
-- AFFILIATE BEHAVIOUR TESTS - spec §81 + the MANDATORY examples of §29 and §99
--
--   MODEL A (PROFIT_LOSS_35, negative carry-forward allowed)
--     user loses 10,000,000  -> affiliate +3,500,000
--     user wins  20,000,000  -> affiliate -7,000,000
--     previous +3,500,000 then -7,000,000 -> -3,500,000 carry-forward
--     next period earns 10,000,000 -> payable 6,500,000
--
--   MODEL B (NON_NEGATIVE_35)
--     previous +3,500,000, user win impact -7,000,000 -> payable 0 (never -3,500,000)
--     100M / 500M / 1B user wins -> payable stays >= 0
-- ============================================================================
\set ON_ERROR_STOP on
\ir 00_fixtures.sql

-- helper: attribute a user to an affiliate and settle one bet with a known user result
create or replace function tests.run_bet(
  p_user uuid, p_match uuid, p_code text, p_stake bigint, p_payout bigint, p_grade text, p_key text
) returns uuid
language plpgsql as $$
declare v_bet jsonb;
begin
  v_bet := tests.place_single(p_user, p_match, p_code, p_stake, p_key);
  perform tests.settle_bet_with_result((v_bet->'bet'->>'id')::uuid, p_grade, p_payout, 1);
  return (v_bet->'bet'->>'id')::uuid;
end $$;

do $$
declare
  v_aff_a uuid; v_aff_b uuid; v_viewer jsonb; v_user uuid; v_match uuid;
  v_result jsonb; v_pay jsonb; v_raw bigint; v_payable bigint; v_suppressed bigint; v_floor boolean;
  v_settlement jsonb; v_settlement2 jsonb; v_currency text; v_count int; v_blocked boolean;
  v_p1 timestamptz; v_p2 timestamptz; v_p3 timestamptz;
begin
  ------------------------------------------------------------------ MODEL A
  v_aff_a := tests.make_affiliate('MODELA', 'PROFIT_LOSS_35', 3500, true, null, 5000000);
  -- commission config layer for the affiliate (explicit, not implicit defaults)
  insert into nova.affiliate_commission_configs (scope, scope_ref, commission_model, commission_rate_bps,
    allow_negative_balance, min_payout_minor, parent_override_bps, settlement_day_iso, settlement_time, settlement_timezone, is_active)
  values ('AFFILIATE', v_aff_a::text, 'PROFIT_LOSS_35', 3500, true, 5000000, 0, 5, '03:00', 'Asia/Tehran', true);

  v_user := tests.make_user('modelA-user@test.local', 'user', 'active', true, 'IRT', 100000000);
  v_result := nova.attach_attribution(v_user, 'MODELA');
  perform tests.assert((v_result->>'attributed')::boolean, 'attribution created for MODEL A user');

  -- (1) user loses 10,000,000 -> affiliate +3,500,000
  v_match := tests.make_match(30000);
  perform tests.run_bet(v_user, v_match, 'HOME', 10000000, 0, 'LOST', 'modelA-loss-0001');
  select coalesce(sum(amount_minor),0) into v_raw from nova.affiliate_ledger where affiliate_id = v_aff_a;
  perform tests.assert(v_raw = 3500000, 'MODEL A: user loss 10,000,000 @35% -> +3,500,000 (got ' || v_raw || ')');

  -- (2) user wins 20,000,000 -> affiliate -7,000,000  (stake 10M, payout 30M, net +20M)
  v_match := tests.make_match(30000);
  perform tests.run_bet(v_user, v_match, 'HOME', 10000000, 30000000, 'WON', 'modelA-win-0001');
  select raw_minor, payable_minor, suppressed_minor, floor_applied into v_raw, v_payable, v_suppressed, v_floor
    from nova.affiliate_payable_balance(v_aff_a);
  perform tests.assert(v_raw = -3500000, 'MODEL A: +3,500,000 then -7,000,000 -> raw -3,500,000 (got ' || v_raw || ')');
  perform tests.assert(v_payable = -3500000, 'MODEL A: negative carry-forward is preserved, never reset (got ' || v_payable || ')');
  perform tests.assert(not v_floor, 'MODEL A: no floor-zero rule applied');

  -- period settlement: below minimum (negative) -> no payout, carry forward
  v_p1 := now() - interval '1 hour'; v_p2 := now() + interval '30 seconds'; v_p3 := now() + interval '2 minutes';
  v_settlement := nova.settle_affiliate_period(v_aff_a, v_p1, v_p2, 'test-worker', false);
  perform tests.assert((v_settlement->>'payable_minor')::bigint = -3500000, 'MODEL A period 1 payable = -3,500,000');
  perform tests.assert(coalesce(v_settlement->'payout', 'null'::jsonb) = 'null'::jsonb,
    'MODEL A: nothing is paid out for a negative balance');
  perform tests.assert((v_settlement->>'closing_carry_minor')::bigint = -3500000, 'MODEL A: carry-forward -3,500,000');

  -- next period earns 10,000,000 -> payable 6,500,000 (spec §99)
  insert into nova.affiliate_ledger (affiliate_id, type, amount_minor, currency, direction, source_kind, status, idempotency_key, created_at)
  values (v_aff_a, 'user_loss_commission', 10000000, 'IRT', 'credit', 'system', 'available', 'modelA-next-period-0001', now() + interval '1 minute');
  v_settlement2 := nova.settle_affiliate_period(v_aff_a, v_p2, v_p3, 'test-worker', false);
  perform tests.assert((v_settlement2->>'opening_carry_minor')::bigint = -3500000, 'MODEL A: opening carry -3,500,000');
  perform tests.assert((v_settlement2->>'net_minor')::bigint = 10000000, 'MODEL A: period net +10,000,000');
  perform tests.assert((v_settlement2->>'payable_minor')::bigint = 6500000,
    'MODEL A: available after carry-forward = 6,500,000 (got ' || (v_settlement2->>'payable_minor') || ')');
  perform tests.assert((v_settlement2->'payout'->>'amount_minor')::bigint = 6500000, 'MODEL A: payout created for 6,500,000');

  ------------------------------------------------------------------ MODEL B
  v_aff_b := tests.make_affiliate('MODELB', 'NON_NEGATIVE_35', 3500, false, null, 5000000);
  insert into nova.affiliate_commission_configs (scope, scope_ref, commission_model, commission_rate_bps,
    allow_negative_balance, negative_balance_floor_minor, min_payout_minor, parent_override_bps,
    settlement_day_iso, settlement_time, settlement_timezone, is_active)
  values ('AFFILIATE', v_aff_b::text, 'NON_NEGATIVE_35', 3500, false, 0, 5000000, 0, 5, '03:00', 'Asia/Tehran', true);

  v_user := tests.make_user('modelB-user@test.local', 'user', 'active', true, 'IRT', 5000000000);
  perform nova.attach_attribution(v_user, 'MODELB');

  v_match := tests.make_match(30000);
  perform tests.run_bet(v_user, v_match, 'HOME', 10000000, 0, 'LOST', 'modelB-loss-0001');
  v_match := tests.make_match(30000);
  perform tests.run_bet(v_user, v_match, 'HOME', 10000000, 30000000, 'WON', 'modelB-win-0001');

  select raw_minor, payable_minor, suppressed_minor, floor_applied into v_raw, v_payable, v_suppressed, v_floor
    from nova.affiliate_payable_balance(v_aff_b);
  perform tests.assert(v_raw = -3500000, 'MODEL B: raw events still record -3,500,000 for audit');
  perform tests.assert(v_payable = 0, 'MODEL B: payable balance = 0, NEVER negative (got ' || v_payable || ')');
  perform tests.assert(v_suppressed = 3500000, 'MODEL B: suppressed deficit reported (3,500,000)');
  perform tests.assert(v_floor, 'MODEL B: floor-zero rule applied');

  -- extreme: referred users win 100M, 500M, 1B
  insert into nova.affiliate_ledger (affiliate_id, type, amount_minor, currency, direction, source_kind, status, idempotency_key, created_at)
  values (v_aff_b, 'user_win_debit', -100000000, 'IRT', 'debit', 'system', 'available', 'modelB-huge-1', now()),
         (v_aff_b, 'user_win_debit', -500000000, 'IRT', 'debit', 'system', 'available', 'modelB-huge-2', now()),
         (v_aff_b, 'user_win_debit', -1000000000, 'IRT', 'debit', 'system', 'available', 'modelB-huge-3', now());
  select payable_minor into v_payable from nova.affiliate_payable_balance(v_aff_b);
  perform tests.assert(v_payable = 0, 'MODEL B: 1.6B of user wins leaves payable at 0 (got ' || v_payable || ')');

  -- settlement of a heavily negative MODEL B period: payable 0, nothing paid, no negative carry
  v_settlement := nova.settle_affiliate_period(v_aff_b, now() - interval '1 hour', now() + interval '30 seconds', 'test-worker', false);
  perform tests.assert((v_settlement->>'payable_minor')::bigint = 0, 'MODEL B settlement payable = 0');
  perform tests.assert((v_settlement->>'closing_carry_minor')::bigint = 0, 'MODEL B: carry-forward never negative');
  perform tests.assert(coalesce(v_settlement->'payout', 'null'::jsonb) = 'null'::jsonb,
    'MODEL B: no payout for a zero payable balance');

  ------------------------------------------------------------------ minimum payout + carry forward
  declare
    v_aff_c uuid; v_user_c uuid; v_s1 jsonb; v_s2 jsonb;
  begin
    v_aff_c := tests.make_affiliate('MINPAY', 'NON_NEGATIVE_35', 3500, false, null, 5000000);
    v_user_c := tests.make_user('minpay-user@test.local', 'user', 'active', true, 'IRT', 100000000);
    perform nova.attach_attribution(v_user_c, 'MINPAY');
    insert into nova.affiliate_ledger (affiliate_id, type, amount_minor, currency, direction, source_kind, status, idempotency_key, created_at)
    values (v_aff_c, 'user_loss_commission', 3000000, 'IRT', 'credit', 'system', 'available', 'minpay-period-1', now() - interval '10 days');

    v_s1 := nova.settle_affiliate_period(v_aff_c, now() - interval '14 days', now() - interval '7 days', 'test-worker', false);
    perform tests.assert((v_s1->>'payable_minor')::bigint = 3000000, 'below minimum: payable 3,000,000');
    perform tests.assert(coalesce(v_s1->'payout', 'null'::jsonb) = 'null'::jsonb, 'below minimum: NO payout created');
    perform tests.assert((v_s1->>'closing_carry_minor')::bigint = 3000000, 'below minimum: 3,000,000 carried forward');

    insert into nova.affiliate_ledger (affiliate_id, type, amount_minor, currency, direction, source_kind, status, idempotency_key, created_at)
    values (v_aff_c, 'user_loss_commission', 3000000, 'IRT', 'credit', 'system', 'available', 'minpay-period-2', now() - interval '3 days');
    v_s2 := nova.settle_affiliate_period(v_aff_c, now() - interval '7 days', now(), 'test-worker', false);
    perform tests.assert((v_s2->>'opening_carry_minor')::bigint = 3000000, 'carry-forward applied as opening balance');
    perform tests.assert((v_s2->>'payable_minor')::bigint = 6000000, 'carry-forward added: 6,000,000');
    perform tests.assert((v_s2->'payout'->>'amount_minor')::bigint = 6000000, 'payout created once the minimum is reached');

    -- duplicate settlement run must be a no-op
    v_s2 := nova.settle_affiliate_period(v_aff_c, now() - interval '7 days', now(), 'test-worker', false);
    perform tests.assert((v_s2->>'duplicate')::boolean, 'second settlement run for the same period is a duplicate');
    select count(*) into v_count from nova.affiliate_payouts where affiliate_id = v_aff_c;
    perform tests.assert(v_count = 1, 'exactly one payout for the period');

    -- duplicate payout request with the same idempotency key
    v_pay := nova.create_affiliate_payout(v_aff_c, null, 6000000, 'IRT', 'dupe-payout-key-0001', null, 'manual', '{}'::jsonb);
    v_pay := nova.create_affiliate_payout(v_aff_c, null, 6000000, 'IRT', 'dupe-payout-key-0001', null, 'manual', '{}'::jsonb);
    perform tests.assert((v_pay->>'duplicate')::boolean, 'duplicate payout request returns the SAME payout');
    select count(*) into v_count from nova.affiliate_payouts where affiliate_id = v_aff_c;
    perform tests.assert(v_count = 2, 'no extra payout row created for the duplicate key');
  end;

  ------------------------------------------------------------------ payout lifecycle + double payout protection
  declare
    v_payout record;
  begin
    select * into v_payout from nova.affiliate_payouts where affiliate_id = v_aff_a order by requested_at limit 1;
    perform set_config('nova.user_role', 'admin', false);
    perform set_config('nova.user_id', (select id::text from nova.profiles where role = 'admin' limit 1), false);
    if v_payout.id is null then
      raise exception 'ASSERTION FAILED: expected a payout for MODEL A';
    end if;
    perform nova.transition_affiliate_payout(v_payout.id, 'approved', 'approved by finance');
    perform nova.transition_affiliate_payout(v_payout.id, 'processing', null);
    perform nova.transition_affiliate_payout(v_payout.id, 'paid', null, 'PROVIDER-REF-1');
    v_blocked := false;
    begin
      perform nova.transition_affiliate_payout(v_payout.id, 'paid', null, 'PROVIDER-REF-1');
    exception when others then v_blocked := true;
    end;
    perform tests.assert(v_blocked, 'DOUBLE PAYOUT BLOCKED: paid -> paid is impossible');
    v_blocked := false;
    begin
      perform nova.transition_affiliate_payout(v_payout.id, 'pending', null);
    exception when others then v_blocked := true;
    end;
    perform tests.assert(v_blocked, 'terminal payout states cannot be reopened');
    perform set_config('nova.user_role', '', false);
    perform set_config('nova.user_id', '', false);
  end;

  ------------------------------------------------------------------ attribution integrity
  declare
    v_aff_self uuid; v_self_user uuid; v_r jsonb;
  begin
    -- affiliate whose own account tries to refer itself
    v_aff_self := tests.make_affiliate('SELFAFF', 'NON_NEGATIVE_35', 3500, false);
    v_self_user := (select user_id from nova.affiliates where id = v_aff_self);
    v_r := nova.attach_attribution(v_self_user, 'SELFAFF');
    perform tests.assert(not (v_r->>'attributed')::boolean and (v_r->>'reason') = 'SELF_REFERRAL_BLOCKED',
      'self referral is blocked');
    perform tests.assert(exists (select 1 from nova.affiliate_fraud_flags where affiliate_id = v_aff_self and signal = 'SELF_REFERRAL'),
      'self referral is recorded as a fraud flag');

    -- email-based self referral (same email hash as the affiliate's own account)
    declare v_dupe uuid; begin
      insert into auth.users (email) values ('dupe@test.local') returning id into v_dupe;
      insert into nova.profiles (id, public_id, email, email_hash, status, age_verified)
      select v_dupe, 'NU-DUPE1', 'dupe@test.local', email_hash, 'active', true
        from nova.profiles where id = v_self_user;
    end;
    v_r := nova.attach_attribution((select id from nova.profiles where public_id = 'NU-DUPE1'), 'SELFAFF');
    perform tests.assert((v_r->>'reason') = 'SELF_REFERRAL_BLOCKED', 'duplicate identity self-referral blocked');

    -- unknown code / not approved
    v_r := nova.attach_attribution(v_user, 'NOPEXX');
    perform tests.assert((v_r->>'reason') = 'UNKNOWN_CODE', 'unknown referral code rejected');

    -- one primary affiliate forever
    v_r := nova.attach_attribution(v_user, 'MODELB');
    perform tests.assert((v_r->>'reason') = 'ALREADY_ATTRIBUTED', 'a user keeps a single primary affiliate');
  end;

  ------------------------------------------------------------------ hierarchy integrity
  declare
    v_root uuid; v_child uuid; v_grand uuid; v_r jsonb; v_ok boolean;
  begin
    v_root := tests.make_affiliate('HIER1', 'NON_NEGATIVE_35', 3500, false);
    v_child := tests.make_affiliate('HIER2', 'NON_NEGATIVE_35', 3500, false);
    v_grand := tests.make_affiliate('HIER3', 'NON_NEGATIVE_35', 3500, false);
    perform set_config('nova.user_role', 'admin', false);
    perform set_config('nova.user_id', (select id::text from nova.profiles where role = 'admin' limit 1), false);

    perform tests.assert_raises(format('select nova.set_affiliate_parent(%L::uuid, %L::uuid, %L)', v_root, v_root, 'self parent attempt'),
      'SELF_PARENT', 'self-parent rejected');
    perform nova.set_affiliate_parent(v_child, v_root, 'child under root');
    perform tests.assert_raises(format('select nova.set_affiliate_parent(%L::uuid, %L::uuid, %L)', v_root, v_child, 'cycle attempt'),
      'CIRCULAR_HIERARCHY', 'circular hierarchy rejected');
    perform nova.set_affiliate_parent(v_grand, v_child, 'grandchild under child');
    perform tests.assert_raises(format('select nova.set_affiliate_parent(%L::uuid, %L::uuid, %L)', v_root, v_grand, 'deep cycle'),
      'CIRCULAR_HIERARCHY', 'descendant cannot become an ancestor');

    -- depth ceiling (max 3): level 4 is allowed, level 5 must be refused
    declare v_l4 uuid; v_l5 uuid; begin
      v_l4 := tests.make_affiliate('HIER4', 'NON_NEGATIVE_35', 3500, false);
      perform nova.set_affiliate_parent(v_l4, v_grand, 'level 4 under level 3');
      perform tests.assert((select depth from nova.affiliates where id = v_l4) = 3, 'level 4 is allowed at depth 3');
      v_l5 := tests.make_affiliate('HIER5', 'NON_NEGATIVE_35', 3500, false);
      perform tests.assert_raises(format('select nova.set_affiliate_parent(%L::uuid, %L::uuid, %L)', v_l5, v_l4, 'depth overflow'),
        'MAX_DEPTH_EXCEEDED', 'maximum hierarchy depth enforced');
    end;
    perform set_config('nova.user_role', '', false);
    perform set_config('nova.user_id', '', false);
  end;

  ------------------------------------------------------------------ parent override commission
  declare
    v_parent uuid; v_childaff uuid; v_user2 uuid; v_match2 uuid; v_parent_raw bigint; v_child_raw bigint;
  begin
    v_parent := tests.make_affiliate('PARCAP', 'NON_NEGATIVE_35', 3500, false);
    v_childaff := tests.make_affiliate('CHDCAP', 'NON_NEGATIVE_35', 3500, false, v_parent);
    insert into nova.affiliate_commission_configs (scope, scope_ref, commission_model, commission_rate_bps,
      allow_negative_balance, min_payout_minor, parent_override_bps, total_net_bps_cap, is_active)
    values ('AFFILIATE', v_childaff::text, 'NON_NEGATIVE_35', 3500, false, 5000000, 500, 6000, true);

    v_user2 := tests.make_user('override-user@test.local', 'user', 'active', true, 'IRT', 100000000);
    perform nova.attach_attribution(v_user2, 'CHDCAP');
    v_match2 := tests.make_match(30000);
    perform tests.run_bet(v_user2, v_match2, 'HOME', 10000000, 0, 'LOST', 'override-loss-0001');

    select coalesce(sum(amount_minor),0) into v_child_raw from nova.affiliate_ledger where affiliate_id = v_childaff;
    select coalesce(sum(amount_minor),0) into v_parent_raw from nova.affiliate_ledger where affiliate_id = v_parent;
    perform tests.assert(v_child_raw = 3500000, 'child affiliate earns 35% (3,500,000)');
    perform tests.assert(v_parent_raw = 500000, 'parent override 5% is paid to the parent (500,000)');
    perform tests.assert(v_child_raw + v_parent_raw <= 6000000, 'total commission respects the configured cap');
  end;

  ------------------------------------------------------------------ eligibility: void bet pays no commission
  declare
    v_aff_v uuid; v_user_v uuid; v_match_v uuid; v_before bigint; v_after bigint;
  begin
    v_aff_v := tests.make_affiliate('VOIDCOM', 'NON_NEGATIVE_35', 3500, false);
    v_user_v := tests.make_user('voidcom-user@test.local', 'user', 'active', true, 'IRT', 100000000);
    perform nova.attach_attribution(v_user_v, 'VOIDCOM');
    v_match_v := tests.make_match(30000);
    select coalesce(sum(amount_minor),0) into v_before from nova.affiliate_ledger where affiliate_id = v_aff_v;
    perform tests.run_bet(v_user_v, v_match_v, 'HOME', 10000000, 10000000, 'VOID', 'voidcom-void-0001');
    select coalesce(sum(amount_minor),0) into v_after from nova.affiliate_ledger where affiliate_id = v_aff_v;
    perform tests.assert(v_before = v_after, 'a void/refunded bet produces NO commission (net user result 0)');
  end;

  ------------------------------------------------------------------ reconciliation after the whole run
  v_result := nova.reconcile_financial_period(now() - interval '30 days', now() + interval '1 day', false);
  perform tests.assert((select count(*) from nova.reconciliation_records where status = 'mismatch') = 0,
    'no financial mismatches detected across betting + affiliate lifecycles');
  perform tests.assert((select count(*) from nova.affiliate_ledger al
     where al.type in ('user_loss_commission','user_win_debit') and al.bet_settlement_id is null
       and al.source_kind = 'bet_settlement') = 0,
    'every bet-derived commission entry references an authoritative settlement');
end $$;

select 'AFFILIATE TESTS PASSED' as result;
