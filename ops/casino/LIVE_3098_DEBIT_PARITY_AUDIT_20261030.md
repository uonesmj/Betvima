# BetVima 3098 ordinary Debit-to-Edge source parity audit
**2026-10-30 — READ ONLY.** Operator supplied a ZIP containing 11 running-source modules.
This report intentionally does not commit their complete deployed source or credentials.

## Pinned evidence
- Active release: `/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl`
- `wallet.ts` SHA-256 `9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af`
- Missing optional `src/server/kyc/casino-support.ts`. This file is NOT required by the archived Debit transaction.
- Critical still-unarchived dependencies: `src/server/providers/softaggregator/client.ts` (operator real-money enabled/single-user allowlist), `src/server/db/transaction-timeout-context.ts`, `src/server/providers/softaggregator/fx.ts`, `src/lib/ports/db.ts`. Do not trust GitHub replacements without parity.

## Existing live USD Debit contract (not the development branch's default)
1. Ingress: SoftAggregator `X-Signature` HMAC-SHA256 **plus** independent Cloudflare `x-betvima-edge-signature` HMAC and supplier timestamp MD5. No Edge-only signed money requests.
2. Signed callback body `{action:'debit', username, currency:'USD', callId, amount, roundId, gameId, rollback:false}`; identity hash = SHA-256 JSON string of those exact fields in that order. Reject missing round/game.
3. Existing login/launch gating additionally checks allowed country, real-money enablement, immutable wallet binding, profile age/KYC status and approved KYC submission. Callback also checks real-money per-user allowlist via `client.ts`.
4. Preflight: financial schema integrity, immutable wallet currency binding, immutable per-round currency. `IRT`/`IRR` route to a completely separate FX settlement module; leave unchanged.
5. Transaction lock order must stay exactly **call-id advisory lock → receipt identity/idempotency read → round advisory lock → round row FOR UPDATE (and native USD insertion if new) → wallet advisory lock → profile read → wallet upsert/row FOR UPDATE**. Any deviation may deadlock against old 3098 Credit/Rollback.
6. For a new ordinary USD Debit: frozen wallet => error 2; insufficient available balance, age/KYC/eligibility failure, currency mismatch, below 10 cents, personal limits => error 1. Successful Debit posts a `bet_debit` ledger movement through `nova.post_wallet_entry` with `p_balance_floor=locked_minor`, then inserts a receipt in **the same database transaction**; transaction retries return immutable prior response.
7. Live `SOFTAGGREGATOR_MIN_BET_MINOR=10n` (USD 0.10) and max callback amount is `1_000_000_000_000n`. Note previous product requirement mentioned 20 cents; do not change during latency migration.
8. Crucial divergence: live `pilot-limits.ts` has **all four fixed caps NULL**; it permits positive stakes without a separate daily receipt aggregate. The development branch still contains `$1` per-spin/`$5` daily caps. Do not transplant that file. Per-user limits in `nova.user_limits` STILL apply. **Crucial source-parity detail:** active 3098 ALWAYS reads the `nova.wallet_transactions` daily/weekly usage aggregate under the wallet lock, even when the rolling limit columns are NULL. If that query fails, `limitAllows()` rejects the wager. An optimization to skip this read would change its failure behavior and is NOT part of the inert exact-live parity gate.

## Supabase-specific verified preflight
- Project Pro, PostgreSQL region `eu-west-1`.
- Signed, strictly non-financial Edge canary: four VPS→Edge 829/493/486/274 ms samples. Eight schema read SELECT statements only. Unsigned and tampered requests both rejected 401. This is **not** real Debit latency; do not cite 2.2 ms warm RTT as total round time.
- `nova.softaggregator_callback_receipts(call_id)` is primary key; transaction FK and rollback uniqueness guards active.
- `nova.post_wallet_entry` uses wallet-level advisory lock and ledger idempotency; no anon/authenticated EXECUTE. Future Edge direct DB connection must use a separate reviewed server-only role, not public API role.
- Current deployed canary `betvima-debit-eu-canary` is **read only** and has no Debit business handler. New `live-debit-parity.ts` and `debit-bridge-contract.ts` are **not imported into the deployed function**.

## Remaining safety acceptance before any money cutover
- Review exact active `client.ts` authorization/feature gates.
- Implement a complete Edge transaction preserving source semantics, receipt, round and wallet lock order, DB timeouts, retry/error codes, KYC and account state.
- Maintain immutable idempotency response under concurrency; handle supplier retries after timeouts and failed commits.
- Signed provider and Cloudflare ingress stay on original VPS; independent signed transport to Edge with strict timestamp, replay control, request binding and response authentication; fallback must avoid double posting after remote timeout.
- Test with approved test wallet: success, insufficient funds, frozen, age/KYC restrictions, self-exclusion, personal limits, concurrent same/different callback, same-id changed hash, credit/rollback during debit, round currency mismatch, ledger/receipt reconciliation.
- Measure **signed complete Debit** p50/p95/p99 including cold starts, not just SELECT RTT. Confirm rollback-safe gradual cutover with unchanged Credit/Balance/Rollback.
- **No production financial routing until all acceptance criteria pass.** Avoid unlicensed/unauthorized real-money flows.
