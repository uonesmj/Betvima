# Stage 7: signed outbound-only staging transport (2026-10-30)

## Deployed canary

- Supabase function: `betvima-eu-casino-stage7-outbound`, active v1, `verify_jwt=true`, Deno execution fixed to `eu-west-1` (checked by existing signed Ed25519 canary verifier).
- The new function is independent from the provider webhook; there is no money writer or supplier callback handling.
- It runs 32 pure synthetic FX checks plus nine fixed read-only SQL probes against non-existent all-zero UUID and schema metadata. **No real player records or amounts are returned or modified.**
- Response flags: `stage7_signed_outbound_bridge=true`, `stage7_isolated_staging_db_connected=false`, `stage7_remote_financial_rpc_enabled=false`, `financial_operations_enabled=false`.
- Deployed source was compared with the draft PR and matched byte-for-byte.

## VPS operator test

`scripts/stage7/run_outbound_probe.sh` first checks the **already-tested** local `betvima_stage6` in the network-disabled `betvima-stage5-pg` container. This read-only query validates synthetic balance 940, duplicate concurrent debits counted once, distinct debit and credit totals, rejected overdraft/atomic receipt absent, ledger sum 940, and absence of residual test receipts.

Only if local conditions pass, the script clones the successful pre-existing `/root/test-casino-stage4-20261030.cjs` Ed25519 signed canary into a new local test file, changes target and checks explicit stage-7 response flags, and invokes its four accepted requests and negative auth controls. No signing private keys are printed or committed.

## Distinction from full financial integration

**This phase validates VPS-to-Edge authenticated OUTBOUND connectivity after independent local-stage6 verification, not Edge-to-stage6 database access.** The local PostgreSQL container remains `NETWORK_MODE=none`; the Edge function does not communicate with it or execute a financial RPC. This cannot establish actual Debit/Credit/Rollback latency, production wallet parity, or spin-start performance.

For later bidirectional synthetic money tests, use a separate Supabase staging project or an audited outgoing mTLS/signed relay with strict synthetic-only commands, independent credentials, replay protection, and no internet-exposed Postgres port. Real production cutover additionally requires source review of the trusted provider ingress Worker, fiat FX failure handling, and finance/compliance approval.

## Safety guarantees

No changes to Supabase production financial rows; no live casino `3098` or Nginx updates; no external HTTP port exposed; no provider callbacks, wallets, credits, debits, or automatic deployments from PR #370. Remote VPS verification is **pending** until operator runs the signed probe.
