-- Bonus-funded bets use the bonus stake as the effective wallet payout.
-- The provider/gross accumulator payout may be much larger, but settlement
-- credits only bonus_reward_minor to the main wallet.
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
    RAISE EXCEPTION 'BONUS_PLACE_BET_FUNCTION_NOT_FOUND';
  END IF;

  IF position('IF p_funding_source = ''main'' AND v_payout_minor > v_max_payout THEN' IN v_source) > 0 THEN
    RETURN;
  END IF;
  IF position('IF v_payout_minor > v_max_payout THEN' IN v_source) = 0 THEN
    RAISE EXCEPTION 'BONUS_MAX_PAYOUT_GUARD_NOT_FOUND';
  END IF;
  v_source := replace(
    v_source,
    'IF v_payout_minor > v_max_payout THEN',
    'IF p_funding_source = ''main'' AND v_payout_minor > v_max_payout THEN'
  );
  EXECUTE v_source;
END $$;
