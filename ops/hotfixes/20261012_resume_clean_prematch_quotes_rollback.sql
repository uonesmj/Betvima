-- Restore prior selection status behavior. Does not change bet or wallet records; guard the active database function against unexpected drift.
DO $patched$
DECLARE existing_def text;
  source_text text := $before$
  v_next_status := CASE
    WHEN p_suspend THEN 'suspended'::nova.selection_status
    WHEN v_sel.status::text = 'open' THEN 'open'::nova.selection_status
    -- Only clean, current prematch Odds API quotes can release a stale selection.
    -- Live locks, manual-review markets and other anomaly holds remain suspended.
    WHEN v_sel.status::text = 'suspended'
      AND v_market.status::text = 'open'
      AND v_market.is_live IS FALSE
      AND p_is_live IS FALSE
      AND v_market.provider = 'the_odds_api'
      AND v_sel.provider = 'the_odds_api'
      AND p_provider = 'the_odds_api'
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
          AND m.provider = 'the_odds_api'
          AND m.status::text = 'scheduled'
          AND m.scheduled_at > now()
      )
      THEN 'open'::nova.selection_status
    ELSE v_sel.status
  END;
$before$;
  replacement_text text := $after$
  v_next_status := CASE
    WHEN p_suspend THEN 'suspended'::nova.selection_status
    WHEN v_sel.status::text = 'open' THEN 'open'::nova.selection_status
    ELSE v_sel.status
  END;
$after$;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)')) INTO existing_def;
  IF existing_def IS NULL THEN RAISE EXCEPTION 'ODDS_FUNCTION_MISSING'; END IF;
  IF position(replacement_text IN existing_def) > 0 THEN
    RAISE NOTICE 'ODDS_FUNCTION_ALREADY_AT_TARGET';
    RETURN;
  END IF;
  IF length(existing_def)-length(replace(existing_def,source_text,'')) <> length(source_text) THEN
    RAISE EXCEPTION 'ODDS_FUNCTION_DRIFTED_ABORT';
  END IF;
  EXECUTE replace(existing_def,source_text,replacement_text);
END $patched$;
