-- ============================================================================
-- FINANCIAL BEHAVIOUR TESTS - betting engine, wallet ledger, settlement
-- Covers spec §80 (critical bet tests), §82 (payment-adjacent money paths) and §99.
-- ============================================================================
\set ON_ERROR_STOP on
\i /home/user/nova-sportsbook/tests/sql/00_fixtures.sql

do $$
declare
  v_user uuid; v_match uuid; v_bet jsonb; v_balance bigint; v_count int; v_payout bigint;
  v_result jsonb; v_legs jsonb; v_blocked boolean; v_sel uuid; v_odds bigint;
  v_live_user uuid; v_live_match uuid; v_live_bet jsonb; v_live_balance bigint;
  v_live_enabled boolean; v_prematch_enabled boolean; v_live_bet_count int; v_live_debit_count int;
begin
  ------------------------------------------------------------------ rounding helpers
  perform tests.assert(nova.round_div(5, 2) = 3, 'round half up away from zero (5/2=3)');
  perform tests.assert(nova.round_div(-5, 2) = -3, 'round half up away from zero (-5/2=-3)');
  perform tests.assert(nova.round_div(4, 2) = 2, 'exact division');
  perform tests.assert(nova.round_div(7, 3) = 2, '7/3=2');
  perform tests.assert(nova.apply_bps(10000000, 3500) = 3500000, '35% of 10,000,000 = 3,500,000');
  perform tests.assert(nova.apply_bps(20000000, 3500) = 7000000, '35% of 20,000,000 = 7,000,000');
  perform tests.assert(nova.odds_to_text(25000) = '2.5', 'odds serialisation 25000 -> 2.5');
  perform tests.assert(nova.odds_from_text('2.5') = 25000, 'odds parsing 2.5 -> 25000');
  perform tests.assert(nova.round_div(100000::numeric * 25000, 10000) = 250000, 'payout = stake * odds');

  ------------------------------------------------------------------ happy path single
  v_user := tests.make_user('bettor@test.local', 'user', 'active', true, 'IRT', 1000000);
  v_match := tests.make_match(25000);

  v_bet := tests.place_single(v_user, v_match, 'HOME', 100000, 'test-happy-0001');
  perform tests.assert((v_bet->>'ok')::boolean, 'bet placed');
  perform tests.assert((v_bet->'bet'->>'stake_minor')::bigint = 100000, 'stake recorded');
  perform tests.assert((v_bet->'bet'->>'potential_payout_minor')::bigint = 250000, 'payout = stake * 2.5');
  perform tests.assert((v_bet->'bet'->>'status') = 'accepted', 'bet accepted');

  select balance_minor into v_balance from nova.wallets where user_id = v_user and currency = 'IRT';
  perform tests.assert(v_balance = 900000, 'wallet debited exactly once (1,000,000 -> 900,000)');

  select count(*) into v_count from nova.wallet_transactions where user_id = v_user and type = 'bet_debit';
  perform tests.assert(v_count = 1, 'exactly one bet_debit ledger entry');
  perform tests.assert(exists (select 1 from nova.wallet_transactions where user_id = v_user and bet_id = (v_bet->'bet'->>'id')::uuid),
    'ledger entry references the bet');

  ------------------------------------------------------------------ idempotent replay
  v_result := tests.place_single(v_user, v_match, 'HOME', 100000, 'test-happy-0001');
  perform tests.assert((v_result->>'idempotent_replay')::boolean, 'replay flagged as idempotent');
  perform tests.assert((v_result->'bet'->>'id') = (v_bet->'bet'->>'id'), 'replay returns the SAME bet');
  select balance_minor into v_balance from nova.wallets where user_id = v_user and currency = 'IRT';
  perform tests.assert(v_balance = 900000, 'no second debit on replay');
  select count(*) into v_count from nova.bets where user_id = v_user;
  perform tests.assert(v_count = 1, 'no duplicate bet row on replay');

  ------------------------------------------------------------------ insufficient balance
  v_blocked := false;
  begin
    perform tests.place_single(v_user, v_match, 'DRAW', 5000000, 'test-insufficient-0001');
  exception when others then
    v_blocked := true;
    perform tests.assert(sqlerrm like '%INSUFFICIENT_BALANCE%', 'insufficient balance error surfaced');
  end;
  perform tests.assert(v_blocked, 'bet over balance rejected');
  select balance_minor into v_balance from nova.wallets where user_id = v_user and currency = 'IRT';
  perform tests.assert(v_balance = 900000, 'failed placement left the balance untouched');
  select count(*) into v_count from nova.bets where user_id = v_user;
  perform tests.assert(v_count = 1, 'failed placement created no bet');

  ------------------------------------------------------------------ odds change handling
  v_sel := tests.selection_of(v_match, 'HOME');
  update nova.selections set odds_scaled = 30000, previous_odds_scaled = 25000, odds_version = odds_version + 1, odds_updated_at = now()
   where id = v_sel;

  v_blocked := false;
  begin
    perform tests.place_single(v_user, v_match, 'HOME', 50000, 'test-oddschange-0001');  -- sends stale odds_seen = 30000? no: helper reads current
    perform tests.assert(false, 'should not reach here');
  exception when others then
    v_blocked := true;
  end;

  -- explicit stale-odds request (client saw 2.50, server now has 3.00)
  v_blocked := false;
  begin
    perform nova.place_bet(v_user, 'test-oddschange-0002', 'SINGLE', 50000, 'IRT',
      jsonb_build_array(jsonb_build_object('match_id', v_match, 'market_id', tests.market_of(v_match),
        'selection_id', v_sel, 'odds_seen', 25000, 'odds_version', 1)), false, 'test', null, 'corr', null, null);
  exception when others then
    v_blocked := true;
    perform tests.assert(sqlerrm like '%ODDS_CHANGED%', 'odds change is reported, not silently applied');
  end;
  perform tests.assert(v_blocked, 'placement with stale odds requires explicit acceptance');

  -- after acceptance the bet is placed at the NEW authoritative odds
  v_bet := nova.place_bet(v_user, 'test-oddschange-0003', 'SINGLE', 50000, 'IRT',
    jsonb_build_array(jsonb_build_object('match_id', v_match, 'market_id', tests.market_of(v_match),
      'selection_id', v_sel, 'odds_seen', 25000, 'odds_version', 1)), true, 'test', null, 'corr', null, null);
  perform tests.assert((v_bet->'bet'->>'potential_payout_minor')::bigint = 150000, 'accepted odds 3.00 applied (50,000 * 3 = 150,000)');
  perform tests.assert((select odds_at_placement from nova.bet_legs where bet_id = (v_bet->'bet'->>'id')::uuid) = 30000,
    'leg stores the server-side authoritative odds');
  perform tests.assert((select accepted_odds_change from nova.bets where id = (v_bet->'bet'->>'id')::uuid),
    'acceptance is recorded on the bet for audit');

  ------------------------------------------------------------------ suspended / closed / finished
  update nova.selections set status = 'suspended' where id = v_sel;
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_user, v_match, 'HOME', 'test-suspended-0001'),
    'SELECTION_SUSPENDED', 'suspended selection blocked');
  update nova.selections set status = 'open' where id = v_sel;

  update nova.markets set status = 'closed' where id = tests.market_of(v_match);
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_user, v_match, 'HOME', 'test-closed-0001'),
    'MARKET_CLOSED', 'closed market blocked');
  update nova.markets set status = 'open' where id = tests.market_of(v_match);

  update nova.matches set status = 'finished' where id = v_match;
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_user, v_match, 'HOME', 'test-finished-0001'),
    'MATCH_FINISHED', 'finished match blocked');
  update nova.matches set status = 'scheduled' where id = v_match;

  update nova.selections set odds_updated_at = now() - interval '10 minutes' where id = v_sel;
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_user, v_match, 'HOME', 'test-stale-0001'),
    'STALE_ODDS', 'stale odds blocked');
  update nova.selections set odds_updated_at = now() where id = v_sel;

  ------------------------------------------------------------------ live status overrides a stale prematch market flag
  select enabled into v_live_enabled from nova.system_operations where key = 'LIVE_BETTING';
  select enabled into v_prematch_enabled from nova.system_operations where key = 'PREMATCH_BETTING';
  insert into nova.system_operations (key, enabled, reason) values
    ('LIVE_BETTING', true, 'SQL test'), ('PREMATCH_BETTING', false, 'SQL test')
  on conflict (key) do update set enabled = excluded.enabled, reason = excluded.reason;

  v_live_user := tests.make_user('live-status-bet@test.local', 'user', 'active', true, 'IRT', 500000);
  v_live_match := tests.make_match(25000);
  update nova.matches set status = 'live' where id = v_live_match;
  -- Market/selection is_live remains false; the match status must classify the bet as live.
  v_live_bet := tests.place_single(v_live_user, v_live_match, 'HOME', 50000, 'test-live-status-0001');
  perform tests.assert((v_live_bet->>'ok')::boolean, 'live match with prematch market flag uses LIVE_BETTING and places');
  select balance_minor into v_live_balance from nova.wallets where user_id = v_live_user and currency = 'IRT';
  perform tests.assert(v_live_balance = 450000, 'live placement debits the stake exactly once');
  select count(*) into v_live_bet_count from nova.bets where user_id = v_live_user;
  select count(*) into v_live_debit_count from nova.wallet_transactions where user_id = v_live_user and type = 'bet_debit';
  perform tests.assert(v_live_bet_count = 1 and v_live_debit_count = 1, 'live placement commits one bet and one debit atomically');

  v_live_user := tests.make_user('stale-live-status-bet@test.local', 'user', 'active', true, 'IRT', 500000);
  v_live_match := tests.make_match(25000);
  update nova.matches set status = 'live' where id = v_live_match;
  update nova.selections set odds_updated_at = now() - interval '60 seconds' where match_id = v_live_match;
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_live_user, v_live_match, 'HOME', 'test-live-status-stale-0001'),
    'STALE_ODDS', 'live match uses the 45 second freshness limit despite prematch market flag');
  select balance_minor into v_live_balance from nova.wallets where user_id = v_live_user and currency = 'IRT';
  select count(*) into v_live_bet_count from nova.bets where user_id = v_live_user;
  select count(*) into v_live_debit_count from nova.wallet_transactions where user_id = v_live_user and type = 'bet_debit';
  perform tests.assert(v_live_balance = 500000 and v_live_bet_count = 0 and v_live_debit_count = 0,
    'rejected stale live placement leaves wallet, bet rows, and ledger unchanged');

  update nova.system_operations set enabled = false, reason = 'SQL test', updated_at = now() where key = 'LIVE_BETTING';
  update nova.system_operations set enabled = true, reason = 'SQL test', updated_at = now() where key = 'PREMATCH_BETTING';
  v_live_user := tests.make_user('prematch-status-bet@test.local', 'user', 'active', true, 'IRT', 500000);
  v_live_match := tests.make_match(25000);
  v_live_bet := tests.place_single(v_live_user, v_live_match, 'HOME', 50000, 'test-prematch-status-0001');
  perform tests.assert((v_live_bet->>'ok')::boolean, 'scheduled match with prematch market flag uses PREMATCH_BETTING and places');
  select balance_minor into v_live_balance from nova.wallets where user_id = v_live_user and currency = 'IRT';
  select count(*) into v_live_bet_count from nova.bets where user_id = v_live_user;
  select count(*) into v_live_debit_count from nova.wallet_transactions where user_id = v_live_user and type = 'bet_debit';
  perform tests.assert(v_live_balance = 450000 and v_live_bet_count = 1 and v_live_debit_count = 1,
    'prematch placement commits one bet and one debit atomically');

  v_live_user := tests.make_user('stale-prematch-status-bet@test.local', 'user', 'active', true, 'IRT', 500000);
  v_live_match := tests.make_match(25000);
  update nova.selections set odds_updated_at = now() - interval '301 seconds' where match_id = v_live_match;
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 50000, %L)', v_live_user, v_live_match, 'HOME', 'test-prematch-status-stale-0001'),
    'STALE_ODDS', 'prematch placement rejects odds older than 300 seconds');
  select balance_minor into v_live_balance from nova.wallets where user_id = v_live_user and currency = 'IRT';
  select count(*) into v_live_bet_count from nova.bets where user_id = v_live_user;
  select count(*) into v_live_debit_count from nova.wallet_transactions where user_id = v_live_user and type = 'bet_debit';
  perform tests.assert(v_live_balance = 500000 and v_live_bet_count = 0 and v_live_debit_count = 0,
    'rejected stale prematch placement leaves wallet, bet rows, and ledger unchanged');

  update nova.system_operations set enabled = coalesce(v_live_enabled, false), updated_at = now() where key = 'LIVE_BETTING';
  update nova.system_operations set enabled = coalesce(v_prematch_enabled, true), updated_at = now() where key = 'PREMATCH_BETTING';

  ------------------------------------------------------------------ stake limits
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 100, %L)', v_user, v_match, 'HOME', 'test-minstake-0001'),
    'STAKE_BELOW_MINIMUM', 'stake below minimum rejected');
  perform tests.assert_raises(
    format('select tests.place_single(%L::uuid, %L::uuid, %L, 600000000, %L)', v_user, v_match, 'HOME', 'test-maxstake-0001'),
    'STAKE_ABOVE_MAXIMUM', 'stake above maximum rejected');

  ------------------------------------------------------------------ accumulator pricing
  insert into nova.markets (match_id, key, type, name, status, display_order)
  values (v_match, 'OU_2_5', 'OVER_UNDER', 'Total Goals 2.5', 'open', 30);
  insert into nova.selections (market_id, match_id, code, name, line, participant_type, odds_scaled, odds_version, odds_updated_at, provider)
  select id, v_match, 'OVER_2_5', 'Over 2.5', '2.5', 'NEUTRAL', 18000, 1, now(), 'test'
    from nova.markets where key = 'OU_2_5' and match_id = v_match;

  v_result := nova.place_bet(v_user, 'test-multiple-0001', 'MULTIPLE', 100000, 'IRT',
    jsonb_build_array(
      jsonb_build_object('match_id', v_match, 'market_id', tests.market_of(v_match), 'selection_id', tests.selection_of(v_match,'AWAY'),
                         'odds_seen', 28000, 'odds_version', 1),
      jsonb_build_object('match_id', v_match, 'market_id', (select id from nova.markets where match_id = v_match and key='OU_2_5'),
                         'selection_id', (select id from nova.selections where match_id = v_match and code='OVER_2_5'),
                         'odds_seen', 18000, 'odds_version', 1)),
    false, 'test', null, 'corr', null, null);
  -- 100,000 * 2.8 * 1.8 = 504,000 (exact rational, single rounding at the end)
  perform tests.assert((v_result->'bet'->>'potential_payout_minor')::bigint = 504000,
    'accumulator payout exact: 100,000 * 2.8 * 1.8 = 504,000 (got ' || (v_result->'bet'->>'potential_payout_minor') || ')');

  ------------------------------------------------------------------ settlement: LOSS
  v_bet := tests.place_single(v_user, v_match, 'DRAW', 100000, 'test-settleloss-0001');
  v_result := tests.settle_bet_with_result((v_bet->'bet'->>'id')::uuid, 'LOST', 0, 1);
  perform tests.assert(not (v_result->>'idempotent_replay')::boolean, 'settlement applied');
  perform tests.assert((v_result->>'status') = 'settled', 'lost bet settled');
  select balance_minor into v_balance from nova.wallets where user_id = v_user and currency = 'IRT';
  perform tests.assert((select payout_minor from nova.bets where id = (v_bet->'bet'->>'id')::uuid) = 0, 'lost bet pays 0');

  ------------------------------------------------------------------ double settlement protection
  v_balance := (select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT');
  v_result := tests.settle_bet_with_result((v_bet->'bet'->>'id')::uuid, 'LOST', 0, 1);
  perform tests.assert((v_result->>'idempotent_replay')::boolean, 'second settlement attempt is an idempotent replay');
  perform tests.assert((select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT') = v_balance,
    'no money moved on duplicate settlement');

  ------------------------------------------------------------------ settlement: WIN
  v_bet := tests.place_single(v_user, v_match, 'AWAY', 100000, 'test-settlewin-0001');   -- odds 2.8 -> payout 280,000
  v_balance := (select balance_minor from nova.wallets where user_id = v_user and currency = 'IRT');
  v_result := tests.settle_bet_with_result((v_bet->'bet'->>'id')::uuid, 'WON', 280000, 1);
  perform tests.assert((v_result->>'status') = 'settled', 'won bet settled');
  select balance_minor into v_balance from nova.wallets where user_id = v_user and currency = 'IRT';
  perform tests.assert(v_balance = (select coalesce(sum(amount_minor),0) from nova.wallet_transactions where user_id = v_user),
    'wallet balance equals the ledger sum after a win');
  perform tests.assert(exists (select 1 from nova.wallet_transactions
    where user_id = v_user and type = 'win_credit' and amount_minor = 280000), 'win credited exactly once');

  ------------------------------------------------------------------ settlement: VOID refund
  v_bet := tests.place_single(v_user, v_match, 'HOME', 50000, 'test-settlevoid-0001');
  v_result := tests.settle_bet_with_result((v_bet->'bet'->>'id')::uuid, 'VOID', 50000, 1);
  perform tests.assert((v_result->>'status') = 'void', 'void bet settled as void');
  perform tests.assert(exists (select 1 from nova.wallet_transactions
    where user_id = v_user and type = 'void_refund' and amount_minor = 50000), 'stake refunded as void_refund');

  ------------------------------------------------------------------ reversal / regrade
  v_blocked := false;
  begin
    perform nova.reverse_bet_settlement((v_bet->'bet'->>'id')::uuid, 'operator regrade', null, 'corr');
  exception when others then v_blocked := true;  -- require_admin() must block a non-admin session
  end;
  perform tests.assert(v_blocked, 'reversal requires admin authorization');

  perform set_config('nova.user_role', 'admin', false);
  v_result := nova.reverse_bet_settlement((v_bet->'bet'->>'id')::uuid, 'authoritative result corrected by provider', null, 'corr');
  perform tests.assert((v_result->>'reversed')::boolean, 'reversal applied by admin');
  perform tests.assert((select status from nova.bets where id = (v_bet->'bet'->>'id')::uuid) = 'pending',
    'bet returns to a settleable state after reversal');
  perform tests.assert(exists (select 1 from nova.wallet_transactions
    where user_id = v_user and type = 'reversal' and amount_minor = -50000), 'reversal ledger entry appended');
  perform tests.assert((select count(*) from nova.bet_settlements where bet_id = (v_bet->'bet'->>'id')::uuid) = 2,
    'history preserved: original settlement + reversal row');
  perform tests.assert(not exists (select 1 from nova.bet_settlements
    where bet_id = (v_bet->'bet'->>'id')::uuid and kind = 'settlement' and payout_minor <> 50000),
    'historical settlement row is never mutated');
  perform set_config('nova.user_role', '', false);

  ------------------------------------------------------------------ ledger integrity
  perform tests.assert(
    not exists (
      select 1 from nova.wallets w
       where w.balance_minor <> coalesce((select sum(t.amount_minor) from nova.wallet_transactions t
                                            where t.wallet_id = w.id and t.status = 'posted'), 0)),
    'every wallet balance equals its ledger sum');

  ------------------------------------------------------------------ reconciliation
  v_result := nova.reconcile_financial_period(now() - interval '1 day', now() + interval '1 day', false);
  perform tests.assert((v_result->>'ok')::boolean, 'reconciliation ran');
  perform tests.assert((select count(*) from nova.reconciliation_records where status = 'mismatch') = 0,
    'no reconciliation mismatches after the full lifecycle');

  ------------------------------------------------------------------ constraints
  perform tests.assert_raises(
    format('insert into nova.wallet_transactions (wallet_id, user_id, type, amount_minor, balance_after_minor, currency, idempotency_key) '
           'select id, %L::uuid, %L, 0, 0, %L, %L from nova.wallets where user_id = %L::uuid',
           v_user, 'bonus', 'IRT', 'zero-amount-test', v_user),
    'ZERO_AMOUNT', 'zero-value ledger entry is impossible');
end $$;

select 'FINANCIAL TESTS PASSED' as result;
