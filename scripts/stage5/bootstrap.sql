\set ON_ERROR_STOP on
-- Stage 5 bootstrap: synthetic ONLY. Execute exclusively on isolated Postgres.
-- Mimics only the upstream dependencies required to install original
-- SoftAggregator 0208..0212 migrations. Never confuse it with full NOVA schema.
BEGIN;
CREATE SCHEMA IF NOT EXISTS nova;
CREATE SCHEMA IF NOT EXISTS stage5_test;
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$bootstrap$;
CREATE TABLE IF NOT EXISTS nova.profiles (
  id uuid PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS nova.wallets (
  user_id uuid NOT NULL REFERENCES nova.profiles(id),
  currency text NOT NULL CHECK (currency IN ('USD','IRT','IRR')),
  balance_minor bigint NOT NULL DEFAULT 0,
  locked_minor bigint NOT NULL DEFAULT 0,
  is_frozen boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id,currency)
);
CREATE TABLE IF NOT EXISTS nova.wallet_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES nova.profiles(id),
  currency text NOT NULL CHECK (currency IN ('USD','IRT','IRR')),
  type text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  reference text NOT NULL,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SCHEMA nova TO service_role;
GRANT SELECT ON nova.profiles,nova.wallet_transactions,nova.wallets TO service_role;
GRANT INSERT ON nova.wallet_transactions,nova.wallets TO service_role;
COMMIT;
SELECT 'STAGE5_BOOTSTRAP_OK' AS stage;
