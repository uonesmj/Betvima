\set ON_ERROR_STOP on
BEGIN;
DO $verify$
BEGIN IF current_database() <> 'betvima_stage6' THEN RAISE EXCEPTION 'STAGE6_WRONG_DATABASE'; END IF; END;
$verify$;
INSERT INTO nova.profiles(id) VALUES ('00000000-0000-0000-0000-000000000088');
SELECT nova.post_wallet_entry(
 '00000000-0000-0000-0000-000000000088'::uuid,
 'deposit'::wallet_tx_type, 1000, 'USD', 'stage6-seed-1000', 'stage6:synthetic:deposit',
 null,null,null,'Synthetic stage6 funding',null,'{}'::jsonb,0,false
);
DO $check$
BEGIN
 IF (SELECT balance_minor FROM nova.wallets WHERE user_id='00000000-0000-0000-0000-000000000088' AND currency='USD') <> 1000 THEN
   RAISE EXCEPTION 'STAGE6_SEED_FAILED';
 END IF;
END;
$check$;
COMMIT;
SELECT 'STAGE6_SEEDED_1000_SYNTHETIC_MINOR_UNITS' AS result;
