\set ON_ERROR_STOP on
BEGIN;
SELECT nova.post_wallet_entry('00000000-0000-0000-0000-000000000088'::uuid,'bet_debit'::wallet_tx_type,-5,'USD',
 'stage6-rejected-atomic','softaggregator:stage6-rejected-atomic',null,null,null,null,null,'{}'::jsonb,0,false);
INSERT INTO nova.softaggregator_callback_receipts(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback)
SELECT 'stage6-rejected-atomic',repeat('f',64),'00000000-0000-0000-0000-000000000088','debit',5,0,935,id,'USD',5,'wrong-round','wrong-game',false
FROM nova.wallet_transactions WHERE idempotency_key='stage6-rejected-atomic';
COMMIT;
