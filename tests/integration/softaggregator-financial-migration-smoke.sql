\set ON_ERROR_STOP on
-- Fully synthetic/isolated fixture: no production identities, balances or provider secrets.
CREATE SCHEMA nova;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE nova.profiles (id uuid PRIMARY KEY);
CREATE TABLE nova.wallet_transactions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, currency text NOT NULL,
  type text NOT NULL, amount_minor bigint NOT NULL, reference text
);
INSERT INTO nova.profiles(id) VALUES ('00000000-0000-4000-8000-000000000001');
-- Synthetic authoritative wallet postings. A valid receipt must match each one
-- by user, native currency, signed amount, transaction type and reference.
INSERT INTO nova.wallet_transactions(id,user_id,currency,type,amount_minor,reference)
SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,'IRT',typ,amount,
  'softaggregator:' || ref
FROM (VALUES
  (2,'bet_debit',-50000::bigint,'debit-1'),
  (3,'win_credit',100000::bigint,'credit-1'),
  (4,'bet_refund',50000::bigint,'refund-1'),
  (5,'reversal',-100000::bigint,'reverse-win-1'),
  (6,'bet_refund',50000::bigint,'duplicate-refund'),
  (7,'reversal',-100000::bigint,'duplicate-reverse-win'),
  (8,'bet_refund',49999::bigint,'wrong-refund')
) AS fixture(n,typ,amount,ref);

\i docs/pending-financial-migrations/0208_softaggregator_callback_receipts.sql
\i docs/pending-financial-migrations/0209_softaggregator_fx_rounds.sql
\i docs/pending-financial-migrations/0210_softaggregator_reverse_win_receipts.sql
\i docs/pending-financial-migrations/0211_softaggregator_player_wallet_binding.sql
\i docs/pending-financial-migrations/0212_softaggregator_receipt_ledger_integrity.sql

DO $casino_test$
DECLARE
  uid uuid := '00000000-0000-4000-8000-000000000001';
  hits integer;
