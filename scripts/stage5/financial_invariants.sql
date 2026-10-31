\set ON_ERROR_STOP on
-- Execute only in isolated betvima_stage5. All synthetic rows are rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION stage5_test.expect_rejection(label text, statement text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'TEST_% expected SQLSTATE %, got %: %', label, expected_state, SQLSTATE, SQLERRM;
    END IF;
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'TEST_% expected rejection but statement succeeded', label;
  END IF;
  RAISE NOTICE 'PASS % (% expected)', label, expected_state;
END;
$fn$;

INSERT INTO nova.profiles(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
INSERT INTO nova.wallets(user_id,currency,balance_minor) VALUES
 ('00000000-0000-0000-0000-000000000001','USD',1000),
 ('00000000-0000-0000-0000-000000000002','USD',1000);
INSERT INTO nova.softaggregator_player_wallet_bindings(user_id,wallet_currency)
 VALUES ('00000000-0000-0000-0000-000000000001','USD');
INSERT INTO nova.softaggregator_round_fx(user_id,round_id,game_id,wallet_currency,rate_source)
 VALUES ('00000000-0000-0000-0000-000000000001','r1','g1','USD','native_usd');

INSERT INTO nova.wallet_transactions(id,user_id,currency,type,amount_minor,reference,idempotency_key) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','USD','bet_debit',-25,'softaggregator:debit-1','stage5-debit-1'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','USD','win_credit',40,'softaggregator:credit-1','stage5-credit-1'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','USD','bet_refund',25,'softaggregator:refund-1','stage5-refund-1'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','USD','reversal',-40,'softaggregator:reverse-win-1','stage5-reverse-win-1');

INSERT INTO nova.softaggregator_callback_receipts
 (call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,
 ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,
 original_debit_call_id,original_credit_call_id)
VALUES
 ('debit-1',repeat('a',64),'00000000-0000-0000-0000-000000000001','debit',25,0,975,
 '10000000-0000-0000-0000-000000000001','USD',25,'r1','g1',false,null,null),
 ('credit-1',repeat('b',64),'00000000-0000-0000-0000-000000000001','credit',40,0,1015,
 '10000000-0000-0000-0000-000000000002','USD',40,'r1','g1',false,null,null),
 ('refund-1',repeat('c',64),'00000000-0000-0000-0000-000000000001','credit',25,0,1040,
 '10000000-0000-0000-0000-000000000003','USD',25,'r1','g1',true,'debit-1',null),
 ('reverse-win-1',repeat('d',64),'00000000-0000-0000-0000-000000000001','debit',40,0,1000,
 '10000000-0000-0000-0000-000000000004','USD',40,'r1','g1',true,null,'credit-1');

DO $asserts$
BEGIN
 IF (SELECT count(*) FROM nova.softaggregator_callback_receipts WHERE response_error=0) <> 4
 THEN RAISE EXCEPTION 'VALID_RECEIPTS_NOT_FOUR'; END IF;
 IF (SELECT sum(amount_minor) FROM nova.wallet_transactions) <> 0
 THEN RAISE EXCEPTION 'LEDGER_NOT_RECONCILED'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN (
   to_regclass('nova.softaggregator_callback_receipts'),
   to_regclass('nova.softaggregator_round_fx'),
   to_regclass('nova.softaggregator_player_wallet_bindings')) AND relrowsecurity) <> 3
 THEN RAISE EXCEPTION 'FINANCIAL_TABLE_RLS_INCOMPLETE'; END IF;
 IF EXISTS (
   SELECT 1 FROM (VALUES
      ('nova.softaggregator_callback_receipts'),('nova.softaggregator_round_fx'),
      ('nova.softaggregator_player_wallet_bindings')) t(name)
   CROSS JOIN (VALUES ('anon'),('authenticated')) r(name)
   WHERE has_table_privilege(r.name,t.name,'INSERT, UPDATE, DELETE'))
 THEN RAISE EXCEPTION 'PUBLIC_FINANCIAL_WRITES_ALLOWED'; END IF;
 RAISE NOTICE 'PASS valid debit, win, refund and reverse-win ledger reconciliation';
 RAISE NOTICE 'PASS row-level security and restricted client roles';
