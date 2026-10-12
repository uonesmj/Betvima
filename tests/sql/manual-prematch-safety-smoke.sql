-- Synthetic production-function body for smoke-testing the manual
-- prematch migration against an isolated CI PostgreSQL instance.
-- Never run this fixture against the real Betvima database.
CREATE SCHEMA IF NOT EXISTS nova;

CREATE OR REPLACE FUNCTION nova.place_bet(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'nova', 'public'
AS $function$
DECLARE
  v_sel record;
  v_match record;
  v_mkt record;
  v_now timestamptz := now();
  v_max_age int := 300;
BEGIN
  IF v_sel.odds_updated_at IS NULL
     OR v_sel.odds_updated_at < v_now - make_interval(secs => v_max_age) THEN
    RAISE EXCEPTION 'STALE_ODDS' USING errcode = 'P0001';
  END IF;

  IF v_mkt.status IN ('closed','settled','void') THEN
    RAISE EXCEPTION 'MARKET_CLOSED' USING errcode = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok',true);
END;
$function$;

-- Legacy wrapper deliberately has no freshness check and must be untouched.
CREATE OR REPLACE FUNCTION nova.place_bet(p_user_id uuid, p_legacy boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'nova', 'public'
AS $wrapper$
BEGIN
  RETURN nova.place_bet(p_user_id);
END;
$wrapper$;
