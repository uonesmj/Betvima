-- ============================================================================
-- 0080 - nova.place_bet : THE ATOMIC BET PLACEMENT TRANSACTION
--
-- Everything from wallet locking to the audit record happens inside this single
-- function call (one transaction). Any failure raises and rolls back EVERYTHING:
-- no debit without a bet, no bet without a debit (spec §13, §14).
--
-- The function re-validates independently of the API layer: it never trusts
-- client odds, stake, payout, balance or identity (rules 24-28).
-- ============================================================================

create or replace function nova.place_bet(
  p_user_id            uuid,
  p_idempotency_key    text,
  p_mode               bet_type,
  p_stake_minor        bigint,
  p_currency           text,
  p_selections         jsonb,      -- [{"match_id":..,"market_id":..,"selection_id":..,"odds_seen":N,"odds_version":N}]
  p_accept_odds_change boolean default false,
  p_device             text default null,
  p_campaign           text default null,
  p_correlation_id     text default null,
  p_ip_hash            text default null,
  p_user_agent         text default null,
  p_prematch_max_age_seconds int default 45,
  p_live_max_age_seconds     int default 12,
  p_max_legs           int default 20
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_bet            nova.bets%rowtype;
  v_existing_bet   nova.bets%rowtype;
  v_item           jsonb;
  v_sel            nova.selections%rowtype;
  v_mkt            nova.markets%rowtype;
  v_match          nova.matches%rowtype;
  v_legs           jsonb := '[]'::jsonb;
  v_leg_count      int := 0;
  v_num            numeric := 1;
  v_den            numeric := 1;
  v_combined       bigint;
  v_payout_minor   bigint;
  v_bet_id         uuid;
  v_public_id      text;
  v_wallet_result  jsonb;
  v_changes        jsonb := '[]'::jsonb;
  v_profile        nova.profiles%rowtype;
  v_attribution    nova.affiliate_attributions%rowtype;
  v_max_age        int;
  v_now            timestamptz := now();
  v_restrictions   int;
  v_min_stake      bigint;
  v_max_stake      bigint;
  v_max_payout     bigint;
  v_daily_stake    bigint;
  v_resolved       jsonb := '[]'::jsonb;
begin
  /* ---------------- 1/2 identity + account validation ---------------- */
  if p_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_stake_minor is null or p_stake_minor <= 0 then
    raise exception 'VALIDATION_ERROR: stake must be positive' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'BETSLIP_EMPTY' using errcode = '22023';
  end if;
  if jsonb_array_length(p_selections) > p_max_legs then
    raise exception 'TOO_MANY_SELECTIONS' using errcode = '22023';
  end if;

  if nova.maintenance_mode() then
    raise exception 'MAINTENANCE_MODE' using errcode = 'P0001';
  end if;
  if not nova.operation_enabled('BETTING') then
    raise exception 'BETTING_DISABLED' using errcode = 'P0001';
  end if;

  select * into v_profile from nova.profiles where id = p_user_id;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if v_profile.status in ('suspended','closed','self_excluded','restricted') then
    raise exception 'ACCOUNT_RESTRICTED:%', v_profile.status using errcode = '42501';
  end if;
  if not v_profile.age_verified then
    raise exception 'AGE_NOT_VERIFIED' using errcode = '42501';
  end if;
  select count(*) into v_restrictions from nova.user_restrictions
   where user_id = p_user_id and is_active
     and kind in ('self_exclusion','cooling_off','account_restriction')
     and (effective_to is null or effective_to > v_now);
  if v_restrictions > 0 then
    raise exception 'ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  /* ---------------- 3 idempotency (before any lock contention) ---------------- */
  select * into v_existing_bet from nova.bets
   where user_id = p_user_id and placement_idempotency_key = p_idempotency_key;
  if found then
    return nova.bet_payload(v_existing_bet.id, true);
  end if;

  /* ---------------- 4 market/match/odds revalidation under locks ---------------- */
  for v_item in select * from jsonb_array_elements(p_selections)
  loop
    select * into v_sel from nova.selections where id = (v_item->>'selection_id')::uuid for update;
    if not found then
      raise exception 'NOT_FOUND: selection %', v_item->>'selection_id' using errcode = 'P0002';
    end if;
    select * into v_mkt from nova.markets where id = v_sel.market_id for update;
    select * into v_match from nova.matches where id = v_sel.match_id for update;

    if v_match.status in ('finished','cancelled','abandoned') then
      raise exception 'MATCH_FINISHED' using errcode = 'P0001';
    end if;
    if v_match.status in ('postponed','interrupted') then
      raise exception 'MATCH_POSTPONED' using errcode = 'P0001';
    end if;
    if v_mkt.status in ('closed','settled','void') then
      raise exception 'MARKET_CLOSED' using errcode = 'P0001';
    end if;
    if v_mkt.status = 'suspended' then
      raise exception 'MARKET_SUSPENDED' using errcode = 'P0001';
    end if;
    if v_sel.status <> 'open' then
      raise exception 'SELECTION_SUSPENDED' using errcode = 'P0001';
    end if;
    if v_sel.odds_scaled is null then
      raise exception 'ODDS_MISSING' using errcode = 'P0001';
    end if;

    v_max_age := case when coalesce(v_mkt.is_live, false) then p_live_max_age_seconds else p_prematch_max_age_seconds end;
    if v_sel.odds_updated_at is null or v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age) then
      raise exception 'STALE_ODDS' using errcode = 'P0001';
    end if;
    if coalesce(v_mkt.is_live,false) and not nova.operation_enabled('LIVE_BETTING') then
      raise exception 'LIVE_BETTING_DISABLED' using errcode = 'P0001';
    end if;
    if not coalesce(v_mkt.is_live,false) and not nova.operation_enabled('PREMATCH_BETTING') then
      raise exception 'PREMATCH_BETTING_DISABLED' using errcode = 'P0001';
    end if;

    -- odds movement reporting (never silent replacement)
    if (v_item ? 'odds_seen') and (v_item->>'odds_seen')::bigint <> v_sel.odds_scaled then
      v_changes := v_changes || jsonb_build_object(
        'selection_id', v_sel.id,
        'previous_odds', (v_item->>'odds_seen')::bigint,
        'current_odds', v_sel.odds_scaled,
        'direction', case when v_sel.odds_scaled > (v_item->>'odds_seen')::bigint then 'INCREASED' else 'DECREASED' end);
    end if;
    if (v_item ? 'odds_version') and (v_item->>'odds_version')::int <> v_sel.odds_version
       and not (v_item ? 'odds_seen') then
      v_changes := v_changes || jsonb_build_object(
        'selection_id', v_sel.id, 'previous_odds', null, 'current_odds', v_sel.odds_scaled, 'direction', 'UNKNOWN');
    end if;

    v_num := v_num * v_sel.odds_scaled::numeric;
    v_den := v_den * case when v_leg_count = 0 then 1 else 10000 end;
    v_leg_count := v_leg_count + 1;
    v_resolved := v_resolved || jsonb_build_object(
      'selection_id', v_sel.id, 'market_id', v_mkt.id, 'match_id', v_match.id,
      'odds', v_sel.odds_scaled, 'odds_version', v_sel.odds_version,
      'selection_name', v_sel.name, 'market_name', v_mkt.name,
      'match_label', concat(coalesce(v_match.provider_id, ''), ' ', v_match.id::text));
  end loop;

  if jsonb_array_length(v_changes) > 0 and not p_accept_odds_change then
    raise exception 'ODDS_CHANGED' using errcode = 'P0001', detail = jsonb_build_object('changes', v_changes)::text;
  end if;

  /* ---------------- 5 payout calculation (exact, single rounding) ----------------
     odds are scaled integers: each factor carries a factor 10000, so
       combined odds = round(Π odds / 10000^(n-1))      (display/audit)
       payout        = round(stake * Π odds / 10000^n)  (money)
     Both use exact numeric integer arithmetic; rounding happens once. */
  v_payout_minor := nova.round_div(p_stake_minor::numeric * v_num, v_den * 10000);
  v_combined := nova.round_div(v_num, v_den);

  /* ---------------- 6 stake + risk limits ---------------- */
  -- Configurable limits come from nova.risk_rules (global scope), with safe defaults.
  select coalesce((select value_minor from nova.risk_rules where scope='global' and kind='min_stake' and is_active
                    and (currency is null or currency = p_currency) order by priority limit 1), 10000) into v_min_stake;
  select coalesce((select value_minor from nova.risk_rules where scope='global' and kind='max_stake' and is_active
                    and (currency is null or currency = p_currency) order by priority limit 1), 500000000) into v_max_stake;
  select coalesce((select value_minor from nova.risk_rules where scope='global' and kind='max_payout' and is_active
                    and (currency is null or currency = p_currency) order by priority limit 1), 2000000000) into v_max_payout;
  if p_stake_minor < v_min_stake then
    raise exception 'STAKE_BELOW_MINIMUM' using errcode = '22023';
  end if;
  if p_stake_minor > v_max_stake then
    raise exception 'STAKE_ABOVE_MAXIMUM' using errcode = '22023';
  end if;
  if v_payout_minor > v_max_payout then
    raise exception 'PAYOUT_ABOVE_MAXIMUM' using errcode = '22023';
  end if;

  select coalesce(sum(stake_minor), 0) into v_daily_stake from nova.bets
   where user_id = p_user_id and currency = p_currency and placed_at > v_now - interval '24 hours';
  if v_daily_stake + p_stake_minor > 1000000000 then
    raise exception 'RISK_REJECTED: daily stake limit' using errcode = 'P0001';
  end if;

  /* ---------------- 7 debit wallet (locks, floors at zero) ----------------
     The bet id is generated up-front so the ledger entry references it at INSERT
     time: the ledger stays strictly append-only (no post-hoc linking update). */
  v_bet_id := gen_random_uuid();
  v_public_id := nova.new_public_id('NB');
  v_wallet_result := nova.post_wallet_entry(
    p_user_id, 'bet_debit', -p_stake_minor, p_currency,
    'bet:' || p_idempotency_key, v_public_id, v_bet_id, null, null, 'Bet debit', null,
    jsonb_build_object('correlation_id', p_correlation_id), 0, false);

  /* ---------------- 8 create bet + legs ---------------- */

  select * into v_attribution from nova.affiliate_attributions
   where user_id = p_user_id and status in ('confirmed','locked') limit 1;

  insert into nova.bets (
    id, public_id, user_id, type, status, stake_minor, currency, potential_payout_minor,
    combined_odds_num, combined_odds_den, combined_odds_scaled, placement_idempotency_key,
    campaign, device, affiliate_id, attribution_id, requested_snapshot, accepted_odds_change,
    client_ip_hash, user_agent)
  values (
    v_bet_id, v_public_id, p_user_id, p_mode, 'accepted', p_stake_minor, p_currency, v_payout_minor,
    v_num, v_den, v_combined, p_idempotency_key,
    p_campaign, p_device, v_attribution.affiliate_id, v_attribution.id,
    jsonb_build_object('requested', p_selections, 'changes', v_changes), p_accept_odds_change,
    p_ip_hash, p_user_agent);

  for v_item in select * from jsonb_array_elements(v_resolved)
  loop
    insert into nova.bet_legs (
      bet_id, match_id, market_id, selection_id, odds_at_placement, accepted_odds, odds_version_seen,
      status, selection_name, market_name, match_label)
    values (
      v_bet_id, (v_item->>'match_id')::uuid, (v_item->>'market_id')::uuid, (v_item->>'selection_id')::uuid,
      (v_item->>'odds')::bigint, (v_item->>'odds')::bigint, (v_item->>'odds_version')::int,
      'pending', v_item->>'selection_name', v_item->>'market_name', v_item->>'match_label');
  end loop;

  /* ---------------- 9 audit ---------------- */
  perform nova.audit_event(p_user_id, 'bet.placed', 'bet', v_public_id,
    null,
    jsonb_build_object('stake_minor', p_stake_minor, 'currency', p_currency, 'legs', v_leg_count,
                       'payout_minor', v_payout_minor, 'accepted_odds_change', p_accept_odds_change),
    null, p_correlation_id, jsonb_build_object('changes', v_changes));

  insert into nova.settlement_events (bet_id, event, detail, actor, correlation_id)
  values (v_bet_id, 'placed', jsonb_build_object('legs', v_leg_count, 'source', 'api'), p_user_id::text, p_correlation_id);

  return nova.bet_payload(v_bet_id, false);
