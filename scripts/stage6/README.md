# BetVima stage 6 (direct GitHub runner)

This is an **isolated synthetic** PostgreSQL test, not a real casino integration.

Run only on the existing `betvima-stage5-pg` Podman container with network mode `none`. The runner creates `betvima_stage6` inside that container and refuses to run if this DB already exists. No production Supabase, 3098, nginx, or live wallet is targeted.

The script downloads four synthetic test SQL fixtures from the same **pinned Git commit** as the runner and original migrations `0001`, `0030`, `0070`, `0208`–`0212` from the pinned migration source commit. It runs concurrent identical and unique debits, two credits, overdraft rejection, wallet/ledger reconciliation, valid receipt+rollback tests in a transaction ending in `ROLLBACK`, and a failing receipt to confirm the preceding debit rolls back atomically.

**Important limits:** Profiles are a minimal mock. Results establish isolated wallet RPC and receipt invariant behavior only; they do not demonstrate supplier-signed callbacks, the actual network Edge migration, production schema parity, real FX, spin startup latency, or readiness for live money.

Operator should not delete or replay stage-6 DB following a partial failure. Analyze logs inside `/root/betvima-stage5/stage6-sql/` first. No script changes live casino wallet balances.

## Operator verification — PASS (2026-10-30)
The user supplied the terminal output of a second, read-only verification run against the existing `betvima_stage6` database on the network-disabled Podman container. Checks explicitly confirmed:
- `DATABASE_TEST=PASS`
- `CONCURRENT_TESTS=PASS`
- `OVERDRAFT_TEST=PASS`
- `ROLLBACK_TEST=PASS`
- `LEDGER_RECONCILIATION=PASS`
- `STAGE6_FINAL=SUCCESS`

Stored synthetic wallet balance after a 1,000-unit seed was **940 minor units**. Exactly one ledger entry exists for 12 duplicate-key concurrent debits; 10 different concurrent debit entries and two concurrent credit entries exist. Neither the overdraft test nor intentionally failed atomic receipt created a wallet entry. Receipt rows from rollback-contained synthetic tests were not persisted. This is a verified **isolated local database/RPC** result, not an end-to-end real supplier callback or EU Edge financial transfer.

## Stage 7 integration gate
The current isolated container is `NETWORK_MODE=none`, therefore remote Supabase Edge Functions **cannot** connect directly to that database. Do not disable isolation or publish the PostgreSQL port to the Internet just to run a benchmark. Before remote synthetic E2E tests, choose a dedicated separate Supabase staging project or a carefully reviewed, authenticated narrow bridge that keeps staging credentials separate, enforces signed non-money payloads, allows only fixed synthetic test cases, and preserves complete environment separation. Source of the provider's trusted ingress Worker is still required before any real financial callback cutover.
