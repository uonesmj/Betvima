-- Keep fixed operator-entered pre-match prices valid while prohibiting
-- wagers at/after kick-off in the authoritative SQL placement function.
-- This migration refuses unexpected function bodies instead of overwriting
-- production wallet/bet logic with a stale copy from source control.
BEGIN;

DO $migration$
DECLARE
  rec record;
  definition text;
  changed int := 0;
  freshness_pattern text :=
    'IF v_sel[.]odds_updated_at IS NULL[[:space:]]+OR v_sel[.]odds_updated_at < v_now - make_interval[(]secs => v_max_age[)] THEN';
  market_anchor text := 'IF v_mkt.status IN (''closed'',''settled'',''void'') THEN';
BEGIN
  FOR rec IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS source
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'nova' AND p.proname = 'place_bet'
  LOOP
    definition := rec.source;

    -- Legacy wrapper overload delegates to the authoritative funded version.
    IF position('v_sel.odds_updated_at' IN definition) = 0 THEN
      CONTINUE;
    END IF;

    IF definition !~ freshness_pattern OR position(market_anchor IN definition) = 0
       OR position('v_match.provider IS DISTINCT FROM' IN definition) > 0 THEN
      RAISE EXCEPTION 'Refusing unexpected nova.place_bet definition (oid %)', rec.oid;
    END IF;

    definition := regexp_replace(
      definition,
      freshness_pattern,
      'IF v_sel.odds_updated_at IS NULL OR (v_match.provider IS DISTINCT FROM ''manual'' AND v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age)) THEN'
    );

    definition := replace(
      definition,
      market_anchor,
      'IF v_match.provider = ''manual'' AND (v_match.status::text <> ''scheduled'' OR v_match.scheduled_at <= v_now OR coalesce(v_mkt.is_live, false)) THEN
        RAISE EXCEPTION ''MARKET_CLOSED'' USING errcode = ''P0001'';
      END IF;

      ' || market_anchor
    );

    -- No grant, SECURITY DEFINER, search_path, funding or settlement code is
    -- deliberately changed: it is regenerated from the *deployed* function.
    EXECUTE definition;
    changed := changed + 1;
  END LOOP;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'Expected 1 authoritative funded nova.place_bet overload; found %', changed;
  END IF;
END;
$migration$;

COMMIT;
