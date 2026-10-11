-- ============================================================================
-- TEST FIXTURES (test-only; never part of supabase/migrations, therefore
-- structurally impossible to load into production - spec rule 87).
-- Creates a small deterministic world: users, an affiliate, a match with a real
-- market/selection and odds published through the production odds write path.
-- ============================================================================
create schema if not exists tests;
-- Fixtures run as the owner; the RLS tests switch to the `authenticated` role, so the
-- helper functions must stay executable for that role (test harness only).
grant usage on schema tests to authenticated, anon, public;

create or replace function tests.assert(p_condition boolean, p_message text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ASSERTION FAILED: %', p_message using errcode = 'P0001';
  end if;
end $$;

create or replace function tests.assert_raises(p_sql text, p_expected_fragment text, p_message text) returns void
language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
    if position(upper(p_expected_fragment) in upper(v_msg)) = 0 then
      raise exception 'ASSERTION FAILED: % (got "%", expected "%")', p_message, v_msg, p_expected_fragment using errcode = 'P0001';
    end if;
    return;
  end;
  raise exception 'ASSERTION FAILED: % (no exception raised)', p_message using errcode = 'P0001';
end $$;

create or replace function tests.make_user(
  p_email text,
  p_role user_role default 'user',
  p_status account_status default 'active',
  p_age_verified boolean default true,
  p_currency text default 'IRT',
  p_balance_minor bigint default 0
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  -- In production GoTrue creates auth.users on signup; the harness mirrors that.
  insert into auth.users (email) values (p_email) returning id into v_id;
  insert into nova.profiles (id, public_id, email, email_hash, role, status, age_verified, email_verified, preferred_currency, kyc_status)
  values (v_id, 'NU-' || upper(substr(md5(random()::text), 1, 8)), p_email,
          encode(digest(lower(p_email), 'sha256'), 'hex'), p_role, p_status, p_age_verified, true, p_currency, 'verified')
  returning id into v_id;
  insert into nova.wallets (user_id, currency, balance_minor) values (v_id, p_currency, 0);
  if p_balance_minor <> 0 then
    perform nova.post_wallet_entry(v_id, 'deposit', p_balance_minor, p_currency,
      'fixture:seed:' || v_id::text, 'TEST_FIXTURE_DEPOSIT', null, null, null,
      'test fixture balance', null, jsonb_build_object('fixture', true), null, false);
  end if;
  return v_id;
end $$;

create or replace function tests.make_match(p_odds_home bigint default 25000, p_status match_status default 'scheduled')
returns uuid
language plpgsql as $$
declare
  v_sport uuid; v_league uuid; v_country uuid; v_home uuid; v_away uuid; v_match uuid; v_market uuid;
begin
  select id into v_sport from nova.sports where slug = 'football';
  insert into nova.countries (code, name_en) values ('T' || upper(substr(md5(random()::text), 1, 4)), 'Testland')
    returning id into v_country;
  insert into nova.leagues (sport_id, country_id, slug, name)
  values (v_sport, v_country, 'test-league-' || substr(md5(random()::text), 1, 6), 'Test League') returning id into v_league;
  insert into nova.teams (sport_id, country_id, slug, name)
  values (v_sport, v_country, 'test-home-' || substr(md5(random()::text), 1, 6), 'Home FC') returning id into v_home;
  insert into nova.teams (sport_id, country_id, slug, name)
  values (v_sport, v_country, 'test-away-' || substr(md5(random()::text), 1, 6), 'Away FC') returning id into v_away;
  insert into nova.matches (sport_id, league_id, home_team_id, away_team_id, status, scheduled_at, provider, provider_id)
  values (v_sport, v_league, v_home, v_away, p_status, now() + interval '2 hours', 'test', 'test-' || substr(md5(random()::text), 1, 8))
  returning id into v_match;

  insert into nova.markets (match_id, key, type, name, status, display_order, is_live)
  values (v_match, '1X2', '1X2', 'Match Result', 'open', 10, false) returning id into v_market;
  insert into nova.selections (market_id, match_id, code, name, participant_type, odds_scaled, odds_version, odds_updated_at, provider, is_live)
  values
    (v_market, v_match, 'HOME', 'Home FC', 'HOME', p_odds_home, 1, now(), 'test', false),
    (v_market, v_match, 'DRAW', 'Draw', 'DRAW', 34000, 1, now(), 'test', false),
    (v_market, v_match, 'AWAY', 'Away FC', 'AWAY', 28000, 1, now(), 'test', false);
  return v_match;
end $$;

create or replace function tests.selection_of(p_match_id uuid, p_code text) returns uuid
language sql stable as $$
  select s.id from nova.selections s join nova.markets m on m.id = s.market_id
   where m.match_id = p_match_id and s.code = p_code limit 1
$$;
create or replace function tests.market_of(p_match_id uuid) returns uuid
language sql stable as $$ select id from nova.markets where match_id = p_match_id limit 1 $$;

create or replace function tests.make_affiliate(
  p_code text, p_model commission_model default 'NON_NEGATIVE_35', p_rate_bps int default 3500,
  p_allow_negative boolean default false, p_parent uuid default null, p_min_payout bigint default 5000000
) returns uuid
language plpgsql as $$
declare v_user uuid; v_id uuid;
begin
  v_user := tests.make_user(p_code || '@aff.test', 'affiliate', 'active', true);
  insert into nova.affiliates (user_id, public_id, code, slug, display_name, status, commission_model,
    commission_rate_bps, allow_negative_balance, min_payout_minor, parent_affiliate_id, depth)
  values (v_user, 'NA-' || upper(substr(md5(random()::text), 1, 8)), upper(p_code), lower(p_code), p_code,
    'approved', p_model, p_rate_bps, p_allow_negative, p_min_payout, p_parent, case when p_parent is null then 0 else 1 end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function tests.settle_bet_with_result(
  p_bet_id uuid, p_grade text, p_payout_minor bigint, p_revision int default 1
) returns jsonb
language plpgsql as $$
declare v_legs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('selection_id', l.selection_id, 'grade', p_grade, 'reason', 'TEST')), '[]'::jsonb)
    into v_legs from nova.bet_legs l where l.bet_id = p_bet_id;
  return nova.settle_bet(p_bet_id, v_legs, p_payout_minor,
    (select currency from nova.bets where id = p_bet_id), p_revision, 'test-worker');
end $$;

create or replace function tests.place_single(p_user uuid, p_match uuid, p_code text, p_stake bigint, p_key text, p_accepted bigint default null)
returns jsonb
language plpgsql as $$
declare v_sel uuid; v_seen bigint;
begin
  v_sel := tests.selection_of(p_match, p_code);
  select odds_scaled into v_seen from nova.selections where id = v_sel;
  return nova.place_bet(p_user, p_key, 'SINGLE', p_stake, 'IRT',
    jsonb_build_array(jsonb_build_object('match_id', p_match, 'market_id', tests.market_of(p_match),
      'selection_id', v_sel, 'odds_seen', coalesce(p_accepted, v_seen),
      'odds_version', (select odds_version from nova.selections where id = v_sel))),
    (p_accepted is not null), 'test', null, 'corr-test', null, null);
end $$;
