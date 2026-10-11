-- 0186 - IRR betting risk rules + currency-aware daily stake enforcement
-- Existing IRT/global rules are intentionally preserved.

BEGIN;

INSERT INTO nova.risk_rules
  (scope, kind, value_minor, currency, action, priority, reason, is_active)
VALUES
  ('global','min_stake',       100000,        'IRR','REJECT',1,'IRR platform minimum stake',true),
  ('global','max_stake',       5000000000,    'IRR','REJECT',1,'IRR platform maximum stake per bet',true),
  ('global','max_payout',      20000000000,   'IRR','REJECT',1,'IRR maximum potential payout per bet',true),
  ('global','max_daily_stake', 10000000000,   'IRR','LIMIT', 2,'IRR daily stake cap per user',true),
  ('global','max_daily_payout',50000000000,   'IRR','LIMIT', 2,'IRR daily payout cap per user',true),
  ('global','max_live_stake',  1000000000,    'IRR','LIMIT', 2,'IRR lower cap for in-play bets',true),
  ('global','max_exposure',    50000000000,   'IRR','REJECT',3,'IRR maximum exposure',true)
ON CONFLICT DO NOTHING;

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
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_bonus_grant_id uuid%'
  ORDER BY pg_get_function_identity_arguments(p.oid) DESC
  LIMIT 1;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'IRR_RISK_PLACE_BET_FUNCTION_NOT_FOUND';
  END IF;

  IF position('v_daily_stake_limit' IN v_source) > 0 THEN
    RAISE NOTICE '0186 place_bet daily stake patch already present';
    RETURN;
  END IF;

  IF position('v_daily_stake    bigint;' IN v_source) = 0 THEN
    RAISE EXCEPTION 'IRR_RISK_DAILY_STAKE_DECLARATION_NOT_FOUND';
  END IF;

  IF position('IF v_daily_stake + p_stake_minor > 1000000000 THEN' IN v_source) = 0 THEN
    RAISE EXCEPTION 'IRR_RISK_HARDCODED_DAILY_STAKE_GUARD_NOT_FOUND';
  END IF;

  v_source := replace(
    v_source,
    'v_daily_stake    bigint;',
    'v_daily_stake    bigint;
  v_daily_stake_limit bigint;'
  );

  v_source := replace(
    v_source,
    'IF v_daily_stake + p_stake_minor > 1000000000 THEN',
    'SELECT coalesce(
    (
      SELECT value_minor
      FROM nova.risk_rules
      WHERE scope = ''global''
        AND kind = ''max_daily_stake''
        AND is_active
        AND (currency IS NULL OR currency = p_currency)
      ORDER BY priority
      LIMIT 1
    ),
    1000000000
  )
  INTO v_daily_stake_limit;

  IF v_daily_stake + p_stake_minor > v_daily_stake_limit THEN'
  );

  EXECUTE v_source;
END $$;

COMMIT;
