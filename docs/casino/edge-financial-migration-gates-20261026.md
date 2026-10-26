# BetVima — Supabase Edge financial migration gates (2026-10-26)

**Status:** EXPERIMENT ONLY. No wallet handler has been deployed to Edge.
**Live callback:** Namecheap VPS, Nginx `/api/webhooks/softaggregator` → `127.0.0.1:3098`.
**Database:** Supabase PostgreSQL 17.6, `eu-west-1` (Ireland).
**Prototype:** `betvima-casino-edge-shadow`, isolated synthetic signed probe; never use for financial callbacks.

## Measurements (real operator VPS, no financial operations)

| Measurement | Mean / observed |
|---|---:|
| VPS → PostgreSQL sequential read-only SELECT 1 | 166.9 ms |
| VPS → Edge eu-west-1 signed synthetic 6-query request | 490.3 ms (493.9, 486.8, 490.3) |
| Edge → Postgres first SELECT 1 in each request | 133.2 ms (132.8, 132.4, 134.4) |
| Edge → Postgres five subsequent SELECT 1 per request | 2.4 ms mean |
| Synthetic unsigned or tampered request | HTTP 401 |
| Synthetic signed request | HTTP 200 x3 |

The first-query measurement includes connection acquisition. On a warm request, an
Edge hop costs materially more than a direct single query. Latency is expected
to improve only for callbacks with multiple sequential Postgres round trips.
**Never extrapolate 2.4 ms to end-to-end rounds or provider animation/settlement.**

## Live historical integrity read-only check

SQL: `scripts/casino/edge-financial-receipts-readonly.sql`. It was executed
against the active Supabase project without mutations:

- 319 receipts, 273 successful and 46 rejected
- 29 successful rollbacks
- 0 successful receipts without ledger records/IDs
- 0 rejected receipts with ledger IDs
- 0 success ledger amount or wallet currency mismatch
- 0 success round-FX or immutable-wallet binding mismatches
- 0 successful rollbacks without an original receipt
- 0 duplicate debit refund, reversed credit, or ledger entry targets
- `historical_receipts_pass=true`

Existing canonical `casinoFinancialSchemaReady()` readiness SQL was separately
executed read-only against Supabase and returned `ready=true`.

**Scope of these results:** current historical database state only. They do
not prove all concurrency/rollback edge cases or vendor correctness, and do not
authorize real-money gaming or new markets.

## Required parity gates, all must hold before any money route change

1. **Inbound trusted ingress:** Keep SoftAggregator source IP allowlist,
   supplier HMAC with its documented canonicalization, independent Cloudflare
   signature on every field, strict timestamp and replay protection, and
   response schema `{error, balance}` over HTTP 200 for vendor business errors.
   Do not trust Supabase public anon JWT for financial authorization.
2. **Bridge authentication:** An independent Ed25519 signing key is root-only
   on the existing VPS. The Edge public key must be pinned, and any future
   money-bearing body signed byte-for-byte with nonce/call ID and timestamp.
   Nonce or callback receipt replay defense must be **persistent and atomic**
   in PostgreSQL, never in-memory.
3. **Eligibility on new debits:** Preserve `casinoRealMoneyUserAllowed` pilot,
   age verification, verified KYC when real-money mode is enabled, optional
   support approval, jurisdiction allowlist, self-exclusion and other active
   restrictions, wallet freeze, minimum stake, per-bet/day/week limits, and
   affordability. Do not broaden access based on the current pilot.
4. **Earned wins:** Ordinary credit payouts may remain payable after a
   previously eligible player's restrictions change, while all original
   currency bindings and integrity gates still apply. Do not indiscriminately
   block earned wins using *new-debit* eligibility.
5. **Wallet currency & exchange rates:** Keep immutable pre-launch
   `softaggregator_player_wallet_bindings` (USD, IRT, IRR). Preserve immutable
   `softaggregator_round_fx` and exact historic conversion/refund values.
   Never re-quote FX for an existing round.
6. **Atomic ledger accounting:** Preserve `post_wallet_entry` as the sole
   authoritative posting primitive inside a PostgreSQL transaction with
   signed amount, idempotency key, metadata and balance floor. A matching
   `softaggregator_callback_receipts` row and ledger entry must commit
   together or both roll back.
7. **Lock order:** Acquire callback call-ID advisory lock → round advisory
   lock → wallet advisory lock → wallet row. Follow canonical SQL post-wallet
   lock order and transaction isolation so parallel debit, credit, rollback,
   retry and account currency changes do not double-post or deadlock.
8. **Rollback:** `credit rb=1` refunds the exact original debit once;
   `debit rb=1` reverses a paid credit once. Require same player, round,
   game, vendor cents, exact historic native amount, original successful
   receipt and an unused original target; duplicate retries return the
   original response, never a second ledger movement.
9. **Error semantics:** Persist terminal insufficient balance business errors
   idempotently; network/DB errors must never falsely acknowledge success.
   Never log signing secrets, raw requests, usernames or wallet balances.
10. **Multi-stage deployment:** Implement a test-only financial handler in
    a separate branch and sandbox database, run existing USD/IRT/IRR
    `softaggregator-*.test.ts` tests plus new Edge parity, concurrent
    duplicate/replay/rollback suites and ledger reconciliation. No direct
    mutation of the current production DB in development tests.
11. **Release & rollback:** Pin the exact GitHub revision and expected
    artifact SHA, use a preconfigured auto-rollback on the existing VPS before
    switching a single callback, and verify all callback receipts and
    balances before expanding past the one-account pilot.
12. **Legal and provider requirements:** independently confirm age,
    jurisdiction, licensing obligations and supplier approval; never
    remove security/KYC restrictions to speed up callbacks.

## Next engineering decision

The first query on Edge is about 133 ms, rather than 2.4 ms, and the signed
end-to-end synthetic call is ~490 ms. Both Edge porting and a **single atomic
PostgreSQL RPC from the existing VPS** should be performance-modeled before
choosing the production architecture. A PostgreSQL RPC could avoid repeated
cross-Atlantic calls without adding a new service trust boundary; preserving
the exact financial contract is the critical constraint.

**No production changes from this branch.**
