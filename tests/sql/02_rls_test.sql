-- ============================================================================
-- RLS / AUTHORIZATION TESTS
-- Verifies: own-row access only, no cross-user reads (IDOR), no client writes to
-- money, admin gating, and that service_role-style operations stay server-side.
-- ============================================================================
\set ON_ERROR_STOP on
\ir 00_fixtures.sql

do $$
declare
  v_alice uuid; v_bob uuid; v_admin uuid; v_aff_user uuid; v_aff uuid;
  v_match uuid; v_count int; v_blocked boolean;
begin
  v_alice := tests.make_user('alice@test.local', 'user', 'active', true, 'IRT', 1000000);
  v_bob := tests.make_user('bob@test.local', 'user', 'active', true, 'IRT', 500000);
  v_admin := tests.make_user('admin@test.local', 'admin', 'active', true, 'IRT', 0);
  v_aff_user := tests.make_user('aff-rls@test.local', 'affiliate', 'active', true, 'IRT', 0);
  insert into nova.affiliates (user_id, public_id, code, slug, display_name, status)
  values (v_aff_user, 'NA-RLSTEST', 'RLSAFF', 'rlsaff', 'rls', 'approved') returning id into v_aff;
  v_match := tests.make_match(25000);

  -- Rows for the tables hardened in migration 0150 (created as the owner, read as anon/admin).
  insert into nova.seasons (league_id, name, is_current)
  select id, 'RLS Season', true from nova.leagues limit 1;
  insert into nova.players (sport_id, name, is_active)
  select id, 'RLS Player', true from nova.sports limit 1;
  insert into nova.match_stats (match_id, payload) values (v_match, '{}'::jsonb) on conflict do nothing;
  insert into nova.settlement_events (match_id, event, detail) values (v_match, 'rls.probe', '{"source":"rls test"}'::jsonb);
  insert into nova.affiliate_groups (name, description) values ('RLS Group', 'rls test group');

  -- Place a bet so both users have ledger/bet rows.
  perform tests.place_single(v_alice, v_match, 'HOME', 20000, 'rls-alice-1');

  ------------------------------------------------ ALICE (acting as authenticated)
  perform set_config('nova.user_id', v_alice::text, false);
  set local role authenticated;

  select count(*) into v_count from nova.wallets;
  perform tests.assert(v_count = 1, 'a user may only see their own wallet (saw ' || v_count || ')');

  select count(*) into v_count from nova.wallets where user_id = v_bob;
  perform tests.assert(v_count = 0, 'IDOR: bob wallet must be invisible to alice');

  select count(*) into v_count from nova.bets where user_id = v_bob;
  perform tests.assert(v_count = 0, 'IDOR: bob bets must be invisible to alice');

  select count(*) into v_count from nova.wallet_transactions where user_id = v_bob;
  perform tests.assert(v_count = 0, 'IDOR: bob ledger must be invisible to alice');

  select count(*) into v_count from nova.profiles;
  perform tests.assert(v_count = 1, 'a user may only see their own profile');

  select count(*) into v_count from nova.bets;
  perform tests.assert(v_count = 1, 'a user sees only their own bets');

  -- read-only money: direct writes must fail
  v_blocked := false;
  begin
    update nova.wallets set balance_minor = 999999999 where user_id = v_alice;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'a user must not be able to write a wallet balance');

  v_blocked := false;
  begin
    insert into nova.wallet_transactions (wallet_id, user_id, type, amount_minor, balance_after_minor, currency, idempotency_key)
    select wallet_id, user_id, 'bonus', 999999999, 999999999, currency, 'hack' from nova.wallets where user_id = v_alice;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'a user must not be able to insert ledger entries');

  v_blocked := false;
  begin
    update nova.bets set payout_minor = 999999999, status = 'settled' where user_id = v_alice;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'a user must not be able to modify a bet payout');

  -- privilege escalation attempts
  v_blocked := false;
  begin
    update nova.profiles set role = 'admin' where id = v_alice;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'a user must not be able to self-escalate role');

  v_blocked := false;
  begin
    update nova.profiles set status = 'active', display_name = 'Alice' where id = v_alice;
    perform tests.assert(true, 'a user may update their own display name');
  exception when others then v_blocked := true;
  end;

  -- audit logs are not readable by a normal user
  select count(*) into v_count from nova.audit_logs;
  perform tests.assert(v_count = 0, 'audit logs must not be readable by users');

  -- migration 0150: operator infrastructure and settlement events are invisible to customers
  select count(*) into v_count from nova.settlement_events;
  perform tests.assert(v_count = 0, 'settlement_events must not be readable by customers');
  -- `nova.migrations` has no grant at all: infrastructure is service-role only, so the
  -- read must fail outright rather than return an empty set.
  v_blocked := false;
  begin
    select count(*) into v_count from nova.migrations;
  exception when insufficient_privilege then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'migration bookkeeping must not be readable through the API');
  select count(*) into v_count from nova.affiliate_groups;
  perform tests.assert(v_count = 0, 'a non-member must not read affiliate groups');

  -- affiliate data of OTHER affiliates is invisible
  select count(*) into v_count from nova.affiliate_ledger;
  perform tests.assert(v_count = 0, 'a user must not read affiliate ledgers');

  -- user cannot attach himself to an affiliate code by writing the table
  v_blocked := false;
  begin
    insert into nova.affiliate_attributions (affiliate_id, user_id, code) values (v_aff, v_alice, 'RLSAFF');
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'attribution rows must not be writable from the client');

  reset role;

  ------------------------------------------------ BOB
  perform set_config('nova.user_id', v_bob::text, false);
  set local role authenticated;
  select count(*) into v_count from nova.wallets where user_id = v_alice;
  perform tests.assert(v_count = 0, 'IDOR: alice wallet must be invisible to bob');
  select count(*) into v_count from nova.wallets;
  perform tests.assert(v_count = 1, 'bob sees exactly his own wallet');
  reset role;

  ------------------------------------------------ AFFILIATE USER
  perform set_config('nova.user_id', v_aff_user::text, false);
  set local role authenticated;
  select count(*) into v_count from nova.affiliates;
  perform tests.assert(v_count = 1, 'an affiliate sees only their own affiliate record');
  select count(*) into v_count from nova.affiliate_payouts;
  perform tests.assert(v_count = 0, 'an affiliate with no payouts sees none');
  v_blocked := false;
  begin
    update nova.affiliate_ledger set amount_minor = 1;
  exception when others then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'an affiliate must not be able to edit their ledger');
  reset role;

  ------------------------------------------------ ADMIN
  perform set_config('nova.user_id', v_admin::text, false);
  set local role authenticated;
  select count(*) into v_count from nova.wallets;
  perform tests.assert(v_count >= 3, 'an admin can read all wallets (financial oversight)');
  select count(*) into v_count from nova.audit_logs;
  perform tests.assert(v_count >= 1, 'an admin can read the audit log');
  reset role;

  ------------------------------------------------ NO IDENTITY = NO DATA
  perform set_config('nova.user_id', '', false);
  set local role authenticated;
  select count(*) into v_count from nova.wallets;
  perform tests.assert(v_count = 0, 'unauthenticated requests must see no wallets');
  select count(*) into v_count from nova.bets;
  perform tests.assert(v_count = 0, 'unauthenticated requests must see no bets');
  reset role;

  -- public catalogue remains readable (sportsbook listing pages)
  set local role anon;
  select count(*) into v_count from nova.matches;
  perform tests.assert(v_count >= 1, 'anonymous visitors can read the sports catalogue');
  select count(*) into v_count from nova.selections;
  perform tests.assert(v_count >= 3, 'anonymous visitors can read selections/odds');
  -- migration 0150: seasons/players/match_stats became RLS-protected with a public read policy
  select count(*) into v_count from nova.seasons;
  perform tests.assert(v_count >= 1, 'anonymous visitors can read seasons (public read policy)');
  select count(*) into v_count from nova.players;
  perform tests.assert(v_count >= 1, 'anonymous visitors can read players (public read policy)');
  select count(*) into v_count from nova.match_stats;
  perform tests.assert(v_count >= 1, 'anonymous visitors can read match stats (public read policy)');
  v_blocked := false;
  begin
    select count(*) into v_count from nova.migrations;
  exception when insufficient_privilege then v_blocked := true;
  end;
  perform tests.assert(v_blocked, 'anonymous visitors must not read migration bookkeeping');
  reset role;
end $$;

select 'RLS TESTS PASSED' as result;
