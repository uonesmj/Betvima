\set ON_ERROR_STOP on
-- Runs ONLY after the disposable 0208..0212 schema smoke and readiness tests.
-- User ending 0002 is a synthetic identity unrelated to all production users.
ALTER TABLE nova.profiles
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN age_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN kyc_status text NOT NULL DEFAULT 'verified',
  ADD COLUMN jurisdiction text NOT NULL DEFAULT 'TR',
  ADD COLUMN preferred_currency text NOT NULL DEFAULT 'USD';
CREATE TABLE nova.user_limits (
  user_id uuid NOT NULL REFERENCES nova.profiles(id), currency text NOT NULL,
  self_excluded_until timestamptz,
  max_stake_per_bet_minor bigint, max_stake_per_day_minor bigint,
  loss_limit_daily_minor bigint, loss_limit_weekly_minor bigint,
  PRIMARY KEY(user_id,currency)
);
CREATE TABLE nova.user_restrictions (
  user_id uuid NOT NULL REFERENCES nova.profiles(id),
  is_active boolean NOT NULL DEFAULT false, kind text NOT NULL DEFAULT 'account_restriction',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz
);
-- Install the exact operator-review migration on the disposable database.
-- Only the review entry authorizes test wagering; unrelated KYC status does not.
\i supabase/migrations/0220_casino_support_manual_approval.sql
CREATE TABLE nova.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES nova.profiles(id),
  currency text NOT NULL CHECK(currency IN('USD','IRT','IRR')),
  balance_minor bigint NOT NULL DEFAULT 0,
  locked_minor bigint NOT NULL DEFAULT 0,
  is_frozen boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 0,
  UNIQUE(user_id,currency)
);
ALTER TABLE nova.wallet_transactions
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN wallet_id uuid REFERENCES nova.wallets(id),
  ADD COLUMN balance_after_minor bigint,
  ADD COLUMN status text NOT NULL DEFAULT 'posted',
  ADD COLUMN idempotency_key text,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX casino_test_wallet_entry_dedup
  ON nova.wallet_transactions(wallet_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- The genuine production signature/transaction semantics for the cashier RPC.
-- Other production RPCs are deliberately not provisioned in the disposable DB.
CREATE OR REPLACE FUNCTION nova.post_wallet_entry(
  p_user_id uuid, p_type text, p_amount_minor bigint, p_currency text,
  p_idempotency_key text, p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_balance_floor bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $wallet_function$
DECLARE
  w nova.wallets%rowtype;
  existing nova.wallet_transactions%rowtype;
  next_balance bigint;
  txid uuid;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor = 0 OR length(p_idempotency_key) < 6
    THEN RAISE EXCEPTION 'INVALID_LEDGER_ENTRY'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wallet:'||p_user_id::text||':'||p_currency));
  INSERT INTO nova.wallets(user_id,currency) VALUES(p_user_id,p_currency)
    ON CONFLICT(user_id,currency) DO NOTHING;
  SELECT * INTO w FROM nova.wallets
    WHERE user_id=p_user_id AND currency=p_currency FOR UPDATE;
  SELECT * INTO existing FROM nova.wallet_transactions
    WHERE wallet_id=w.id AND idempotency_key=p_idempotency_key;
  IF found THEN RETURN jsonb_build_object('transaction_id',existing.id,
      'balance_after_minor',existing.balance_after_minor,'idempotent_replay',true); END IF;
  IF w.is_frozen THEN RAISE EXCEPTION 'WALLET_FROZEN'; END IF;
  next_balance := w.balance_minor + p_amount_minor;
  IF p_balance_floor IS NOT NULL AND next_balance < p_balance_floor
    THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  INSERT INTO nova.wallet_transactions(
    wallet_id,user_id,type,amount_minor,balance_after_minor,currency,status,
    reference,idempotency_key,metadata)
    VALUES(w.id,p_user_id,p_type,p_amount_minor,next_balance,p_currency,'posted',
      p_reference,p_idempotency_key,p_metadata) RETURNING id INTO txid;
  UPDATE nova.wallets SET balance_minor=next_balance,version=version+1 WHERE id=w.id;
  RETURN jsonb_build_object('transaction_id',txid,'balance_after_minor',next_balance,
    'idempotent_replay',false);
END $wallet_function$;

INSERT INTO nova.profiles(id,status,age_verified,kyc_status,jurisdiction,preferred_currency)
  VALUES('00000000-0000-4000-8000-000000000002','active',false,'pending','TR','USD');
INSERT INTO nova.casino_support_approvals(user_id,status,legal_age_confirmed,reviewed_by,ticket_id,review_note)
VALUES('00000000-0000-4000-8000-000000000002','approved',true,
       '00000000-0000-4000-8000-000000000001',
       '11111111-1111-4111-8111-111111111111',
       'Synthetic support-reviewed adult account, strictly in CI');
INSERT INTO nova.wallets(user_id,currency,balance_minor)
  VALUES('00000000-0000-4000-8000-000000000002','USD',1000);
INSERT INTO nova.wallet_transactions(wallet_id,user_id,type,amount_minor,
  balance_after_minor,currency,status,reference,idempotency_key)
SELECT id,user_id,'deposit',1000,1000,currency,'posted','synthetic-seed','seed-1000'
  FROM nova.wallets WHERE user_id='00000000-0000-4000-8000-000000000002';
INSERT INTO nova.softaggregator_player_wallet_bindings(user_id,wallet_currency)
  VALUES('00000000-0000-4000-8000-000000000002','USD');