END;
$asserts$;

SELECT stage5_test.expect_rejection('duplicate_call_id',
  $q$INSERT INTO nova.softaggregator_callback_receipts SELECT * FROM nova.softaggregator_callback_receipts WHERE call_id='debit-1'$q$, '23505');
SELECT stage5_test.expect_rejection('immutable_receipt',
  $q$UPDATE nova.softaggregator_callback_receipts SET response_balance_minor=123 WHERE call_id='debit-1'$q$, '42501');
SELECT stage5_test.expect_rejection('immutable_round',
  $q$DELETE FROM nova.softaggregator_round_fx WHERE round_id='r1'$q$, '42501');
SELECT stage5_test.expect_rejection('immutable_binding',
  $q$UPDATE nova.softaggregator_player_wallet_bindings SET wallet_currency='IRR'$q$, '42501');
SELECT stage5_test.expect_rejection('invalid_fiat_round_fx',
  $q$INSERT INTO nova.softaggregator_round_fx(user_id,round_id,game_id,wallet_currency,rate_source)
     VALUES('00000000-0000-0000-0000-000000000002','bad','g2','IRR','native_usd')$q$, '23514');

INSERT INTO nova.wallet_transactions(id,user_id,currency,type,amount_minor,reference,idempotency_key) VALUES
 ('10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','USD','bet_debit',-30,'softaggregator:bad-amount','stage5-bad-amount'),
 ('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','USD','bet_debit',-25,'softaggregator:bad-round','stage5-bad-round'),
 ('10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','USD','bet_refund',25,'softaggregator:duplicate-refund','stage5-duplicate-refund'),
 ('10000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','USD','bet_refund',26,'softaggregator:wrong-refund','stage5-wrong-refund');

SELECT stage5_test.expect_rejection('receipt_ledger_amount_mismatch',
 $q$INSERT INTO nova.softaggregator_callback_receipts
 (call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
 VALUES('bad-amount',repeat('e',64),'00000000-0000-0000-0000-000000000001','debit',25,0,970,'10000000-0000-0000-0000-000000000010','USD',25,'r1','g1',false)$q$,'23514');

SELECT stage5_test.expect_rejection('receipt_round_mismatch',
 $q$INSERT INTO nova.softaggregator_callback_receipts
 (call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
 VALUES('bad-round',repeat('f',64),'00000000-0000-0000-0000-000000000001','debit',25,0,975,'10000000-0000-0000-0000-000000000011','USD',25,'incorrect-round','g1',false)$q$,'23514');

SELECT stage5_test.expect_rejection('rollback_same_original_twice',
 $q$INSERT INTO nova.softaggregator_callback_receipts
 (call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_debit_call_id)
 VALUES('duplicate-refund',repeat('1',64),'00000000-0000-0000-0000-000000000001','credit',25,0,1040,'10000000-0000-0000-0000-000000000012','USD',25,'r1','g1',true,'debit-1')$q$,'23505');

SELECT stage5_test.expect_rejection('rollback_amount_differs_from_original',
 $q$INSERT INTO nova.softaggregator_callback_receipts
 (call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_debit_call_id)
 VALUES('wrong-refund',repeat('2',64),'00000000-0000-0000-0000-000000000001','credit',26,0,1041,'10000000-0000-0000-0000-000000000013','USD',26,'r1','g1',true,'debit-1')$q$,'23514');

DO $end_checks$
BEGIN
 IF (SELECT count(*) FROM nova.softaggregator_callback_receipts) <> 4 THEN
   RAISE EXCEPTION 'NEGATIVE_TESTS_PERSISTED_RECEIPTS';
 END IF;
 RAISE NOTICE 'PASS negative receipt writes stayed rejected';
END;
$end_checks$;
SELECT 'STAGE5_FINANCIAL_INVARIANTS_PASS' AS result;
ROLLBACK;
