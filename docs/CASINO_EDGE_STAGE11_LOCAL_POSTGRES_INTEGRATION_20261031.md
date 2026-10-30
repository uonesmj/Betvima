# BetVima Stage11 — actual PostgreSQL integration, OFFLINE ONLY (2026-10-31)

## Why
Stage10 mocked 8/8 cases passed against the **genuine pinned live source** transformed only in a separate shadow file, SHA12 `e02a19a9f3bf`. The real live port 3098 `postgres.ts` has SHA12 `3d66c5724ff6`. Operator's prior read-only VPS timing showed a separate PostgreSQL `SET LOCAL statement_timeout` median **145.9ms** per extra network roundtrip. Number of such calls in one authenticated supplier round is still **unknown**.

Next, verify **real PostgreSQL execution semantics**, rather than more mock-only tests, while strictly preventing any access to production SQL/wallet or live 3098.

## Built artifacts (not yet run by operator)
- `scripts/stage11/run_stage11_isolated_pg.sh`: Launches a **fresh, temporary** Podman PostgreSQL container from the existing locally cached image used by `betvima-stage5-pg`. Requires original isolation network `none` unchanged. New container has `--network none`, `--memory 512m`, `--cpus 1`, 128 PID cap, **no published ports**, and only a private UNIX socket mounted inside a root-owned stage11 temporary directory. No download/pull. Removes temporary container and socket when complete or on failure. The no-network container's temporary trusted local socket is accessible only through the private root parent directory; never reuse this trust configuration for production.
- `scripts/stage11/run_real_postgres_adapter_isolated.cjs`: Fingerprint-pins **exact deployed adapter SHA12 `3d66c5724ff6`**, **exact shadow SHA12 `e02a19a9f3bf`**, and exact live source module `transaction-timeout-context.ts` SHA12 `3b09fb01e7b3`. Compiles both actual TypeScript adapters with existing compiler, loads genuine AsyncLocalStorage context using an import-restricted VM, connects via `pg` **only to the new local UNIX socket** with explicitly specified database/user, and allows only prefixed ephemeral stage11 table SQL, selects, timeout settings and transaction boundaries. Does not read any production database URL. Does NOT call customer, wallet, casino, FX or vendor RPCs.

## Test assertions
1. Exact original and shadow source hashes and no production file changes.
2. Execute six same-timeout `SELECT 1` statements in each real PostgreSQL transaction. Expected original 6 `SET LOCAL` versus shadow 1.
3. Real SQL parameter binding, table INSERT/SELECT with durable COMMIT within disposable local test database.
4. Per-operation SQL `statement_timeout` override and reset to normal, checked with PostgreSQL `current_setting`.
5. Explicit rollback leaves a test table's committed value intact.
6. Database cancels `pg_sleep(1.15)` under a 1000ms timeout (SQLSTATE `57014`), and the driver cleans up the transaction.
7. No external port exposure, no real-money operations, no requests to original PostgreSQL and no live service restart. Container and socket removed on trap.

## Fail closed and success criterion
Only report **`STAGE11_REAL_POSTGRES_INTEGRATION=PASS`** if both original and shadow adapters meet all assertions AND six SET versus one SET is verified. If the existing local image is missing/unexpected, container fails to start, or the socket cannot be mounted, abort without reusing production PostgreSQL or fetching new images automatically. These scripts have been committed and JavaScript syntax parsed but **no Stage11 actual isolated PostgreSQL run is claimed yet**.

## Other remaining Stage10/production launch blockers
- Supabase branch `qrirgzvxpjhhwvyazvpn` (owner-approved $0.01344/h) is still `MIGRATIONS_FAILED`; manual 10 staging migrations do not match 29 Supabase production migrations (97 production NOVA tables versus 23 staging NOVA tables). Do not rebase/reset or merge until explicit restore and migration plan; never push real user information into the synthetic branch.
- Genuine SoftAggregator vendor-origin signed callback validation, safe ingress/authentication, provider history reconciliation, immutable FX and wallet settlement, security review of public SEC-DEF functions, eligible jurisdiction/customer/KYC safeguards, current backups and rehearsed rollback remain gates.
- Do not promote GitHub PR #370 or alter port 3098. A passing Stage11 adapter-only integration test still does NOT prove player Spin <1 sec or eligibility for real-money operation.

**Stage11 actual operator stdout is needed before marking this integration step complete.**
