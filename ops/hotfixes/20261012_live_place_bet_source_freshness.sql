-- Require source-fresh in-play quotes at the atomic wallet debit
-- The source timestamp of an in-play Odds API quote must be fresh at the
-- moment of the atomic bet debit, not merely freshly re-ingested from a cache.
-- No existing bets, balances, wallet entries or results are changed.
DO $guarded$
DECLARE
  source_definition text;
  expected_section text := $old$
    IF v_sel.odds_updated_at IS NULL
       OR v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age) THEN
      RAISE EXCEPTION 'STALE_ODDS' USING errcode = 'P0001';
    END IF;
$old$;
  new_section text := $new$
    IF v_sel.odds_updated_at IS NULL
       OR v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age)
       OR (
         v_is_live
         AND v_sel.provider = 'the_odds_api'
         AND (
           v_sel.provider_timestamp IS NULL
           OR v_sel.provider_timestamp < v_now - make_interval(secs => p_live_max_age_seconds)
           OR v_sel.provider_timestamp > v_now + interval '15 seconds'
         )
       ) THEN
      RAISE EXCEPTION 'STALE_ODDS' USING errcode = 'P0001';
    END IF;
$new$;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('nova.place_bet(uuid,text,nova.bet_type,bigint,text,jsonb,text,uuid,boolean,text,text,text,text,text,integer,integer,integer)')) INTO source_definition;
  IF source_definition IS NULL THEN RAISE EXCEPTION 'PLACE_BET_FUNCTION_MISSING'; END IF;
  IF position(new_section IN source_definition)>0 THEN RETURN; END IF;
  IF length(source_definition) - length(replace(source_definition, expected_section, '')) <> length(expected_section) THEN
     RAISE EXCEPTION 'PLACE_BET_FUNCTION_DRIFTED_ABORT';
  END IF;
  EXECUTE replace(source_definition, expected_section, new_section);
END $guarded$;
