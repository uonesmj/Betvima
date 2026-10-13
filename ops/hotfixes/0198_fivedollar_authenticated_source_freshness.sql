-- Fail-closed second-source freshness safety.
-- Apply only after live quote provenance has been verified on the deployed Ultra
-- account; the worker flag remains OFF until controlled rollout is approved.
-- Replaces just the provider-specific guards of two existing stored functions.
-- ASSERTS the exact previous function layout; unexpected database drift aborts.
BEGIN;
DO $migration$
DECLARE
  v_def text;
  v_place_oid oid;
  v_publish_oid oid;
  v_old text;
  v_new text;
  v_source text := 'the_odds_api';
  v_alternate text := '5dollarfootballapi';
BEGIN
  SELECT p.oid INTO v_place_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='nova' AND p.proname='place_bet'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_funding_source text%'
  LIMIT 1;
  IF v_place_oid IS NULL THEN
    RAISE EXCEPTION 'SOURCE_SAFETY_STOP: place_bet target missing';
  END IF;
  SELECT pg_get_functiondef(v_place_oid) INTO v_def;
  v_old := E'       OR (\n         v_is_live\n         AND v_sel.provider = ''the_odds_api''\n         AND (\n           v_sel.provider_timestamp IS NULL\n           OR v_sel.provider_timestamp < v_now - make_interval(secs => p_live_max_age_seconds)\n           OR v_sel.provider_timestamp > v_now + interval ''15 seconds''\n         )\n       ) THEN';
  v_new := E'       OR (\n         (v_is_live OR v_sel.provider = ''5dollarfootballapi'')\n         AND v_sel.provider IN (''the_odds_api'', ''5dollarfootballapi'')\n         AND (\n           v_sel.provider_timestamp IS NULL\n           OR v_sel.provider_timestamp < v_now - make_interval(secs => v_max_age)\n           OR v_sel.provider_timestamp > v_now + interval ''15 seconds''\n         )\n       ) THEN';
  IF position(v_old in v_def) = 0 OR (length(v_def)-length(replace(v_def,v_old,''))) <> length(v_old) THEN
    RAISE EXCEPTION 'SOURCE_SAFETY_STOP: place_bet guard changed unexpectedly';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);

  SELECT p.oid INTO v_publish_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='nova' AND p.proname='publish_odds_tick'
  LIMIT 1;
  IF v_publish_oid IS NULL THEN
    RAISE EXCEPTION 'SOURCE_SAFETY_STOP: publish_odds_tick target missing';
  END IF;
  SELECT pg_get_functiondef(v_publish_oid) INTO v_def;
  IF (length(v_def)-length(replace(v_def,'''the_odds_api''','')))/length('''the_odds_api''') <> 8 THEN
    RAISE EXCEPTION 'SOURCE_SAFETY_STOP: publish_odds_tick source gates changed';
  END IF;
  -- Every involved identity must agree with p_provider. Never mix provider IDs.
  v_def := replace(v_def, 'v_market.provider = ''the_odds_api''',
    'v_market.provider = p_provider AND p_provider IN (''the_odds_api'', ''5dollarfootballapi'')');
  v_def := replace(v_def, 'v_sel.provider = ''the_odds_api''',
    'v_sel.provider = p_provider');
  v_def := replace(v_def, 'p_provider = ''the_odds_api''',
    'p_provider IN (''the_odds_api'', ''5dollarfootballapi'')');
  v_def := replace(v_def, 'm.provider = ''the_odds_api''',
    'm.provider = p_provider');
  EXECUTE v_def;
END
$migration$;
COMMIT;
