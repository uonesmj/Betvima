# VIP weekly cashback — financial activation guide

## Financial contract (requires explicit final sign-off)
- Week: Monday 00:00 to next Monday 00:00 **Asia/Tehran**.
- Payout: Monday **after 09:00 Asia/Tehran** for the previously closed week.
- USD minor units throughout. Only wallet-credited, successful USD deposits are eligible; unsupported currencies are intentionally excluded pending verified historical FX snapshots.
- Deposit thresholds and cashback: USD 2,000 → 3%, 4,000 → 5%, 6,000 → 6%, 9,000 → 8%, 15,000+ → 11%.
- Loss base (operator-approved): **net weekly sportsbook loss** = max(0, total stake losses on settled MAIN-wallet USD bets **minus net profits from winning settled MAIN-wallet USD bets** in the same Tehran calendar week). Excludes bonus-funded bets, pending/void/cashout and reversed settlements. Zero or positive net result receives no cashback.
- Exact HALF_UP integer minor-unit rounding using nova.apply_bps().
- No user balance is calculated in the browser. PostgreSQL credits the existing USD wallet through nova.credit_wallet() in the same transaction as the immutable VIP payout record.

## Two independent safety switches
1. Database credit switch: nova.system_operations['VIP_CASHBACK_PAYOUT'] is created with enabled=false.
2. Independent database scheduler switch: nova.system_operations['VIP_CASHBACK_CRON'] starts enabled=false.
3. If using the separate systemd worker rather than pg_cron, environment NOVA_VIP_CASHBACK_AUTOPAY must be exactly true; do not enable that runner while database cron is installed.
4. PostgreSQL pg_cron jobs remain inert while the scheduler switch is off.
Both must be enabled following controlled finance review. A code deployment alone **never** activates payments.

## Deployment and operation
1. Install SQL migrations **0198 then 0199**, in separate committed transactions (new enum value).
2. Run the entire PostgreSQL integration test suite on an isolated DB and run the worker with the env flag absent: no ledger movement must occur.
3. Independently reconcile a complete sample week of payment transactions and bet settlements; verify winning profits offset losing stakes and obtain approval for the non-USD currency conversion policy.
4. Prefer database-native pg_cron on hosted Supabase (migration 0201). Verify cron.timezone is GMT/UTC, then install schedules from ops/cron/vip-cashback-schedule.sql. Never install the systemd timer simultaneously. If cron is unavailable, use the reviewed systemd timer after validating server WorkingDirectory and EnvironmentFile.
5. Primary Monday schedule is 05:30 UTC (=09:00 Asia/Tehran); daily Tuesday–Sunday catch-up retries are idempotent. Verify only one authoritative scheduled system and monitor cron.job_run_details plus nova.vip_cashback_run_audits and unresolved failures.
6. Before any live reward, independently verify payout accounting, mixed-currency exclusions, finance policy, and write a sign-off. Enable VIP_CASHBACK_PAYOUT and VIP_CASHBACK_CRON separately only then; first live run must be supervised. Keep immediate disable procedure.
7. Audit recorded vip_cashback_payouts and immutable wallet_transactions type vip_cashback. Review any vip_cashback_discrepancies daily.

## Guards
- One payout per user+week is enforced via immutable unique key and SQL advisory lock; credit+award are atomic.
- Worker can run repeatedly, including after an outage within the same week.
- Frozen/suspended wallets, non-customer accounts and unresolved regrade/chargeback discrepancies are blocked.
- All verified eligible award sizes use the same idempotent ledger credit path; no undocumented US$1,000 cashback cap is applied. Monitor unusually large transfers as an operational alert.
- Correction/chargeback after a paid reward triggers a discrepancy record and blocks later payments until finance resolves it. There is no automatic negative clawback.
- Historical backfills are disabled to prevent accidental duplicate payouts.
- If any candidate errors, worker exits nonzero and should alert operations.

## Known gaps before enabling actual money
- Net weekly sportsbook loss is approved. Independently verify winning net profits properly offset losing stakes and zero/positive net weeks never receive credit.
- Clarify all non-USD deposits/settlements, eligibility jurisdiction and related responsible gambling controls.
- Verify no conflicting promotions or wagering-bonus exclusions.
- Review operational anomaly alerting for large awards and resolution of chargebacks/regrades in the financial admin workflow.
- Complete operational deployment and signed-off PostgreSQL integration testing.

## Production hosted database state
- SQL migrations 0161a, 0198, 0199 and 0200 were applied directly through the connected Supabase project with the money switches disabled; their SHA-256 checksums were registered non-baseline in nova.migrations. The first production preview showed zero eligible candidates and zero cashback ledger credits.
- 0201 enables only the extension; the schedules in ops/cron are an independent reviewed operational step. Ensure two-switch gating before any real payout.
- Legacy affiliate SQL test 04 fails independently on changed commission rules; this does not invalidate the dedicated cashback finance SQL suite. Do not claim the full historical SQL suite passes.
