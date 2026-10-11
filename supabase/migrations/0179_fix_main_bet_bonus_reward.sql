-- Fix main-funded bets to satisfy bets_bonus_fields_check.
-- Main-funded bets must store bonus_reward_minor as NULL, not 0.
-- Bonus-funded bets continue to store the wager amount as bonus_reward_minor.

DO $$
DECLARE
  v_source text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'nova'
    AND p.proname = 'place_bet'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_funding_source text%'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_bonus_grant_id uuid%';

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'NEW_PLACE_BET_FUNCTION_NOT_FOUND';
  END IF;

  v_source := replace(
    v_source,
    'CASE WHEN p_funding_source = ''bonus'' THEN p_stake_minor ELSE 0 END',
    'CASE WHEN p_funding_source = ''bonus'' THEN p_stake_minor ELSE NULL END'
  );

  IF v_source = pg_get_functiondef(
    (
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'nova'
        AND p.proname = 'place_bet'
        AND pg_get_function_identity_arguments(p.oid) LIKE '%p_funding_source text%'
        AND pg_get_function_identity_arguments(p.oid) LIKE '%p_bonus_grant_id uuid%'
      LIMIT 1
    )
  ) THEN
    RAISE EXCEPTION 'BONUS_REWARD_REPLACEMENT_NOT_FOUND';
  END IF;

  EXECUTE v_source;
END $$;
