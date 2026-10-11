BEGIN;

-- A market under manual review must never expose open selections.
UPDATE nova.selections s
SET status = 'suspended'::nova.selection_status,
    updated_at = now()
FROM nova.markets mk
WHERE mk.id = s.market_id
  AND mk.status::text = 'manual_review'
  AND s.status::text = 'open';

-- Preserve existing suspension/closure state when a new quote arrives.
CREATE OR REPLACE FUNCTION nova.publish_odds_tick(
  p_selection_id uuid,
  p_odds_scaled bigint,
  p_provider text,
  p_provider_timestamp timestamptz,
  p_is_live boolean,
  p_ingest_key text,
  p_anomalies text[] DEFAULT '{}'::text[],
  p_reject boolean DEFAULT false,
  p_reject_reason text DEFAULT NULL::text,
  p_suspend boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = nova, public
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

  v_new_version := coalesce(v_sel.odds_version, 0) + 1;

  v_next_status := CASE
    WHEN p_suspend THEN 'suspended'::nova.selection_status
    WHEN v_sel.status::text = 'open' THEN 'open'::nova.selection_status
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
$function$;

-- Duplicate ticks must never refresh freshness or reopen a selection.
CREATE OR REPLACE FUNCTION nova.publish_odds_tick_batch(p_ticks jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = nova, public
AS $function$
DECLARE
  v_tick jsonb;
  v_result jsonb;
  v_count int := 0;
  v_accepted int := 0;
  v_rejected int := 0;
  v_duplicates int := 0;
BEGIN
  IF p_ticks IS NULL OR jsonb_typeof(p_ticks) <> 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: ticks must be a JSON array'
      USING errcode = '22023';
  END IF;

  FOR v_tick IN SELECT * FROM jsonb_array_elements(p_ticks) LOOP
    v_result := nova.publish_odds_tick(
      (v_tick->>'selection_id')::uuid,
      (v_tick->>'odds_scaled')::bigint,
      v_tick->>'provider',
      (v_tick->>'provider_timestamp')::timestamptz,
      coalesce((v_tick->>'is_live')::boolean, false),
      v_tick->>'ingest_key',
      coalesce(array(SELECT jsonb_array_elements_text(v_tick->'anomalies')), '{}'::text[]),
      coalesce((v_tick->>'reject')::boolean, false),
      v_tick->>'reject_reason',
      coalesce((v_tick->>'suspend')::boolean, false)
    );

    v_count := v_count + 1;

    IF coalesce((v_result->>'duplicate')::boolean, false) THEN
      v_duplicates := v_duplicates + 1;
    ELSIF coalesce((v_result->>'rejected')::boolean, false) THEN
      v_rejected := v_rejected + 1;
    ELSIF coalesce((v_result->>'accepted')::boolean, false) THEN
      v_accepted := v_accepted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'count', v_count, 'accepted', v_accepted,
    'rejected', v_rejected, 'duplicates', v_duplicates
  );
END
$function$;

REVOKE ALL ON FUNCTION nova.publish_odds_tick_batch(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION nova.publish_odds_tick_batch(jsonb) TO service_role;

COMMIT;
