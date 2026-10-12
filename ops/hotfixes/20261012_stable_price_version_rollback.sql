-- Emergency rollback: restore the previous every-tick odds_version policy.
-- Narrow, reversible change to nova.publish_odds_tick only.
-- Existing balances, bets, wager prices, and settlement records stay untouched.
DO $guarded$
DECLARE
  definition text;
  previous text := $old$
  -- A bookmaker polling refresh must not invalidate a user's signed quote.
  -- Version is a *price* version: only actual price movement advances it.
  -- Status, provider time and anomaly updates still get published separately.
  v_new_version := coalesce(v_sel.odds_version, 0)
    + CASE WHEN v_sel.odds_scaled IS DISTINCT FROM p_odds_scaled THEN 1 ELSE 0 END;
$old$;
  replacement text := $new$
  v_new_version := coalesce(v_sel.odds_version, 0) + 1;
$new$;
BEGIN
  SELECT pg_get_functiondef(
    to_regprocedure('nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)')
  ) INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'PUBLISH_ODDS_TICK_MISSING'; END IF;
  IF position(replacement IN definition)>0 THEN RAISE NOTICE 'ALREADY_INSTALLED'; RETURN; END IF;
  IF length(definition) - length(replace(definition, previous, '')) <> length(previous)
  THEN RAISE EXCEPTION 'PUBLISH_ODDS_TICK_DRIFTED_ABORT'; END IF;
  EXECUTE replace(definition,previous,replacement);
  RAISE NOTICE 'PUBLISH_ODDS_TICK_PRICE_VERSION_POLICY_UPDATED';
END
$guarded$;
