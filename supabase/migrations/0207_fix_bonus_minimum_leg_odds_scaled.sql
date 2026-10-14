-- Correct the BONUS wager guard to the canonical odds scale of 10,000.
-- 1.60 decimal => odds_scaled 16000 (NOT 160).
-- Only change the existing bonus-aware placement overload; preserve
-- every other existing financial guard, signature and ledger side effect.
-- Fail closed on unexpected live-function drift rather than rebuilding an
-- outdated copy of this frequently patched function.

DO $bonus_threshold$
DECLARE
  v_function_oid oid;
  v_before text;
  v_after text;
  v_bad text := 'v_sel.odds_scaled < 160 THEN';
  v_good text := 'v_sel.odds_scaled < 16000 THEN';
BEGIN
  SELECT p.oid INTO STRICT v_function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'nova'
    AND p.proname = 'place_bet'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_funding_source text%'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_bonus_grant_id uuid%';

  v_before := pg_get_functiondef(v_function_oid);

  IF position(v_good IN v_before) > 0 THEN
    -- Already fixed; makes reapplication safe.
    RETURN;
  END IF;

  IF position(v_bad IN v_before) = 0 OR
     length(v_before) - length(replace(v_before, v_bad, '')) <> length(v_bad) THEN
    RAISE EXCEPTION 'BONUS_ODDS_GUARD_UNRECOGNIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF position('BONUS_STAKE_MUST_EQUAL_AMOUNT' IN v_before) = 0 OR
     position('exactly 4 selections required' IN v_before) = 0 OR
     position('BONUS_REQUIREMENTS_NOT_MET: minimum odds 1.60 per selection' IN v_before) = 0 THEN
    RAISE EXCEPTION 'BONUS_WAGERING_CONTRACT_DRIFT'
      USING ERRCODE = 'P0001';
  END IF;

  v_after := replace(v_before, v_bad, v_good);
  EXECUTE v_after;

  IF position(v_good IN pg_get_functiondef(v_function_oid)) = 0 OR
     position(v_bad IN pg_get_functiondef(v_function_oid)) > 0 THEN
    RAISE EXCEPTION 'BONUS_ODDS_GUARD_NOT_CORRECTED'
      USING ERRCODE = 'P0001';
  END IF;
END
$bonus_threshold$;
