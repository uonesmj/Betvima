-- Stage14/15: SYNTHETIC-ONLY, READ-ONLY. Apply ONLY on isolated branch qrirgzvxpjhhwvyazvpn.
-- Never run this against production or import live account/user balances.
WITH fixture AS (
 SELECT '00000000-0000-0000-0000-0000000088b1'::uuid AS uid
), wallet_stats AS (
 SELECT count(*)::int AS wallet_count, coalesce(sum(w.balance_minor),0)::bigint AS balance
 FROM nova.wallets w JOIN fixture f ON f.uid=w.user_id
), ledger_stats AS (
 SELECT count(*)::int AS ledger_count,
 coalesce(sum(CASE WHEN t.status::text='posted' THEN t.amount_minor ELSE 0 END),0)::bigint AS posted_sum
 FROM nova.wallet_transactions t JOIN fixture f ON f.uid=t.user_id
), receipt_stats AS (
 SELECT count(*)::int AS receipt_count,
 count(DISTINCT r.call_id)::int AS unique_call_count
 FROM nova.softaggregator_callback_receipts r JOIN fixture f ON f.uid=r.user_id
), round_stats AS (
 SELECT count(*)::int AS round_count
 FROM nova.softaggregator_round_fx x JOIN fixture f ON f.uid=x.user_id
), mismatch_stats AS (
 SELECT count(*)::int AS mismatches
 FROM nova.softaggregator_callback_receipts r JOIN fixture f ON f.uid=r.user_id
 LEFT JOIN nova.wallet_transactions t ON t.id=r.ledger_transaction_id
 WHERE r.response_error=0 AND (
 t.id IS NULL OR t.user_id<>r.user_id OR t.currency<>r.wallet_currency
 OR abs(t.amount_minor)<>r.wallet_amount_minor)
), identity_stats AS (
 SELECT (SELECT count(*) FROM auth.users)::int AS auth_count,
 (SELECT count(*) FROM nova.profiles)::int AS profile_count,
 (SELECT count(*) FROM nova.wallets)::int AS total_wallet_count,
 (SELECT count(*) FROM nova.profiles p JOIN fixture f ON p.id=f.uid
  WHERE p.public_id='STAGE8B-TEST-ONLY-88B1' AND p.preferred_currency='USD'
  AND NOT p.age_verified)::int AS fixture_profile_count
)
SELECT
 (identity_stats.auth_count=1
 AND identity_stats.profile_count=1
 AND identity_stats.total_wallet_count=1
 AND identity_stats.fixture_profile_count=1
 AND wallet_stats.wallet_count=1
 AND wallet_stats.balance=1000
 AND wallet_stats.balance=ledger_stats.posted_sum
 AND ledger_stats.ledger_count=receipt_stats.receipt_count+1
 AND receipt_stats.receipt_count=receipt_stats.unique_call_count
 AND receipt_stats.receipt_count=4*round_stats.round_count
 AND mismatch_stats.mismatches=0) AS stage14_synthetic_audit_pass,
 wallet_stats.balance AS wallet_balance_minor,
 ledger_stats.posted_sum AS posted_ledger_sum_minor,
 ledger_stats.ledger_count,
 receipt_stats.receipt_count,
 receipt_stats.unique_call_count,
 round_stats.round_count,
 mismatch_stats.mismatches,
 identity_stats.fixture_profile_count
FROM wallet_stats CROSS JOIN ledger_stats CROSS JOIN receipt_stats
 CROSS JOIN round_stats CROSS JOIN mismatch_stats CROSS JOIN identity_stats;