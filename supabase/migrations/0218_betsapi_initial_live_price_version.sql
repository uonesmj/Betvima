-- BetsAPI bootstrap quote version: unlike a changed quote, the first
-- authenticated quote for a pre-populated selection can retain its prior price.
-- Financial quote APIs require odds_version > 0 to disallow unversioned prices.
-- This modifies only the atomic odds publication routine, without backfilling
-- prices, changing wallet data or altering settled wager history.
-- Only new, strictly source-timestamp-verified BetsAPI ticks qualify.
begin;

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
  -- An accepted, source-timestamp-verified BetsAPI quote is the first
  -- published price version even when a pre-populated selection already has
  -- the same price and a zero version. Do NOT advance versions on unchanged
  -- subsequent prices or for legacy providers.
  v_new_version := greatest(
    CASE WHEN p_provider = 'betsapi' AND v_sel.provider = 'betsapi' THEN 1 ELSE 0 END,
    coalesce(v_sel.odds_version, 0)
    + CASE WHEN v_sel.odds_scaled IS DISTINCT FROM p_odds_scaled THEN 1 ELSE 0 END
  );

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