exception
  when unique_violation then
    -- Concurrent duplicate placement: the unique (user_id, placement_idempotency_key)
    -- constraint made one of them lose; return the winner's bet instead of erroring.
    select * into v_existing_bet from nova.bets
     where user_id = p_user_id and placement_idempotency_key = p_idempotency_key;
    if found then
      return nova.bet_payload(v_existing_bet.id, true);
    end if;
    raise;
end $$;

/** Human-supportable public id generator (no ambiguous characters). */
create or replace function nova.new_public_id(p_prefix text) returns text
language plpgsql volatile as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_out text := '';
  i int;
begin
  for i in 1..8 loop
    v_out := v_out || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return p_prefix || '-' || v_out;
end $$;

/** Canonical bet payload returned by placement/settlement APIs. */
create or replace function nova.bet_payload(p_bet_id uuid, p_replay boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = nova, public as $$
declare v_bet nova.bets%rowtype; v_legs jsonb;
begin
  select * into v_bet from nova.bets where id = p_bet_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'selection_id', l.selection_id, 'market_id', l.market_id, 'match_id', l.match_id,
      'odds_at_placement', l.odds_at_placement, 'accepted_odds', l.accepted_odds, 'status', l.status,
      'selection_name', l.selection_name, 'market_name', l.market_name, 'match_label', l.match_label,
      'grade_reason', l.grade_reason, 'settled_at', l.settled_at) order by l.created_at), '[]'::jsonb)
    into v_legs from nova.bet_legs l where l.bet_id = p_bet_id;

  return jsonb_build_object(
    'ok', true, 'idempotent_replay', p_replay,
    'bet', jsonb_build_object(
      'id', v_bet.id, 'public_id', v_bet.public_id, 'user_id', v_bet.user_id, 'type', v_bet.type,
      'status', v_bet.status, 'stake_minor', v_bet.stake_minor, 'currency', v_bet.currency,
      'potential_payout_minor', v_bet.potential_payout_minor, 'payout_minor', v_bet.payout_minor,
      'combined_odds_scaled', v_bet.combined_odds_scaled, 'combined_odds_text', nova.odds_to_text(v_bet.combined_odds_scaled),
      'placed_at', v_bet.placed_at, 'settled_at', v_bet.settled_at, 'legs', v_legs,
      'affiliate_id', v_bet.affiliate_id, 'result_revision', v_bet.result_revision),
    'wallet_balance_minor', coalesce((select balance_minor from nova.wallets where user_id = v_bet.user_id and currency = v_bet.currency), 0));
end $$;
