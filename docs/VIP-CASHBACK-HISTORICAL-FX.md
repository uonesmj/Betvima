# VIP cashback historical FX — financial verification

**Owner-approved policy:** each settled IRR/IRT sportsbook bet and each eligible IRR/IRT deposit is converted to USD at the latest historical Arzhaam USD/toman sample at or BEFORE its authoritative completion/settlement timestamp. The rate must be no more than 90 minutes old. No Monday spot rate, forward interpolation, or guessed price is permitted.

## Exact money contract
- USD: cents per dollar, 2 decimals.
- IRR: integer rials (0 decimals), not tomans.
- IRT: integer tomans (0 decimals).
- Provider history price: TOMANS per US dollar.
- Per-event HALF_UP conversion: USD cents from IRR = round_div(irr * 10, toman_rate). From IRT = round_div(irt * 100, toman_rate). Never use JS floating point.
- Weekly net loss USD cents = max(0, -sum(converted settled bet net results)). Winning profits offset losing stake losses. Total converted successful deposits determine the tier.
- Every credited wallet transaction stores historical_fx_evidence including source identifiers, rate IDs, settlement timestamps, original currency/amount and converted USD cents. Source price rows are immutable.
- Missing, stale, unsupported, or conflicting historical prices prevent payout for that entire user/week; deposit-active users are audited as FX_MISSING_HISTORICAL. No fabricated fallback.
- Late regrades/chargebacks produce discrepancies; do not automatically claw back wallet credits.

## Provider and supported history
The Arzhaam history endpoint is /api/rates/history/usd?range=30d (also supports 7d/90d subject to plan). The server-only ARZHAAM_API_KEY credential is required. Strict validation checks assetId=usd, range and meta.currency=toman, plus decimal price, RFC3339 sample times, duplicate timestamps and data size.

## Release sequence
1. Verify all existing VIP cashback tests and new historical FX SQL regression against disposable PostgreSQL. Keep both finance feature switches disabled.
2. Apply immutable migrations 0202–0206 one by one to the actual registered Supabase production database. Record the precise SHA-256 of each original SQL source in nova.migrations and verify registry before trying normal web deployment.
3. Install and test one-shot FX importer using the existing protected server ARZHAAM_API_KEY and the verified actual production application root. Then install the separate hourly service/timer in ops/systemd/betvima-vip-fx.*. Example directory /opt/nova in those templates is NOT authoritative until verified.
4. Backfill provider historical points from the last 30 days and check nova.vip_cashback_fx_blockers for the closed week. Inspect all missing/ambiguous samples manually; never invent FX rates for production.
5. Check user/account wallets, money rounding, FX scaling, reversal/idempotency, and risk restrictions. Obtain independent finance sign-off before activating real payouts.
6. Trigger owner-approved GitHub Actions Production web deployment. Verify the public VIP page and authenticated history/admin endpoints on the deployed revision.
7. Enable VIP_CASHBACK_PAYOUT and VIP_CASHBACK_CRON independently only when provider ingestion and all financial checks are green. Observe the first supervised Monday run, cron.job_run_details and tables vip_cashback_run_audits, vip_cashback_run_failures, vip_cashback_discrepancies. To stop payouts, turn OFF either DB switch.

## Operational limitation
The connected Supabase instance already has the guarded Monday cron, but historical Arzhaam requests must be made from the web server where the protected API key is installed. There is no direct server-shell connector in this session, so the hourly FX timer cannot be independently verified as installed. Merely adding this code or new migrations does NOT activate real-money credit.
