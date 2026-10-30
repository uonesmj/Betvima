# BetVima Stage 5 — isolated PostgreSQL receipts/ledger constraint tests

This is **not** a real-money casino migration, real wallet engine, or vendor integration. All staging data are synthetic. **Never** run this against the connected Supabase production database or BetVima's port 3098 service.

## Target
- Only the existing local Podman container `betvima-stage5-pg` running PostgreSQL 17 with network mode `none`.
- The target database must be exactly `betvima_stage5`. Existing `nova` or `stage5_test` schemas cause a hard stop.
- Bootstrap provides **minimal synthetic dependencies** (`nova.profiles`, `nova.wallets`, `nova.wallet_transactions`). These are **not identical** to the full real NOVA schema and do not include its authoritative `post_wallet_entry` function.
- Installs unmodified `0208`–`0212` SoftAggregator financial migrations from the immutable GitHub source commit `9d0476a619e81b5b78f612d401eb6e35758dc19c`.

## Verified source
Installer, bootstrap and financial-invariant tests are included in this draft PR, with immutable installer commit `51eb5b6f8f60e058fd01f7221de6e5ab9df691f1`.

## What runs
The SQL test suite asserts the database accepts coherently linked **synthetic** debit, win credit, refund of debit, and reverse of win receipts. It checks ledger balancing, immutable rounds/receipts/bindings, duplicate callback ID rejection, once-only rollback target, round or ledger mismatch rejection, invalid FX round rejection, and restricted client write privileges/RLS. Testing occurs within `BEGIN ... ROLLBACK`, so the fake player/ledger entries do not persist.

## What this does **not** prove
The mock wallet ledger entries are inserted in test SQL, **not** posted by the actual production application transaction implementation. Therefore the suite does not prove financial atomicity of `post_wallet_entry`, runtime exact-balance behavior, supplier signature verification, multi-user concurrency, real currency FX quotation, or the endpoint latency for monetary provider callbacks. It is a staging migration guard only. Such claims require an isolated full-schema replica and end-to-end provider-signed transactions.

## Safety gates before production
- Reproduce the actual live schema and deployment, including `nova.post_wallet_entry`, without copying live account records or secrets.
- Audit trusted ingress Worker code and SoftAggregator vendor callback agreement.
- Test ledger commit atomicity, retry and rollback races, rejected cases, currency snapshots and genuine signed E2E callbacks with synthetic wallet funds.
- Review geographic licensing/compliance obligations and supplier approval; retain an audited rollback and original authoritative production callback until ready.

## Rollback / cleanup
Stop and inspect on errors; do not delete `betvima-stage5-pg` or its volume without an explicit operator decision. No production data is accessed by these scripts.
