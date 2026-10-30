# BetVima stage 6 (direct GitHub runner)

This is an **isolated synthetic** PostgreSQL test, not a real casino integration.

Run only on the existing `betvima-stage5-pg` Podman container with network mode `none`. The runner creates `betvima_stage6` inside that container and refuses to run if this DB already exists. No production Supabase, 3098, nginx, or live wallet is targeted.

The script downloads four synthetic test SQL fixtures from the same **pinned Git commit** as the runner and original migrations `0001`, `0030`, `0070`, `0208`–`0212` from the pinned migration source commit. It runs concurrent identical and unique debits, two credits, overdraft rejection, wallet/ledger reconciliation, valid receipt+rollback tests in a transaction ending in `ROLLBACK`, and a failing receipt to confirm the preceding debit rolls back atomically.

**Important limits:** Profiles are a minimal mock. Results establish isolated wallet RPC and receipt invariant behavior only; they do not demonstrate supplier-signed callbacks, the actual network Edge migration, production schema parity, real FX, spin startup latency, or readiness for live money.

Operator should not delete or replay stage-6 DB following a partial failure. Analyze logs inside `/root/betvima-stage5/stage6-sql/` first. No script changes live casino wallet balances.
