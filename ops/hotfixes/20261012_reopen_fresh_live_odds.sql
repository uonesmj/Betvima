-- 2026-10-12: reopen only clean, source-fresh in-play Odds API outcomes
-- Only the status CASE in nova.publish_odds_tick is changed.
-- No existing selection rows, bets, balances, ledgers or settlement jobs are updated.
-- Every incoming quote must pass the existing reject, timestamp and odds-version
-- checks before this CASE; manual-review and closed markets are never revived.
DO $guarded$
DECLARE
  existing_definition text;
  from_case text := $original$
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
$original$;
  to_case text := $replacement$
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
    -- Recover live selections after a *new*, clean and genuinely current
    -- bookmaker tick. Ingest-time freshness alone is not sufficient.
    WHEN v_sel.status::text = 'suspended'
      AND v_market.status::text = 'open'
      AND v_market.is_live IS TRUE
      AND p_is_live IS TRUE
      AND v_market.provider = 'the_odds_api'
      AND v_sel.provider = 'the_odds_api'
      AND p_provider = 'the_odds_api'
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
          AND m.provider = 'the_odds_api'
          AND m.status::text IN ('live', 'in_play')
          AND p_provider_timestamp >= m.scheduled_at
      )
      THEN 'open'::nova.selection_status
    ELSE v_sel.status
  END;
$replacement$;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure(
    'nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)'
  )) INTO existing_definition;
  IF existing_definition IS NULL THEN RAISE EXCEPTION 'ODDS_PUBLISH_FUNCTION_MISSING'; END IF;
  IF position(to_case IN existing_definition) > 0 THEN
    RAISE NOTICE 'ODDS_LIVE_STATUS_CASE_ALREADY_APPLIED';
    RETURN;
  END IF;
  IF length(existing_definition) - length(replace(existing_definition,from_case,'')) <> length(from_case)
  THEN RAISE EXCEPTION 'ODDS_PUBLISH_FUNCTION_CHANGED_REFUSE_PATCH'; END IF;
  EXECUTE replace(existing_definition,from_case,to_case);
  RAISE NOTICE 'ODDS_LIVE_STATUS_CASE_CHANGED';
END
$guarded$;