BEGIN
  -- All round and receipt ledger tables MUST remain row-security enabled.
  SELECT count(*) INTO hits FROM pg_class
    WHERE oid IN ('nova.softaggregator_callback_receipts'::regclass,
      'nova.softaggregator_round_fx'::regclass,
      'nova.softaggregator_player_wallet_bindings'::regclass)
      AND relrowsecurity;
  IF hits <> 3 THEN RAISE EXCEPTION 'RLS_INCOMPLETE'; END IF;
  SELECT count(*) INTO hits FROM pg_trigger
    WHERE (tgrelid='nova.softaggregator_callback_receipts'::regclass
       AND tgname='sa_receipt_immutable' AND tgenabled <> 'D')
       OR (tgrelid='nova.softaggregator_round_fx'::regclass
       AND tgname='sa_fx_round_immutable' AND tgenabled <> 'D')
       OR (tgrelid='nova.softaggregator_player_wallet_bindings'::regclass
       AND tgname='sa_player_wallet_binding_immutable' AND tgenabled <> 'D');
  IF hits <> 3 THEN RAISE EXCEPTION 'AUDIT_TRIGGERS_MISSING'; END IF;
  SELECT count(*) INTO hits FROM pg_trigger
    WHERE tgrelid='nova.softaggregator_callback_receipts'::regclass
      AND tgname='sa_receipt_integrity_on_insert' AND tgenabled <> 'D';
  IF hits <> 1 THEN RAISE EXCEPTION 'CASINO_INTEGRITY_TRIGGER_MISSING'; END IF;

  INSERT INTO nova.softaggregator_player_wallet_bindings(user_id,wallet_currency)
    VALUES(uid,'IRT');
  BEGIN
    UPDATE nova.softaggregator_player_wallet_bindings
      SET wallet_currency='USD' WHERE user_id=uid;
    RAISE EXCEPTION 'IMMUTABLE_BINDING_UPDATE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM nova.softaggregator_player_wallet_bindings WHERE user_id=uid;
    RAISE EXCEPTION 'IMMUTABLE_BINDING_DELETE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  INSERT INTO nova.softaggregator_round_fx(
    user_id,round_id,game_id,wallet_currency,rate_irt_per_usd,rate_source,rate_observed_at)
    VALUES(uid,'round-1','demo-synthetic-game','IRT',250000.00000000,'arzhaam',now());
  BEGIN
    UPDATE nova.softaggregator_round_fx SET rate_irt_per_usd=300000
      WHERE user_id=uid AND round_id='round-1';
    RAISE EXCEPTION 'IMMUTABLE_ROUND_UPDATE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO nova.softaggregator_round_fx(
      user_id,round_id,game_id,wallet_currency,rate_source)
      VALUES(uid,'invalid-usd','demo-synthetic-game','IRT','native_usd');
    RAISE EXCEPTION 'INVALID_FX_ACCEPTED';
  EXCEPTION WHEN check_violation THEN NULL; END;

  INSERT INTO nova.softaggregator_callback_receipts(
    call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
    ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
    VALUES ('debit-1',repeat('a',64),uid,'debit',20,0,980,
      '00000000-0000-4000-8000-000000000002','IRT',50000,'round-1','demo-synthetic-game',false);
  INSERT INTO nova.softaggregator_callback_receipts(
    call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
    ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
    VALUES ('credit-1',repeat('b',64),uid,'credit',40,0,1020,
      '00000000-0000-4000-8000-000000000003','IRT',100000,'round-1','demo-synthetic-game',false);

  INSERT INTO nova.softaggregator_callback_receipts(
    call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
    ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_debit_call_id)
    VALUES ('refund-1',repeat('c',64),uid,'credit',20,0,1000,
      '00000000-0000-4000-8000-000000000004','IRT',50000,'round-1','demo-synthetic-game',true,'debit-1');
  BEGIN
    INSERT INTO nova.softaggregator_callback_receipts(
      call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
      ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_debit_call_id)
      VALUES('duplicate-refund',repeat('d',64),uid,'credit',20,0,1000,
        '00000000-0000-4000-8000-000000000006','IRT',50000,'round-1','demo-synthetic-game',true,'debit-1');
    RAISE EXCEPTION 'DUPLICATE_REFUND_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  INSERT INTO nova.softaggregator_callback_receipts(
    call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
    ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_credit_call_id)
    VALUES ('reverse-win-1',repeat('e',64),uid,'debit',40,0,980,
      '00000000-0000-4000-8000-000000000005','IRT',100000,'round-1','demo-synthetic-game',true,'credit-1');
  BEGIN
    INSERT INTO nova.softaggregator_callback_receipts(
      call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
      ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_credit_call_id)
      VALUES('duplicate-reverse-win',repeat('f',64),uid,'debit',40,0,980,
        '00000000-0000-4000-8000-000000000007','IRT',100000,'round-1','demo-synthetic-game',true,'credit-1');
    RAISE EXCEPTION 'DUPLICATE_REVERSE_WIN_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  BEGIN
    INSERT INTO nova.softaggregator_callback_receipts(
      call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
      round_id,game_id,rollback) VALUES
      ('unlinked-rollback',repeat('f',64),uid,'credit',20,0,980,
        'round-1','demo-synthetic-game',true);
    RAISE EXCEPTION 'UNLINKED_SUCCESSFUL_REFUND_ACCEPTED';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- A receipt cannot pretend a refund's local wallet credit is 1 unit
  -- different from the ORIGINAL debit. This protects historical FX.
  BEGIN
    INSERT INTO nova.softaggregator_callback_receipts(
      call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
      ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,
      original_debit_call_id)
    VALUES ('wrong-refund',repeat('f',64),uid,'credit',20,0,1000,
      '00000000-0000-4000-8000-000000000008','IRT',49999,
      'round-1','demo-synthetic-game',true,'debit-1');
    RAISE EXCEPTION 'WRONG_NATIVE_REFUND_ALLOWED';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- A receipt must match the exact journal entry, not any transaction ID.
  BEGIN
    INSERT INTO nova.softaggregator_callback_receipts(
      call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
      ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
    VALUES ('forged-credit',repeat('f',64),uid,'credit',40,0,1020,
      '00000000-0000-4000-8000-000000000003','IRT',100000,
      'round-1','demo-synthetic-game',false);
    RAISE EXCEPTION 'CROSS_RECEIPT_LEDGER_REUSE_ALLOWED';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE nova.softaggregator_callback_receipts SET amount_minor=999 WHERE call_id='debit-1';
    RAISE EXCEPTION 'IMMUTABLE_RECEIPT_UPDATE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM nova.softaggregator_callback_receipts WHERE call_id='debit-1';
    RAISE EXCEPTION 'IMMUTABLE_RECEIPT_DELETE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'CASINO_ISOLATED_FINANCIAL_SCHEMA_PASS: RLS, immutable FX, immutable player currency, immutable receipts, unique refund/win reversals';
END $casino_test$;
