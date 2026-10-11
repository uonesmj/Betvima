-- ============================================================================
-- 05 - CASH-OUT + ADMIN GOVERNANCE
-- Cash-out: server-priced, single-use, exactly-once payout.
-- Admin: dual approval for manual money movement, immutable audit trail.
-- ============================================================================
\set ON_ERROR_STOP on
set search_path = nova, public, tests;

-- Make sure the switch is deterministic for this suite. Admin context is supplied the
-- same way the other suites do it (session-level role claim), never by table writes.
do $$ begin
  perform set_config('nova.user_role', 'admin', false);
  perform nova.set_operation('CASHOUT', true, null, 'test suite');
  perform set_config('nova.user_role', '', false);
end $$;

-- ---------------------------------------------------------------- cash-out
do $$
declare
  v_user uuid := tests.make_user('cashout1@test.local', 'user', 'active', true, 'IRT', 1000000);
  v_match uuid := tests.make_match(20000);           -- home at 2.00
  v_bet jsonb; v_quote jsonb; v_accepted jsonb; v_again jsonb;
  v_quote_id uuid; v_offer bigint; v_balance bigint; v_stake bigint := 100000;
begin
  v_bet := tests.place_single(v_user, v_match, 'HOME', v_stake, 'cashout-key-0001');
  perform tests.assert((v_bet ->> 'ok')::boolean, 'cash-out fixture bet placed');
  perform tests.assert((v_bet -> 'bet' ->> 'status') = 'accepted', 'cash-out fixture bet accepted');

  -- Live price moves up: the offer must follow the server price, not the client.
  update nova.selections set odds_scaled = 30000, odds_version = odds_version + 1
   where id = tests.selection_of(v_match, 'HOME');

  v_quote := nova.cashout_quote((v_bet -> 'bet' ->> 'id')::uuid, v_user, 500, 60);
  perform tests.assert((v_quote ->> 'available')::boolean, 'cash-out quote available');
  -- value = 100,000 * 3.00 * (1 - 0.05) = 285,000
  v_offer := (v_quote ->> 'offer_minor')::bigint;
  perform tests.assert(v_offer = 285000, 'cash-out offer follows the authoritative live price (got ' || v_offer || ')');
  v_quote_id := (v_quote ->> 'quote_id')::uuid;

  v_accepted := nova.accept_cashout((v_bet -> 'bet' ->> 'id')::uuid, v_quote_id, v_user, 'cashout-key-0001');
  perform tests.assert((v_accepted ->> 'status') = 'accepted', 'cash-out accepted');
  v_balance := (select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT');
  perform tests.assert(v_balance = 1000000 - 100000 + 285000, 'balance = seed - stake + offer (got ' || v_balance || ')');

  -- Second accept must be an idempotent replay and must not pay twice.
  v_again := nova.accept_cashout((v_bet -> 'bet' ->> 'id')::uuid, v_quote_id, v_user, 'cashout-key-0001');
  perform tests.assert((v_again ->> 'status') = 'idempotent_replay', 'second accept replays instead of paying');
  perform tests.assert((select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT') = v_balance,
               'no double cash-out payout');
  perform tests.assert((select status from nova.bets where id = (v_bet -> 'bet' ->> 'id')::uuid) = 'cashed_out',
               'bet marked cashed_out');
  perform tests.assert((select count(*) from nova.wallet_transactions where user_id = v_user and type = 'cashout') = 1,
               'exactly one cash-out ledger entry');
  perform tests.assert((select coalesce(sum(amount_minor),0) from nova.wallet_transactions where user_id = v_user)
               = (select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT'),
               'ledger sum equals wallet balance after cash-out');
end $$;

do $$
declare
  v_user uuid := tests.make_user('cashout2@test.local', 'user', 'active', true, 'IRT', 500000);
  v_match uuid := tests.make_match(20000);
  v_bet jsonb; v_quote jsonb;
begin
  v_bet := tests.place_single(v_user, v_match, 'HOME', 50000, 'cashout-key-0002');
  -- Suspending the market must block cash-out rather than guess a price.
  update nova.markets set status = 'suspended' where id = tests.market_of(v_match);
  v_quote := nova.cashout_quote((v_bet -> 'bet' ->> 'id')::uuid, v_user, 500, 60);
  perform tests.assert((v_quote ->> 'available')::boolean = false, 'suspended market blocks cash-out');
  perform tests.assert((v_quote ->> 'reason') = 'MARKET_SUSPENDED', 'cash-out blocked with MARKET_SUSPENDED');
end $$;

do $$
declare
  v_user uuid := tests.make_user('cashout3@test.local', 'user', 'active', true, 'IRT', 500000);
  v_other uuid := tests.make_user('cashout4@test.local', 'user', 'active', true, 'IRT', 500000);
  v_match uuid := tests.make_match(20000);
  v_bet jsonb; v_quote jsonb;
begin
  v_bet := tests.place_single(v_user, v_match, 'HOME', 50000, 'cashout-key-0003');
  v_quote := nova.cashout_quote((v_bet -> 'bet' ->> 'id')::uuid, v_other, 500, 60);
  perform tests.assert((v_quote ->> 'available')::boolean = false, 'another user cannot price someone else''s bet');
  perform tests.assert((v_quote ->> 'reason') = 'BET_NOT_FOUND', 'cross-user cash-out is invisible, not forbidden-by-inspection');
end $$;

do $$
declare
  v_user uuid := tests.make_user('cashout5@test.local', 'user', 'active', true, 'IRT', 500000);
  v_match uuid := tests.make_match(20000);
  v_bet jsonb; v_quote jsonb; v_quote_id uuid;
begin
  v_bet := tests.place_single(v_user, v_match, 'HOME', 50000, 'cashout-key-0004');
  v_quote := nova.cashout_quote((v_bet -> 'bet' ->> 'id')::uuid, v_user, 500, 60);
  v_quote_id := (v_quote ->> 'quote_id')::uuid;
  update nova.cashout_quotes set expires_at = now() - interval '1 second' where id = v_quote_id;
  begin
    perform nova.accept_cashout((v_bet -> 'bet' ->> 'id')::uuid, v_quote_id, v_user, 'cashout-key-0004');
    raise exception 'ASSERTION FAILED: expired quote accepted';
  exception when others then
    perform tests.assert(position('ODDS_EXPIRED' in sqlerrm) > 0, 'expired quote is rejected: ' || sqlerrm);
  end;
end $$;

-- Kill switch: with CASHOUT disabled the feature reports FEATURE_DISABLED.
do $$
declare
  v_user uuid := tests.make_user('cashout6@test.local', 'user', 'active', true, 'IRT', 500000);
  v_match uuid := tests.make_match(20000);
  v_bet jsonb; v_quote jsonb;
begin
  perform set_config('nova.user_role', 'admin', false);
  perform nova.set_operation('CASHOUT', false, null, 'test suite');
  perform set_config('nova.user_role', '', false);
  v_bet := tests.place_single(v_user, v_match, 'HOME', 50000, 'cashout-key-0005');
  v_quote := nova.cashout_quote((v_bet -> 'bet' ->> 'id')::uuid, v_user, 500, 60);
  perform tests.assert((v_quote ->> 'available')::boolean = false, 'kill switch disables cash-out');
  perform tests.assert((v_quote ->> 'reason') = 'FEATURE_DISABLED', 'kill switch reason reported honestly');
  perform set_config('nova.user_role', 'admin', false);
  perform nova.set_operation('CASHOUT', true, null, 'test suite');
  perform set_config('nova.user_role', '', false);
end $$;

-- ------------------------------------------------------- admin governance
do $$
declare
  v_admin uuid := tests.make_user('cashout-admin@test.local', 'admin', 'active', true, 'IRT', 0);
  v_user uuid := tests.make_user('cashout-target@test.local', 'user', 'active', true, 'IRT', 100000);
  v_req uuid; v_entry jsonb;
begin
  -- A single admin may not self-approve: the request must be created pending and
  -- approved by somebody else.
  insert into nova.admin_adjustments (user_id, currency, amount_minor, direction, adjustment_type, reason, requested_by, requires_dual_approval)
  values (v_user, 'IRT', 250000, 'credit', 'goodwill', 'service recovery', v_admin, true)
  returning id into v_req;

  begin
    update nova.admin_adjustments set status = 'approved', approved_by = v_admin, approved_at = now() where id = v_req;
    raise exception 'ASSERTION FAILED: self approval accepted';
  exception when others then
    perform tests.assert(position('SELF_APPROVAL_BLOCKED' in sqlerrm) > 0, 'self-approval is blocked: ' || sqlerrm);
  end;

  -- Terminal states cannot be reopened.
  update nova.admin_adjustments set status = 'rejected', decision_reason = 'duplicate' where id = v_req;
  begin
    update nova.admin_adjustments set status = 'approved' where id = v_req;
    raise exception 'ASSERTION FAILED: rejected adjustment reopened';
  exception when others then
    perform tests.assert(position('CONFLICT' in sqlerrm) > 0, 'terminal adjustment state is immutable: ' || sqlerrm);
  end;

  perform tests.assert((select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT') = 100000,
               'no money moved without an approved adjustment');
end $$;

do $$
declare
  v_admin uuid := tests.make_user('cashout-admin2@test.local', 'admin', 'active', true, 'IRT', 0);
  v_user uuid := tests.make_user('cashout-target2@test.local', 'user', 'active', true, 'IRT', 100000);
  v_row record;
begin
  insert into nova.user_limits (user_id, currency, max_stake_per_bet_minor, loss_limit_daily_minor)
  values (v_user, 'IRT', 500000, 2000000) on conflict (user_id, currency) do nothing;
  select * into v_row from nova.user_limits where user_id = v_user;
  perform tests.assert(v_row.max_stake_per_bet_minor = 500000, 'user limits persisted');
  perform tests.assert(v_row.loss_limit_daily_minor = 2000000, 'responsible-gaming limit persisted');
end $$;

-- Payment methods exist but are disabled while no provider is configured (honest state).
do $$
begin
  perform tests.assert((select count(*) from nova.payment_methods) >= 4, 'payment method catalogue seeded');
  perform tests.assert((select count(*) from nova.payment_methods where is_enabled) = 0,
               'no payment method claims to be available without a provider');
  perform tests.assert((select unavailable_reason from nova.payment_methods where id = 'card_gateway') = 'PAYMENT_PROVIDER_DISABLED',
               'unavailable reason is explicit');
end $$;

-- Notification templates are seeded for both locales and never claim delivery.
do $$
begin
  perform tests.assert((select count(*) from nova.notification_templates where locale = 'fa') >= 15, 'fa templates seeded');
  perform tests.assert((select count(*) from nova.notification_templates where locale = 'en') >= 15, 'en templates seeded');
end $$;

select 'CASHOUT + ADMIN TESTS PASSED' as result;
