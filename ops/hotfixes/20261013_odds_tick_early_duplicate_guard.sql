-- Odds API refresh idempotency: verify the exact production function and move
-- the existing (selection_id, ingest_key) check before *all* history inserts.
-- No odds statuses, exposure, settlement, balances, or approval policy changes.
-- The unique index remains enforced and odds_history stays append-only.
DO $apply$
DECLARE
  function_oid oid := to_regprocedure('nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)');
  existing_body text;
  definition text;
  dedupe_guard text := $guard$
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

$guard$;
  manual_guard text := $marker$  IF NOT FOUND OR v_market.status::text = 'manual_review' THEN$marker$;
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'ODDS_TICK_FUNCTION_NOT_FOUND_ABORT';
  END IF;

  SELECT p.prosrc, pg_get_functiondef(p.oid)
    INTO existing_body, definition
    FROM pg_proc p
    WHERE p.oid = function_oid;

  IF md5(existing_body) <> '09ecb9d5869ea242abf213c47a6ab1b6' THEN
    RAISE EXCEPTION 'ODDS_TICK_FUNCTION_DRIFTED_ABORT';
  END IF;
  IF (length(definition) - length(replace(definition, dedupe_guard, ''))) <> length(dedupe_guard)
      OR (length(definition) - length(replace(definition, manual_guard, ''))) <> length(manual_guard)
      OR position(manual_guard in definition) >= position(dedupe_guard in definition)
      OR position('p_provider_timestamp >= now() - interval ''45 seconds''' in definition) = 0
      OR position('p_provider_timestamp >= now() - interval ''300 seconds''' in definition) = 0
  THEN
    RAISE EXCEPTION 'ODDS_TICK_GUARD_OR_FRESHNESS_DRIFT_ABORT';
  END IF;

  definition := replace(definition, dedupe_guard, '');
  definition := replace(definition, manual_guard, dedupe_guard || manual_guard);
  EXECUTE definition;
  RAISE NOTICE 'ODDS_TICK_DUPLICATE_PRECHECK_FIXED';
END $apply$;
