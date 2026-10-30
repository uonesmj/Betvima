# BetVima Stage 8A: signed EU Edge in-memory financial preflight (2026-10-30)

## Deployed
New function `betvima-eu-casino-stage8-simulator` ACTIVE v1, `verify_jwt=true`, uses existing independently verified Ed25519 signed caller and fixed region verification eu-west-1. Five deployed source files match draft PR exactly.

- 16 deterministic pure BigInt-only, **in-memory** finance assertions: seed, debit, idempotent replay, replay conflict rejection, win credit, refund, refund replay, duplicate refund target rejection, reversal of win, reversal replay, duplicate reverse target rejection, overdraft, nonexistent target rejection, incorrect original amount rejection, zero amount rejection, final balance/ledger reconciliation.
- Existing 32 synthetic FX precision checks, Stage3 schema metadata probes and nine static read-only SELECT queries on the all-zero dummy UUID run as in Stage7.
- Flags `stage8_finance_simulation_mode=IN_MEMORY_NO_WALLET_DB_ACCESS`, `stage8_wallet_rpc_from_edge_executed=false`, `stage7_isolated_staging_db_connected=false`, `stage7_remote_financial_rpc_enabled=false`, `financial_operations_enabled=false`.
- No provider callback, real Supabase financial mutation, money movements or public staging database access.

## Operator test pending
`scripts/stage8/run_signed_simulator_preflight.sh` on the VPS:
1. Verifies that isolated Podman PostgreSQL remains `NETWORK_MODE=none`.
2. Read-only checks prior real-RPC synthetic Stage6 consistency (wallet balance=940, duplicate debit once, 10 unique debits, two credits, ledger total=940).
3. Copies the already successful Stage7 Ed25519 signing test client into a Stage8-specific local test file and checks 16-case finance simulation fields in four accepted signed responses. Negative authorization tests continue to use the existing signed test.
4. Writes only local output/log files. No new Postgres database, production source or process change.

## Limitations / next gate
**This is Stage8A only, not a completed Stage8 live financial end-to-end implementation.** The Edge function cannot call the network-isolated local PostgreSQL or authoritative wallet RPC. Repeating the stage6 proof on the VPS does not turn the remote in-memory simulation into a persisted transaction. Do not report Edge Debit/Credit/Rollback latency as validated by this test.

To complete Stage8B, provision a truly isolated Supabase staging branch/project (cost consent required; no existing branch other than main currently) or design and audit a signed outbound reverse RPC relay that only accepts fixed synthetic test calls and never exposes production wallet credentials, service-role keys or PostgreSQL network ports. Reject replay, preserve transaction/receipt atomicity and audit provider ingress Worker separately.

Keep PR 370 draft. Do not route SoftAggregator production callbacks to Stage8 and do not alter casino port 3098.
