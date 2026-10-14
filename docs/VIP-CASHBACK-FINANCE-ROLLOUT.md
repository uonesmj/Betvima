# VIP weekly cashback — financial activation guide

## Financial contract (requires explicit final sign-off)
- Week: Monday 00:00 to next Monday 00:00 **Asia/Tehran**.
- Payout: Monday **after 09:00 Asia/Tehran** for the previously closed week.
- USD minor units throughout. Only wallet-credited, successful USD deposits are eligible; unsupported currencies are intentionally excluded pending verified historical FX snapshots.
- Deposit thresholds and cashback: USD 2,000 → 3%, 4,000 → 5%, 6,000 → 6%, 9,000 → 8%, 15,000+ → 11%.
- Loss base: **gross settled losing MAIN-funded USD sportsbook bets** within the week, excluding all bonus-funded bets, pending/void/cashout and reversed settlements; winning bets do not offset losing bets. The operator **must confirm** whether gross vs net loss is intended.
- Exact HALF_UP integer minor-unit rounding using nova.apply_bps().
- No user balance is calculated in the browser. PostgreSQL credits the existing USD wallet through nova.credit_wallet() in the same transaction as the immutable VIP payout record.

## Two independent safety switches
1. Database: nova.system_operations['VIP_CASHBACK_PAYOUT'] is created with enabled=false.
2. Worker environment: NOVA_VIP_CASHBACK_AUTOPAY must be exactly true. Anything else is read-only preview.
Both must be enabled following controlled finance review. A code deployment alone **never** activates payments.

## Deployment and operation
1. Install SQL migrations **0198 then 0199**, in separate committed transactions (new enum value).
2. Run the entire PostgreSQL integration test suite on an isolated DB and run the worker with the env flag absent: no ledger movement must occur.
3. Independently reconcile a complete sample week of payment transactions and bet settlements; confirm the currency conversion policy and gross-vs-net definition in writing.
4. Inspect the production directory and environment file paths before installing service/timer from ops/systemd. The example WorkingDirectory=/opt/nova is a placeholder until verified on the actual server.
5. Check that the timer is scheduled for Monday at 09:00 Asia/Tehran, persistent after downtime; ensure only one authoritative scheduled instance and adequate monitoring.
6. After financial approval, set the worker flag and the DB flag separately; first live run must be supervised. Keep an immediate disable procedure.
7. Audit recorded vip_cashback_payouts and immutable wallet_transactions type vip_cashback. Review any vip_cashback_discrepancies daily.

## Guards
- One payout per user+week is enforced via immutable unique key and SQL advisory lock; credit+award are atomic.
- Worker can run repeatedly, including after an outage within the same week.
- Frozen/suspended wallets, non-customer accounts and unresolved regrade/chargeback discrepancies are blocked.
- Awards greater than USD 1,000 go to manual finance review (do not silently credit).
- Correction/chargeback after a paid reward triggers a discrepancy record and blocks later payments until finance resolves it. There is no automatic negative clawback.
- Historical backfills are disabled to prevent accidental duplicate payouts.
- If any candidate errors, worker exits nonzero and should alert operations.

## Known gaps before enabling actual money
- Decide whether gross settled losing bets or net weekly sportsbook loss is the intended base.
- Clarify all non-USD deposits/settlements, eligibility jurisdiction and related responsible gambling controls.
- Verify no conflicting promotions or wagering-bonus exclusions.
- Approve a clear method of manual large-award review and reversals in the financial admin workflow.
- Complete operational deployment and signed-off PostgreSQL integration testing.
