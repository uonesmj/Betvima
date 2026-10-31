\set ON_ERROR_STOP on
-- Strictly synthetic: real wallet RPC + receipt reconciliation inside one rolled-back transaction.
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'betvima_stage6' THEN RAISE EXCEPTION 'WRONG_STAGE6_DATABASE'; END IF;
 IF (SELECT balance_minor FROM nova.wallets WHERE user_id='00000000-0000-0000-0000-000000000088' AND currency='USD') <> 940
 THEN RAISE EXCEPTION 'UNEXPECTED_PRETEST_BALANCE'; END IF;
END;
$guard$;
INSERT INTO nova.softaggregator_player_wallet_bindings(user_id,wallet_currency)
 VALUES ('00000000-0000-0000-0000-000000000088','USD');
INSERT INTO nova.softaggregator_round_fx(user_id,round_id,game_id,wallet_currency,rate_source)
 VALUES ('00000000-0000-0000-0000-000000000088','stage6-round','stage6-game','USD','native_usd');
SELECT nova.post_wallet_entry('00000000-0000-0000-0000-000000000088'::uuid,'bet_debit'::wallet_tx_type,-25,'USD',
 'stage6-success-debit','softaggregator:stage6-success-debit',null,null,null,null,null,'{}'::jsonb,0,false);
INSERT INTO nova.softaggregator_callback_receipts(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
 SELECT 'stage6-success-debit',repeat('a',64),'00000000-0000-0000-0000-000000000088','debit',25,0,915,id,'USD',25,'stage6-round','stage6-game',false
 FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-debit';
SELECT nova.post_wallet_entry('00000000-0000-0000-0000-000000000088'::uuid,'win_credit'::wallet_tx_type,40,'USD',
 'stage6-success-credit','softaggregator:stage6-success-credit',null,null,null,null,null,'{}'::jsonb,null,false);
INSERT INTO nova.softaggregator_callback_receipts(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
 SELECT 'stage6-success-credit',repeat('b',64),'00000000-0000-0000-0000-000000000088','credit',40,0,955,id,'USD',40,'stage6-round','stage6-game',false
 FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-credit';
SELECT nova.post_wallet_entry('00000000-0000-0000-0000-000000000088'::uuid,'bet_refund'::wallet_tx_type,25,'USD',
 'stage6-success-refund','softaggregator:stage6-success-refund',null,null,
 (SELECT id FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-debit'),null,null,'{}'::jsonb,null,false);
INSERT INTO nova.softaggregator_callback_receipts(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_debit_call_id)
 SELECT 'stage6-success-refund',repeat('c',64),'00000000-0000-0000-0000-000000000088','credit',25,0,980,id,'USD',25,'stage6-round','stage6-game',true,'stage6-success-debit'
 FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-refund';
SELECT nova.post_wallet_entry('00000000-0000-0000-0000-000000000088'::uuid,'reversal'::wallet_tx_type,-40,'USD',
 'stage6-success-reversal','softaggregator:stage6-success-reversal',null,null,
 (SELECT id FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-credit'),null,null,'{}'::jsonb,0,false);
INSERT INTO nova.softaggregator_callback_receipts(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,original_credit_call_id)
 SELECT 'stage6-success-reversal',repeat('d',64),'00000000-0000-0000-0000-000000000088','debit',40,0,940,id,'USD',40,'stage6-round','stage6-game',true,'stage6-success-credit'
 FROM nova.wallet_transactions WHERE idempotency_key='stage6-success-reversal';
DO $check$
BEGIN
 IF (SELECT count(*) FROM nova.softaggregator_callback_receipts WHERE call_id LIKE 'stage6-success-%') <> 4 THEN
   RAISE EXCEPTION 'STAGE6_WRONG_RECEIPT_COUNT'; END IF;
 IF (SELECT sum(amount_minor) FROM nova.wallet_transactions WHERE idempotency_key LIKE 'stage6-success-%') <> 0 THEN
   RAISE EXCEPTION 'STAGE6_LEDGER_DRIFT'; END IF;
 IF (SELECT balance_minor FROM nova.wallets WHERE user_id='00000000-0000-0000-0000-000000000088' AND currency='USD') <> 940 THEN
   RAISE EXCEPTION 'STAGE6_WALLET_DRIFT'; END IF;
 RAISE NOTICE 'PASS real RPC debit/credit/refund/reversal plus receipt triggers, net-zero';
END;
$check$;
SELECT 'STAGE6_FULL_RPC_RECEIPT_PARITY_PASS' AS result;
ROLLBACK;
