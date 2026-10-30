# BetVima — Stage 4 FX parity review (2026-10-30)

## Uploaded live release evidence
- `betvima-edge-stage3-source.zip`: active port 3098 wallet, Fiat wallet, callback and authoritative exact FX module.
- `betvima-edge-stage4-deps.zip`: active `src/server/env.ts` and `src/server/providers/arzhaam/client.ts`; no .env, API values or secrets uploaded.
- The missing `src/lib/errors.ts` is a path difference: GitHub main has `src/lib/errors/index.ts` and related directory modules. Do not infer production content from main.

## Key observations
- Real-money fiat wallet fetches USD/IRT quotes from Arzhaam; the client uses `cache: 'no-store'` but **does not specify fetch timeout**. Delayed FX responses may affect **fiat-bound** initial rounds/balance, not the typical USD-only path. Provider fetch speed has not been measured.
- Actual casino wallet settlement calls the precision-preserving `fx.ts` BigInt functions, preserving per-round FX; the standalone Arzhaam client also exports older `Number`-based converters. **Do not substitute these for wallet settlement.**
- Missing `updatedAt` / stale quote timestamps are rejected by `validateCasinoFxSnapshot()`; do not silently relax this safety invariant.

## Stage-4 Edge pilot deployed
- `betvima-eu-casino-stage4-fx-parity` ACTIVE v1 on Supabase `mqygiufkubxxxjodsycu`; JWT verification enabled and signed synthetic canary required, pinned to invocation region `eu-west-1`.
- Source includes exact active `fx.ts` and 32 synthetic FX/parity/fail-closed checks, plus prior stage-3 read-only database schema metadata verification.
- Zero provider rate fetches, zero wallet writes, zero provider callbacks and zero transaction commits. `financial_operations_enabled=false` and `external_fx_provider_contacted=false`.
- Local tests: 3/3, all 32 synthetic checks pass. Deployment files compared byte-for-byte with GitHub.
- **Signed VPS remote runtime test still pending**; ACTIVE means deployed, not that the complete signed invocation was tested.

## Required before real-money cutover
1. Obtain active independent Cloudflare/SoftAggregator ingress Worker and review callback source authentication and egress rules.
2. Prepare a separate staging database with synthetic wallet/player balances and financial schema parity. Never use production wallet balances for tests.
3. Port USD/IRT/IRR Debit/Credit/Balance/Rollback with full existing ledger/receipt/round locking and FX snapshots; stress duplicate and concurrent callbacks. Make database commit authoritative before acknowledging success.
4. Instrument external Arzhaam quote timing/timeout and ensure explicit failure handling; prevent float rounding regressions.
5. Reconcile provider history, security review, compliance/supplier approval, traffic cutover controls, and rollback plan.

**No changes to production port 3098, Nginx, casino wallet DB records, Edge signing secrets or supplier callback routing.**

## Signed remote Stage 4 verification — passed, 2026-10-30
- User ran VPS signed canary, four valid synthetic calls: `EXIT_CODE=0`, `STAGE4_FX_CHECKS=32/32` on every call, `STAGE3_SCHEMA_READY=true`, `NO_MONEY_CALLBACKS_OR_WRITES=true`.
- Caller E2E median **724.2 ms**, database work median **158.4 ms**. These values are *not* debit, credit, rollback or reel-start latency.
- Independently confirmed Supabase logs in `eu-west-1`: **4 HTTP 200**, **2 HTTP 401** (negative auth checks), mean successful function execution **612 ms**, P95 execution **749 ms** (tiny sample).
- The connected Supabase organization currently exposes only **one** project: `mqygiufkubxxxjodsycu` (BetVima production). Do not create synthetic player wallets or write financial staging transactions to this database. Staging needs a separate project or an isolated local database with no production credentials.
- No further latency-only probes are required before beginning staging. Next priority: obtain independently deployed active provider ingress Worker source and provision isolated test database, then implement and verify atomic financial callback parity **before** any live cutover.
