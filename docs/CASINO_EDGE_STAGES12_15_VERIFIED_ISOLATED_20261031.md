# BetVima — independently verified stages 12–15 (2026-10-31)

**Scope:** synthetic-only finance, read-only production inspection, and draft GitHub performance candidate. **No production deployment. Existing registration, login, deposits, withdrawals, geo, age verification, KYC, and eligibility were not changed or recreated.**

## Stage 11 (carried forward) — completed
Owner's VPS terminal transcript confirmed real isolated PostgreSQL (network=none, Unix socket only) PASS for both original and shadow driver, including COMMIT/ROLLBACK, per-query override/restore and cancellation. 6 timeout SET commands on original vs 1 on shadow for 6 test queries. Shadow SHA12 `e02a19a9f3bf`. Container removed; live port 3098 unchanged by the test. Measured DB network RTT ~145.9ms per SET is **not** a measured full real Spin speedup.

## Stage 12 — performed read-only schema and migration-drift diagnosis

- Main Supabase project `mqygiufkubxxxjodsycu`: `nova` has **97 tables, 96 routines, 45 noninternal triggers**.
- Isolated Irish branch `qrirgzvxpjhhwvyazvpn`: `nova` has **23 tables, 24 routines, 13 noninternal triggers**.
- **74 production tables absent** from isolated branch, including `bets`, `user_limits`, `kyc_submissions`, `payment_methods`, `casino_slot_spins`, `wallet_withdrawal_holds`, and other sportsbook, audit, notification, affiliate and admin tables. The 23 staging tables are all present on production, so branch is strictly incomplete. These facts do NOT authorize changing existing KYC, geo or payments.
- Existing branch state from Supabase branching: `MIGRATIONS_FAILED`, while isolated project's service status is `ACTIVE_HEALTHY`; do not infer schema completeness from service health.
- GitHub main tree currently contains **99 SQL files** under `supabase/migrations`, all with short legacy numeric prefixes, none with standard 14-digit timestamp prefixes; **12 duplicated numeric prefixes** (`0130,0140,0150,0181,0183,0184,0186,0188,0189,0190,0197,0214`). Remote production Supabase history currently has 29 timestamp-version records, branch has 10 manually installed Stage8B records. This is a strong **migration-history drift risk**, not sufficient to identify the exact broken migration because the branch may replay managed remote history rather than the GitHub legacy files.
- Isolated branch's Postgres logs during branch creation contain two SQLSTATE **42P01** (undefined table/relation) errors and one **P0001** (custom raise exception) on 2026-10-30 around 20:37:45–20:37:47 UTC. The logger query did not expose the failed SQL statement or a proven migration ID. Therefore **no automated reset/rebase, no guessed DDL, and no new production migration**. The exact branch workflow log/failed statement must be identified before any repair.
- Official Supabase docs note the most common `MIGRATIONS_FAILED` cause is SQL migration history versus actual schema drift: https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status and https://supabase.com/docs/guides/deployment/branching/troubleshooting.

## Stage 13 — read-only financial integrity, isolated staging
Before new tests: exactly one fixed fake profile and USD wallet, 64 existing receipts, 64 unique call IDs, 65 ledger entries including funding, 16 rounds, zero journal/receipt mismatches, zero rejected receipts linked to money, wallet balance=posted ledger sum=1000 minor. No production identities/funds selected or mutated.

## Stage 14 — genuine synthetic financial database RPC and idempotency PASS
- Verified original isolated `public.stage8b_synthetic_financial_round` still includes hardcoded synthetic-identity guard, expected starting balance guard, serialized advisory transaction lock, original `nova.post_wallet_entry`, and replay counter.
- New 32-char test nonce `cafe202610310001cafe202610310001` called on the **isolated branch only**; initial DB time **14.118ms** for debit, win credit, refund and reverse win. Same nonce replay returned `ok=true`, `idempotent_movements=4`, 4 receipts/4 ledger entries for this round, unchanged wallet balance 1000, DB time **10.753ms**. No supplier provider contacted.
- Persisted post-replay read-only reconciliation: 17 distinct FX rounds, 68 unique receipts, 69 ledger entries (one initial funding), wallet=posted ledger=1000, missing/mismatched ledger links=0.
- Additional concurrent attempt with new nonce `cafe202610310002cafe202610310002`: **one parallel tool invocation was blocked by platform safety checks**, the other completed successfully with `ok=true`, `idempotent_movements=0`, 4 ledger rows and 4 receipts for the new round. Therefore **two-request parallel execution was NOT verified** and must not be reported as a concurrency PASS.
- Afterward independent *read-only* reconciliation: 18 FX rounds, 72 unique receipts, 73 ledger entries, wallet and posted ledger both 1000, 0 mismatches. The first synthetic round and replay are a passed idempotency test; the two-way concurrency test remains unverified.
- Added `scripts/stage14/verify_isolated_synthetic_finance_readonly.sql`; executed this exact SQL against branch only and verified `stage14_synthetic_audit_pass=true` at 17 rounds (re-run after synthetic tests also returned equivalent PASS with 18 rounds). The script guards fixed fake identity, singleton staging records, 1000-minor starting/ending balance, 4 receipts per FX round, uniqueness, original ledger and link user/amount/currency consistency. This is not a real-money certification.

## Stage 15 — existing working features frozen / diff reviewed PASS
- Actual PR #370 changed file names collected directly from GitHub: **65 paths** (at audit time); only one application runtime source file `src/server/db/postgres.ts` is touched on the **draft branch**, along with synthetic functions, diagnostic scripts, docs, and tests.
- **Zero** changes to authentication, deposit, withdrawal, geo-restrictions, age/KYC, profile, or any production Supabase migrations. No old casino page/module or active provider wallet implementation changed in this work.
- Added `scripts/stage15/verify_frozen_features_scope.py` as a fail-closed path allowlist guard for subsequent changes; it accepts a list of git changed file paths. Applied the equivalent allowlist against the actual GitHub PR file list: `STAGE15_SCOPE_CHECK=PASS`, frozen-feature path changes=0. Note that source-path protection does not replace runtime regression coverage.

## Operational hold / next gates
1. Do not deploy draft PR #370 or alter live casino process/release until all real-money legal/vendor checks are satisfied. Existing working registration, geo, age and KYC rules are frozen.
2. Irish branch is still hourly billed at the previously approved **$0.01344/h**; do not reset/rebase/delete it without understanding its synthetic database and seeking the needed action authority.
3. Complete branch migration history diagnosis using exact failed statement; prepare a separate test-only complete schema without any real production user data.
4. Benchmark full **synthetic** callback phase timings and verify strict provider signature checks and source provenance with fake inputs.
5. Before any eligible production cutover, independently verify vendor settlement history, wallet invariants, delayed header consistency and rollback, under appropriate lawful/contractual controls.

**No new VPS was bought or production database/app relocated. Current evidence gives no safe reason to do so merely to fix a 145.9ms SQL-roundtrip overhead.**
