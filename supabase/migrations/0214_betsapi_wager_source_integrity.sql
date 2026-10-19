-- Financial migration generated from the deployed function signatures on 2026-10-19.

-- Safe-by-default: adds BetsAPI provider timestamp validation without removing the existing legacy live-source freshness gates; stale-odds reopening remains guarded.

-- Does not toggle betting operations or debit any wallet. Legacy wager records remain untouched.

-- Deployment prerequisite: server-side wager adapter and exact FI-to-Events match bridge.

begin;

select pg_advisory_xact_lock(hashtext('betvima:betsapi-financial-source-upgrade'));

CREATE OR REPLACE FUNCTION nova.place_bet(p_user_id uuid, p_idempotency_key text, p_mode nova.bet_type, p_stake_minor bigint, p_currency text, p_selections jsonb, p_funding_source text, p_bonus_grant_id uuid, p_accept_odds_change boolean DEFAULT false, p_device text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_correlation_id text DEFAULT NULL::text, p_ip_hash text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_prematch_max_age_seconds integer DEFAULT 300, p_live_max_age_seconds integer DEFAULT 45, p_max_legs integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'nova', 'public'
AS $function$
DECLARE
  v_bet            nova.bets%rowtype;
  v_existing_bet   nova.bets%rowtype;
  v_item           jsonb;
  v_sel            nova.selections%rowtype;
  v_mkt            nova.markets%rowtype;
  v_is_live        boolean;
  v_match          nova.matches%rowtype;
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
  v_bonus          nova.bonus_grants%rowtype;
  v_max_age        int;
  v_now            timestamptz := now();
  v_restrictions   int;
  v_min_stake      bigint;
  v_max_stake      bigint;
  v_max_payout     bigint;
  v_daily_stake    bigint;
  v_daily_stake_limit bigint;
  v_resolved       jsonb := '[]'::jsonb;
  v_leg_count      int := 0;
BEGIN
  /* ---------------- 1 identity + account validation ---------------- */
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING errcode = '42501';
  END IF;

  IF p_stake_minor IS NULL OR p_stake_minor <= 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: stake must be positive' USING errcode = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING errcode = '22023';
  END IF;

  IF p_funding_source IS NULL OR p_funding_source NOT IN ('main', 'bonus') THEN
    RAISE EXCEPTION 'INVALID_FUNDING_SOURCE' USING errcode = '22023';
  END IF;

  IF p_funding_source = 'main' AND p_bonus_grant_id IS NOT NULL THEN
    RAISE EXCEPTION 'BONUS_GRANT_NOT_ALLOWED' USING errcode = '22023';
  END IF;

  IF p_funding_source = 'bonus' AND p_bonus_grant_id IS NULL THEN
    RAISE EXCEPTION 'BONUS_GRANT_REQUIRED' USING errcode = '22023';
  END IF;

  IF p_selections IS NULL
     OR jsonb_typeof(p_selections) <> 'array'
     OR jsonb_array_length(p_selections) = 0 THEN
    RAISE EXCEPTION 'BETSLIP_EMPTY' USING errcode = '22023';
  END IF;

  IF jsonb_array_length(p_selections) > p_max_legs THEN
    RAISE EXCEPTION 'TOO_MANY_SELECTIONS' USING errcode = '22023';
  END IF;

  IF nova.maintenance_mode() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE' USING errcode = 'P0001';
  END IF;

  IF NOT nova.operation_enabled('BETTING') THEN
    RAISE EXCEPTION 'BETTING_DISABLED' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_profile
  FROM nova.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING errcode = '42501';
  END IF;

  IF v_profile.status IN ('suspended','closed','self_excluded','restricted') THEN
    RAISE EXCEPTION 'ACCOUNT_RESTRICTED:%', v_profile.status USING errcode = '42501';
  END IF;

  IF NOT v_profile.age_verified THEN
    RAISE EXCEPTION 'AGE_NOT_VERIFIED' USING errcode = '42501';
  END IF;

  SELECT count(*) INTO v_restrictions
  FROM nova.user_restrictions
  WHERE user_id = p_user_id
    AND is_active
    AND kind IN ('self_exclusion','cooling_off','account_restriction')
    AND (effective_to IS NULL OR effective_to > v_now);

  IF v_restrictions > 0 THEN
    RAISE EXCEPTION 'ACCOUNT_RESTRICTED' USING errcode = '42501';
  END IF;

  /* ---------------- 2 idempotency ---------------- */
  SELECT * INTO v_existing_bet
  FROM nova.bets
  WHERE user_id = p_user_id
    AND placement_idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN nova.bet_payload(v_existing_bet.id, true);
  END IF;

  /* ---------------- 3 bonus grant lock ---------------- */
  IF p_funding_source = 'bonus' THEN
    SELECT *
    INTO v_bonus
    FROM nova.bonus_grants
    WHERE id = p_bonus_grant_id
      AND user_id = p_user_id
      AND currency = p_currency
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BONUS_NOT_FOUND' USING errcode = 'P0002';
    END IF;

    IF v_bonus.status <> 'active' THEN
      RAISE EXCEPTION 'BONUS_NOT_ACTIVE' USING errcode = 'P0001';
    END IF;

    IF v_bonus.expires_at <= v_now THEN
      UPDATE nova.bonus_grants
      SET status = 'expired',
          remaining_amount_minor = 0,
          updated_at = v_now
      WHERE id = v_bonus.id
        AND status = 'active';

      INSERT INTO nova.bonus_ledger (
        user_id, promotion_id, type, amount_minor, currency,
        wagering_remaining_minor, idempotency_key, reason, bonus_grant_id
      )
      VALUES (
        v_bonus.user_id, v_bonus.promotion_id, 'expiry',
        -v_bonus.remaining_amount_minor, v_bonus.currency,
        0, 'bonus-expiry:' || v_bonus.id, 'Bonus expired at bet placement', v_bonus.id
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      RAISE EXCEPTION 'BONUS_EXPIRED' USING errcode = 'P0001';
    END IF;

    IF v_bonus.remaining_amount_minor <> p_stake_minor THEN
      RAISE EXCEPTION 'BONUS_STAKE_MUST_EQUAL_AMOUNT' USING errcode = '22023';
    END IF;

    IF p_mode <> 'MULTIPLE' THEN
      RAISE EXCEPTION 'BONUS_REQUIREMENTS_NOT_MET: accumulator required' USING errcode = '22023';
    END IF;

    IF jsonb_array_length(p_selections) <> 4 THEN
      RAISE EXCEPTION 'BONUS_REQUIREMENTS_NOT_MET: exactly 4 selections required' USING errcode = '22023';
    END IF;
  END IF;

  /* ---------------- 4 market/match/odds revalidation under locks ---------------- */
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    SELECT * INTO v_sel
    FROM nova.selections
    WHERE id = (v_item->>'selection_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: selection %', v_item->>'selection_id'
        USING errcode = 'P0002';
    END IF;

    SELECT * INTO v_mkt
    FROM nova.markets
    WHERE id = v_sel.market_id
    FOR UPDATE;

    SELECT * INTO v_match
    FROM nova.matches
    WHERE id = v_sel.match_id
    FOR UPDATE;

    v_is_live := coalesce(v_mkt.is_live, false)
      OR v_match.status::text = any(array['live','in_play','paused','break','halftime','extra_time','penalties']::text[]);

    IF v_match.status IN ('finished','cancelled','abandoned') THEN
      RAISE EXCEPTION 'MATCH_FINISHED' USING errcode = 'P0001';
    END IF;

    IF v_match.status IN ('postponed','interrupted') THEN
      RAISE EXCEPTION 'MATCH_POSTPONED' USING errcode = 'P0001';
    END IF;

    IF v_mkt.status IN ('closed','settled','void') THEN
      RAISE EXCEPTION 'MARKET_CLOSED' USING errcode = 'P0001';
    END IF;

    IF v_mkt.status = 'suspended' THEN
      RAISE EXCEPTION 'MARKET_SUSPENDED' USING errcode = 'P0001';
    END IF;

    IF v_sel.status <> 'open' THEN
      RAISE EXCEPTION 'SELECTION_SUSPENDED' USING errcode = 'P0001';
    END IF;

    IF v_sel.odds_scaled IS NULL THEN
      RAISE EXCEPTION 'ODDS_MISSING' USING errcode = 'P0001';
    END IF;

    v_max_age :=
      CASE
        WHEN v_is_live
          THEN p_live_max_age_seconds
        ELSE p_prematch_max_age_seconds
      END;

    IF v_sel.odds_updated_at IS NULL
       OR v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age)
       OR (
         (
           v_sel.provider = 'betsapi'
           OR (
             (v_is_live OR v_sel.provider = '5dollarfootballapi')
             AND v_sel.provider IN ('the_odds_api', '5dollarfootballapi')
           )
         )
         AND (
           v_sel.provider_timestamp IS NULL
           OR v_sel.provider_timestamp < v_now - make_interval(secs => v_max_age)
           OR v_sel.provider_timestamp > v_now + interval '15 seconds'
         )
       ) THEN
      RAISE EXCEPTION 'STALE_ODDS' USING errcode = 'P0001';
    END IF;

    IF v_is_live
       AND NOT nova.operation_enabled('LIVE_BETTING') THEN
      RAISE EXCEPTION 'LIVE_BETTING_DISABLED' USING errcode = 'P0001';
    END IF;

    IF NOT v_is_live
       AND NOT nova.operation_enabled('PREMATCH_BETTING') THEN
      RAISE EXCEPTION 'PREMATCH_BETTING_DISABLED' USING errcode = 'P0001';
    END IF;
    -- odds movement reporting (never silently replace client price)
    IF (v_item ? 'odds_seen') AND (v_item->>'odds_seen')::bigint <> v_sel.odds_scaled THEN
      v_changes := v_changes || jsonb_build_object(
        'selection_id', v_sel.id,
        'previous_odds', (v_item->>'odds_seen')::bigint,
        'current_odds', v_sel.odds_scaled,
        'direction', CASE WHEN v_sel.odds_scaled > (v_item->>'odds_seen')::bigint THEN 'INCREASED' ELSE 'DECREASED' END
      );
    END IF;
    IF (v_item ? 'odds_version') AND (v_item->>'odds_version')::int <> v_sel.odds_version AND NOT (v_item ? 'odds_seen') THEN
      v_changes := v_changes || jsonb_build_object(
        'selection_id', v_sel.id,
        'previous_odds', null,
        'current_odds', v_sel.odds_scaled,
        'direction', 'UNKNOWN'
      );
    END IF;
    IF p_funding_source = 'bonus' AND v_sel.odds_scaled < 16000 THEN
      RAISE EXCEPTION 'BONUS_REQUIREMENTS_NOT_MET: minimum odds 1.60 per selection' USING errcode = '22023';
    END IF;
    v_num := v_num * v_sel.odds_scaled::numeric;
    v_den := v_den * CASE WHEN v_leg_count = 0 THEN 1 ELSE 10000 END;
    v_leg_count := v_leg_count + 1;
    v_resolved := v_resolved || jsonb_build_array(
      jsonb_build_object(
        'selection_id', v_sel.id,
        'market_id', v_mkt.id,
        'match_id', v_match.id,
        'odds', v_sel.odds_scaled,
        'odds_version', v_sel.odds_version,
        'selection_name', v_sel.name,
        'market_name', v_mkt.name,
        'match_label', concat(coalesce(v_match.provider_id, ''), ' ', v_match.id::text)
      )
    );
  END LOOP;

  IF p_funding_source = 'bonus'
     AND v_leg_count <> 4 THEN
    RAISE EXCEPTION 'BONUS_REQUIREMENTS_NOT_MET: exactly 4 selections required'
      USING errcode = '22023';
  END IF;
  IF jsonb_array_length(v_changes) > 0 AND NOT p_accept_odds_change THEN
    RAISE EXCEPTION 'ODDS_CHANGED' USING errcode = 'P0001', detail = jsonb_build_object('changes', v_changes)::text;
  END IF;
  /* ---------------- 5 payout calculation ---------------- */
  v_payout_minor := nova.round_div(p_stake_minor::numeric * v_num, v_den * 10000);
  v_combined := nova.round_div(v_num, v_den);
  /* ---------------- 6 stake + risk limits ---------------- */
  SELECT coalesce((SELECT value_minor FROM nova.risk_rules WHERE scope='global' AND kind='min_stake' AND is_active AND (currency IS NULL OR currency = p_currency) ORDER BY priority LIMIT 1), 10000) INTO v_min_stake;
  SELECT coalesce((SELECT value_minor FROM nova.risk_rules WHERE scope='global' AND kind='max_stake' AND is_active AND (currency IS NULL OR currency = p_currency) ORDER BY priority LIMIT 1), 500000000) INTO v_max_stake;
  SELECT coalesce((SELECT value_minor FROM nova.risk_rules WHERE scope='global' AND kind='max_payout' AND is_active AND (currency IS NULL OR currency = p_currency) ORDER BY priority LIMIT 1), 2000000000) INTO v_max_payout;

  IF p_stake_minor < v_min_stake THEN
    RAISE EXCEPTION 'STAKE_BELOW_MINIMUM' USING errcode = '22023';
  END IF;

  IF p_stake_minor > v_max_stake THEN
    RAISE EXCEPTION 'STAKE_ABOVE_MAXIMUM' USING errcode = '22023';
  END IF;

  IF p_funding_source = 'main' AND v_payout_minor > v_max_payout THEN
    RAISE EXCEPTION 'PAYOUT_ABOVE_MAXIMUM' USING errcode = '22023';
  END IF;

  SELECT coalesce(sum(stake_minor), 0)
  INTO v_daily_stake
  FROM nova.bets
  WHERE user_id = p_user_id
    AND currency = p_currency
    AND placed_at > v_now - interval '24 hours';

  SELECT coalesce((SELECT value_minor FROM nova.risk_rules WHERE scope='global' AND kind='max_daily_stake' AND is_active AND (currency IS NULL OR currency = p_currency) ORDER BY priority LIMIT 1), 1000000000) INTO v_daily_stake_limit;
  IF v_daily_stake + p_stake_minor > v_daily_stake_limit THEN
    RAISE EXCEPTION 'RISK_REJECTED: daily stake limit' USING errcode = 'P0001';
  END IF;

  /* ---------------- 6 reserve funding ---------------- */
  v_bet_id := gen_random_uuid();
  v_public_id := nova.new_public_id('NB');

  IF p_funding_source = 'main' THEN
    v_wallet_result := nova.post_wallet_entry(
      p_user_id, 'bet_debit', -p_stake_minor, p_currency,
      'bet:' || p_idempotency_key, v_public_id, v_bet_id,
      null, null, 'Bet debit', null,
      jsonb_build_object('correlation_id', p_correlation_id), 0, false
    );
  ELSE
    UPDATE nova.bonus_grants
    SET status = 'locked',
        remaining_amount_minor = 0,
        locked_at = v_now,
        bet_id = v_bet_id,
        updated_at = v_now
    WHERE id = v_bonus.id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BONUS_NOT_ACTIVE' USING errcode = 'P0001';
    END IF;

    INSERT INTO nova.bonus_ledger (
      user_id, promotion_id, type, amount_minor, currency,
      wagering_remaining_minor, idempotency_key, reason, bonus_grant_id
    )
    VALUES (
      v_bonus.user_id, v_bonus.promotion_id, 'wagering',
      -p_stake_minor, p_currency, 0,
      'bonus-lock:' || v_bonus.id || ':' || v_bet_id,
      'Bonus locked for accumulator bet',
      v_bonus.id
    );
  END IF;

  /* ---------------- 7 create bet + legs ---------------- */
  SELECT * INTO v_attribution
  FROM nova.affiliate_attributions
  WHERE user_id = p_user_id
    AND status IN ('confirmed','locked')
  LIMIT 1;

  INSERT INTO nova.bets (
    id, public_id, user_id, type, status, stake_minor, currency,
    potential_payout_minor, combined_odds_num, combined_odds_den,
    combined_odds_scaled, placement_idempotency_key, campaign, device,
    affiliate_id, attribution_id, requested_snapshot, accepted_odds_change,
    client_ip_hash, user_agent, funding_source, bonus_grant_id, bonus_reward_minor
  )
  VALUES (
    v_bet_id, v_public_id, p_user_id, p_mode, 'accepted', p_stake_minor, p_currency,
    v_payout_minor, v_num, v_den, v_combined, p_idempotency_key,
    p_campaign, p_device, v_attribution.affiliate_id, v_attribution.id,
    jsonb_build_object('requested', p_selections, 'changes', v_changes),
    p_accept_odds_change, p_ip_hash, p_user_agent,
    p_funding_source, p_bonus_grant_id,
    CASE WHEN p_funding_source = 'bonus' THEN p_stake_minor ELSE NULL END
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_resolved)
  LOOP
    INSERT INTO nova.bet_legs (
      bet_id, match_id, market_id, selection_id, odds_at_placement,
      accepted_odds, odds_version_seen, status, selection_name,
      market_name, match_label
    )
    VALUES (
      v_bet_id,
      (v_item->>'match_id')::uuid,
      (v_item->>'market_id')::uuid,
      (v_item->>'selection_id')::uuid,
      (v_item->>'odds')::bigint,
      (v_item->>'odds')::bigint,
      (v_item->>'odds_version')::int,
      'pending',
      v_item->>'selection_name',
      v_item->>'market_name',
      v_item->>'match_label'
    );
  END LOOP;

  /* ---------------- 8 audit ---------------- */
  PERFORM nova.audit_event(
    p_user_id,
    'bet.placed',
    'bet',
    v_public_id,
    null,
    jsonb_build_object(
      'stake_minor', p_stake_minor,
      'currency', p_currency,
      'legs', v_leg_count,
      'payout_minor', v_payout_minor,
      'funding_source', p_funding_source,
      'bonus_grant_id', p_bonus_grant_id,
      'accepted_odds_change', p_accept_odds_change
    ),
    null,
    p_correlation_id,
    jsonb_build_object('changes', v_changes)
  );

  INSERT INTO nova.settlement_events (bet_id, event, detail, actor, correlation_id)
  VALUES (
    v_bet_id,
    'placed',
    jsonb_build_object(
      'legs', v_leg_count,
      'source', 'api',
      'funding_source', p_funding_source
    ),
    p_user_id::text,
    p_correlation_id
  );

  RETURN nova.bet_payload(v_bet_id, false);

EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing_bet
    FROM nova.bets
    WHERE user_id = p_user_id
      AND placement_idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN nova.bet_payload(v_existing_bet.id, true);
    END IF;

    RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION nova.publish_odds_tick(p_selection_id uuid, p_odds_scaled bigint, p_provider text, p_provider_timestamp timestamp with time zone, p_is_live boolean, p_ingest_key text, p_anomalies text[] DEFAULT '{}'::text[], p_reject boolean DEFAULT false, p_reject_reason text DEFAULT NULL::text, p_suspend boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'nova', 'public'
AS $function$
DECLARE
  v_sel nova.selections%rowtype;
  v_market nova.markets%rowtype;
  v_new_version int;
  v_stale boolean := 'STALE_TIMESTAMP' = ANY(coalesce(p_anomalies, '{}'::text[]));
  v_next_status nova.selection_status;
BEGIN
  SELECT * INTO v_sel
  FROM nova.selections
  WHERE id = p_selection_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELECTION_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_market
  FROM nova.markets
  WHERE id = v_sel.market_id
  FOR UPDATE;


  IF p_ingest_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM nova.odds_history h
    WHERE h.ingest_key = p_ingest_key
      AND h.selection_id = p_selection_id
  ) THEN
    RETURN jsonb_build_object(
      'accepted', false, 'duplicate', true,
      'odds_version', v_sel.odds_version, 'updated', false
    );
  END IF;

  IF NOT FOUND OR v_market.status::text = 'manual_review' THEN
    INSERT INTO nova.odds_history (
      selection_id, provider, odds_scaled, previous_odds_scaled,
      odds_version, status, is_live, provider_timestamp, anomalies,
      rejected, reject_reason, ingest_key
    ) VALUES (
      p_selection_id, p_provider, greatest(coalesce(p_odds_scaled, 10100), 10100),
      v_sel.odds_scaled, v_sel.odds_version, v_sel.status, p_is_live,
      p_provider_timestamp, coalesce(p_anomalies, '{}'::text[]),
      true, coalesce(p_reject_reason, 'MARKET_MANUAL_REVIEW'), p_ingest_key
    );
    RETURN jsonb_build_object(
      'accepted', false, 'rejected', true,
      'reason', 'MARKET_MANUAL_REVIEW', 'odds_version', v_sel.odds_version
    );
  END IF;

  IF p_reject THEN
    INSERT INTO nova.odds_history (
      selection_id, provider, odds_scaled, previous_odds_scaled,
      odds_version, status, is_live, provider_timestamp, anomalies,
      rejected, reject_reason, ingest_key
    ) VALUES (
      p_selection_id, p_provider, greatest(coalesce(p_odds_scaled, 10100), 10100),
      v_sel.odds_scaled, v_sel.odds_version, v_sel.status, p_is_live,
      p_provider_timestamp, coalesce(p_anomalies, '{}'::text[]),
      true, p_reject_reason, p_ingest_key
    );
    RETURN jsonb_build_object(
      'accepted', false, 'rejected', true,
      'reason', p_reject_reason, 'odds_version', v_sel.odds_version
    );
  END IF;

  IF v_stale OR (
    p_provider_timestamp IS NOT NULL
    AND v_sel.provider_timestamp IS NOT NULL
    AND p_provider_timestamp <= v_sel.provider_timestamp
  ) THEN
    INSERT INTO nova.odds_history (
      selection_id, provider, odds_scaled, previous_odds_scaled,
      odds_version, status, is_live, provider_timestamp, anomalies,
      rejected, reject_reason, ingest_key
    ) VALUES (
      p_selection_id, p_provider, p_odds_scaled, v_sel.odds_scaled,
      v_sel.odds_version, v_sel.status, p_is_live, p_provider_timestamp,
      coalesce(p_anomalies, '{}'::text[]), false, NULL, p_ingest_key
    );
    RETURN jsonb_build_object(
      'accepted', false, 'duplicate', false, 'stale', true,
      'odds_version', v_sel.odds_version, 'updated', false
    );
  END IF;

  IF p_odds_scaled IS NULL OR p_odds_scaled < 10100 OR p_odds_scaled > 10000000 THEN
    INSERT INTO nova.odds_history (
      selection_id, provider, odds_scaled, previous_odds_scaled,
      odds_version, status, is_live, provider_timestamp, anomalies,
      rejected, reject_reason, ingest_key
    ) VALUES (
      p_selection_id, p_provider, greatest(coalesce(p_odds_scaled, 10100), 10100),
      v_sel.odds_scaled, v_sel.odds_version, v_sel.status, p_is_live,
      p_provider_timestamp, coalesce(p_anomalies, '{}'::text[]),
      true, 'OUT_OF_RANGE', p_ingest_key
    );
    RETURN jsonb_build_object(
      'accepted', false, 'rejected', true,
      'reason', 'OUT_OF_RANGE', 'odds_version', v_sel.odds_version
    );
  END IF;
  -- A bookmaker polling refresh must not invalidate a user's signed quote.
  -- Version is a *price* version: only actual price movement advances it.
  -- Status, provider time and anomaly updates still get published separately.
  v_new_version := coalesce(v_sel.odds_version, 0)
    + CASE WHEN v_sel.odds_scaled IS DISTINCT FROM p_odds_scaled THEN 1 ELSE 0 END;

  v_next_status := CASE
    WHEN p_suspend THEN 'suspended'::nova.selection_status
    WHEN v_sel.status::text = 'open' THEN 'open'::nova.selection_status
    -- Only clean, current source-owned prematch quotes can release a stale selection.
    -- Live locks, manual-review markets and other anomaly holds remain suspended.
    WHEN v_sel.status::text = 'suspended'
      AND v_market.status::text = 'open'
      AND v_market.is_live IS FALSE
      AND p_is_live IS FALSE
      AND v_market.provider = p_provider AND p_provider IN ('the_odds_api', '5dollarfootballapi', 'betsapi')
      AND v_sel.provider = p_provider
      AND p_provider IN ('the_odds_api', '5dollarfootballapi', 'betsapi')
      AND p_provider_timestamp IS NOT NULL
      AND p_provider_timestamp >= now() - interval '300 seconds'
      AND p_provider_timestamp <= now() + interval '30 seconds'
      AND cardinality(coalesce(p_anomalies, '{}'::text[])) = 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(v_sel.anomaly_codes, '{}'::text[])) AS held(code)
        WHERE held.code <> 'STALE_ODDS'
      )
      AND EXISTS (
        SELECT 1 FROM nova.matches m
        WHERE m.id = v_sel.match_id
          AND m.provider = p_provider
          AND m.status::text = 'scheduled'
          AND m.scheduled_at > now()
      )
      THEN 'open'::nova.selection_status
    -- Recover live selections after a *new*, clean and genuinely current
    -- bookmaker tick. Ingest-time freshness alone is not sufficient.
    WHEN v_sel.status::text = 'suspended'
      AND v_market.status::text = 'open'
      AND v_market.is_live IS TRUE
      AND p_is_live IS TRUE
      AND v_market.provider = p_provider AND p_provider IN ('the_odds_api', '5dollarfootballapi', 'betsapi')
      AND v_sel.provider = p_provider
      AND p_provider IN ('the_odds_api', '5dollarfootballapi', 'betsapi')
      AND nova.operation_enabled('LIVE_BETTING')
      AND p_provider_timestamp IS NOT NULL
      AND p_provider_timestamp >= now() - interval '45 seconds'
      AND p_provider_timestamp <= now() + interval '15 seconds'
      AND cardinality(coalesce(p_anomalies, '{}'::text[])) = 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(v_sel.anomaly_codes, '{}'::text[])) AS held(code)
        WHERE held.code NOT IN ('STALE_TIMESTAMP', 'STALE_ODDS')
      )
      AND EXISTS (
        SELECT 1 FROM nova.matches m
        WHERE m.id = v_sel.match_id
          AND m.provider = p_provider
          AND m.status::text IN ('live', 'in_play')
          AND p_provider_timestamp >= m.scheduled_at
      )
      THEN 'open'::nova.selection_status
    ELSE v_sel.status
  END;

  INSERT INTO nova.odds_history (
    selection_id, provider, odds_scaled, previous_odds_scaled,
    odds_version, status, is_live, provider_timestamp, anomalies,
    rejected, reject_reason, ingest_key
  ) VALUES (
    p_selection_id, p_provider, p_odds_scaled, v_sel.odds_scaled,
    v_new_version, v_next_status, p_is_live, p_provider_timestamp,
    coalesce(p_anomalies, '{}'::text[]), false, NULL, p_ingest_key
  );

  UPDATE nova.selections
  SET odds_scaled = p_odds_scaled,
      previous_odds_scaled = v_sel.odds_scaled,
      odds_version = v_new_version,
      odds_updated_at = now(),
      provider = p_provider,
      provider_timestamp = p_provider_timestamp,
      is_live = p_is_live,
      anomaly_codes = coalesce(p_anomalies, '{}'::text[]),
      status = v_next_status
  WHERE id = p_selection_id;

  RETURN jsonb_build_object(
    'accepted', true, 'duplicate', false, 'stale', false,
    'odds_version', v_new_version, 'updated', true
  );
END
$function$
;

commit;

