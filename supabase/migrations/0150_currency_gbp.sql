-- NOVA: add GBP as a supported wallet currency.
-- No balances are converted or modified by this migration.

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT con.conname
  INTO c_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'wallets'
    AND nsp.nspname = 'nova'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%currency%'
    AND pg_get_constraintdef(con.oid) ILIKE '%USD%'
    AND pg_get_constraintdef(con.oid) ILIKE '%EUR%'
  LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE nova.wallets DROP CONSTRAINT %I',
      c_name
    );
  END IF;
END $$;

ALTER TABLE nova.wallets
  DROP CONSTRAINT IF EXISTS wallets_currency_check;

ALTER TABLE nova.wallets
  ADD CONSTRAINT wallets_currency_check
  CHECK (currency IN ('IRT', 'IRR', 'EUR', 'USD', 'USDT', 'GBP'));
