# BetVima — Stage 10 pilot preflight, evidence, and fail-closed decision (2026-10-31)

## Purpose and current decision
**Stage 10 NOT YET APPROVED for account-money testing or cutover.** This report prepares a reversible pilot, but does not authorize new real wagers, enable casino flags, change routing, restart 3098, or modify users/ledger. Supabase audit work below ran as READ ONLY queries.

Main production database project `mqygiufkubxxxjodsycu`; isolated billed Irish branch `qrirgzvxpjhhwvyazvpn` (owner-approved **$0.01344/h** until deletion). Draft PR #370 remains draft.

## Financial audit of *actual* production PostgreSQL (independent SELECTs)
- 102 wallets, 0 wallets with `wallets.balance_minor` different from sum of *posted* `wallet_transactions.amount_minor`; aggregate delta 0 minor units; 0 negative wallet balances.
- 1,027 journal records, 392 total casino callback receipts, 5 casino player-wallet bindings, 261 frozen per-round FX rows.
- 214 successful normal debits (error=0), 101 successful credits, 30 successful rollback credits/refunds; 47 rejected debits (response_error=1) with no ledger posting, as expected from rejection. 345 successful receipts have a corresponding ledger record; no successful missing-ledger link, no missing referenced ledger row, no mismatched user/currency/native wallet amount or `softaggregator:<call_id>` reference in this audit.
- All five canonical casino migration records 0208–0212 in production `nova.migrations`; 4 important audit triggers enabled, 6 important constraints validated; no direct anon/authenticated INSERT privilege on `nova.wallet_transactions`.
- These tests establish **internal ledger consistency only**, not authentic supplier-source HMAC verification, permitted jurisdiction, valid consent or independent supplier `getPlayerHistory` reconciliation. Rejected debits require separate reason-specific review but their number is not itself a financial discrepancy.

## Database schema compatibility: hard STOP
- Production `nova` physical tables=97, functions=96, Supabase migration records=29; isolated Irish stage branch tables=23, functions=24, Supabase migration records=10. In staging, `nova.migrations`, `nova.user_limits` and `nova.bets` missing.
- Branch creation automatic migration status is `MIGRATIONS_FAILED`; original wallet and receipt subset was installed independently and Stage8B/9 synthetic performance proven. This is **not** a full production migration or an equivalent application database; cannot cut over live user traffic or import real customer balances to this branch.
- **Do not merge/rebase/reset/copy production data** into staging without a reviewed migration plan and retention/cost authorization. Diagnose and fix the exact failed migration before any complete application rehearsals.

## Production timing and external provider outstanding checks
- Stage9 true Nginx callback wall times: Balance n=58 p50 1,022.5ms; Debit n=30 p50 4,894ms/p95 11,312.6ms; Credit n=16 p50 4,372ms. Upstream-specific timer missing, so cost of app vs SQL vs FX/provider cannot be attributed yet.
- Existing main production remote PostgreSQL acquire ~934ms, warm SELECT 1 ~148ms each; a few sequential queries can accumulate, but this does not prove the cause of 4.9s callbacks.
- Isolated Irish synthetic wallet cycles: signed 10/10, E2E p50 383.4ms/p95 613.2ms, no balance drift. This is NOT provider-origin spin or proof of faster real gameplay.
- The live 3098 release source differs from GitHub; the deployed provider handler and the older candidate must be inspected **on VPS**. Stage10 source structure read-only inspector: `scripts/stage10/inspect_live_casino_callback_readonly.py` — static callsite/await counts, active listener release identity and source hashes only. No credentials/file contents printed.
- Independently verify SoftAggregator's real source IP, GET signing conventions including vendor HMAC, Cloudflare Worker deployment, genuine supplier callback origin, `getPlayerHistory` settlement and signed callback replay. Repository Worker templates are not deployment evidence.

## New security advisory findings — needs risk review
Supabase read-only security linter on production reported one **ERROR** for `public.v_match_list` SECURITY DEFINER view and WARN for 23 public `SECURITY DEFINER` functions executable by anon and authenticated roles. Some financial/admin RPCs appear on the advisory list (`adjust_wallet_balance`, `admin_approve_deposit`, `admin_process_withdraw`, `settle_match`).
- A further code-level read-only check confirmed `public.is_admin()` looks up `auth.uid()`, requires the active admin role and does not simply trust a supplied user ID. Merely being executable by an unauthenticated caller is *not* proof those RPCs are exploitable; every entry must be assessed for effective call authorization, explicit grants, RLS bypass, and dependencies before hardening.
- Production also has 34 mutable-search-path linter warnings, public extension warning and leaked-password-protection disabled warning. Do not wholesale revoke public EXECUTE on live legacy RPCs without compatibility tests, or the app may break.
- Official linter references:
  - Security definer view: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
  - Anon callable definer functions: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  - Authenticated callable definer functions: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  - Mutable search_path: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

## Stage10 next steps, in safe order
1. Owner runs **read-only** static source inspector against actual VPS release; review sanitized output; locate synchronous app/DB/FX/network awaits and compare candidate while ensuring production callback route truly points to 3098.
2. Add phase-level timing to a separate candidate release (not live), including request start, auth HMAC validation, profile+binding, FX snapshot, wallet RPC/DB, receipt commit, response; each phase emits only anonymous aggregation and durations. No raw callback URL, body, token or player ID in logs. Instrument balance-header refresh and provider game-start separately.
3. Reproduce exact original handler with *supplier-generated* signed callbacks against fully isolated, schema-complete staging; verify all debit/credit/rollback/replay/timeout and provider history reconciliation; do not create synthetic aged/verified account assertions to bypass eligibility.
4. Fix branch migration drift and production DB security lints after review; independently verify actual allowed jurisdiction, age/KYC rules, supplier approval, current valid backup and tested rollback.
5. Only after approved gates: propose a capped, explicitly authorized single-user test (existing caps $1 per stake, $5/day stake, $3/day net loss and $5/week net loss) with manual stop/revert criteria, current-and-candidate identical user flow timings. Do not promise Spin <=1s from synthetic results.

**No production files, environment variables, DNS, Cloudflare Worker, Nginx routing, casino process, balances, or real users were changed by this Stage10 preflight.**

## User-run read-only actual 3098 source fingerprint inspection (2026-10-30 21:08+ UTC)

Operator completed `scripts/stage10/inspect_live_casino_callback_readonly.py`; the real casino listener on port 3098 **matches** `/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl`. Both deployed and prior RTT4 release are present, but the source for `src/server/db/postgres.ts` (SHA12 `3d66c5724ff6`), `src/server/providers/softaggregator/wallet.ts` (`9df555a7e3f0`), and `fiat-wallet.ts` (`242410f73f8a`) differs from the RTT4 candidate. This rules out an unsafe blind candidate switch.

Source static analysis shows:
- DB adapter `postgres.ts`: 15 `await`, 11 database-like awaits.
- `wallet.ts`: 27 `await`, including `casinoFinancialSchemaReady`, `getProfile`, `db.queryOne`, `readCasinoPlayerWallet`, `bindCasinoPlayerWallet`, `pilotCasinoDebitPermitted`, `readOriginalRound`, `tx.query`, `tx.queryOne`, `tx.rpc`. They are not all necessarily on a single callback path.
- `fiat-wallet.ts`: 22 `await`, including `getUsdIrtRate`, `readProfile`, `db.queryOne`, `quote`, `tx.query`, `tx.queryOne`, `readWallet`, `pilotCasinoDebitPermitted`, `limitsAllow`, `tx.rpc`.
- Callback HTTP route `route.ts` is the same as RTT4 candidate and only awaits `withCasinoCallbackTimeoutReuse`. Therefore investigation should focus on the transitive handler/finance path, not assume the route wrapper itself is the bottleneck.
- Prior live release did **not include** the GitHub-repository balance snapshot module or wallet balance API path checked by inspector; the header component source exists and is identical to previous RTT4 candidate. This matters when diagnosing game wallet vs header refresh; cannot attribute header lag to a feature that is not deployed.

Independently queried production read-only `extensions.pg_stat_statements` (aggregate since **2026-09-25 18:55 UTC**, not single-Spin trace):
- Wallet RPC normalized shapes: 830 calls, weighted mean execution **6.03ms**, maximum **74.44ms**. Callback receipt statements: 1178 calls, mean **0.75ms**, maximum 82.33ms; FX-round statements: 1130 calls mean 0.15ms.
- Wallet table query shapes: 65,796 calls, weighted mean **4.45ms**. Profile-related query shapes: 87,432 calls, weighted mean **38.30ms**, some historical pathological outliers; classification is regex only and may include unrelated application traffic.
- Point-in-time `pg_stat_activity`: 1 active, 8 idle, 0 idle-in-transaction, 0 lock waiters, 0 IO waiters, 0 active queries >2s. This is a single snapshot, not proof of no intermittent waits.
- These numbers, together with Stage9 VPS→remote PostgreSQL `SELECT 1` RTT ~148ms, suggest connection setup and multiple serial round trips are plausible primary suspects, but **do not prove** the precise source of 4–11s real provider callback latency. In particular, `getUsdIrtRate` is a plausible external FX dependency for fiat-wallet paths. Never remove HMAC checks, financial guardrails, wallet transaction atomicity or provider confirmation to optimize latency.

A further fingerprint-pinned **read-only** callsite map `scripts/stage10/map_live_callback_phase_calls_readonly.py` was created. It prints only trusted internal await identifiers and code line numbers from the already-fingerprinted 3098 source, never source content or credentials. It does not change code, traffic, financial ledgers or game sessions. Requires operator VPS execution before preparing any candidate release phase timers.

Next: prepare an entirely separate deployment candidate with time-profiles for post-auth callback phases and compare same authentic supplier-origin signed requests with reconciliation and rollbacks, after legality and schema parity checks. **No live wallet/test-account spin or cutover yet.**

## Operator Stage10 pinned callsite map — VERIFIED (2026-10-30 21:16 UTC)

Read-only pinned scanner completed with `STAGE10_SOURCE_FINGERPRINTS=ALL_MATCH`, `STAGE10_PORT_3098=LISTENING`, and **zero financial writes, callback calls, or production changes**.

- `postgres.ts`: 15 `await` tokens across the whole file, including the source locations `this.pool.connect` line 116, `this.pool.query` line 68, and six `client.query` usages (118,121,124,165,168,226). These counts are **per source file**, not proof of calls per Spin.
- `wallet.ts`: 27 `await` tokens including 13 DB-classified, 5 auth-classified, 5 wallet-binding-classified, one `Promise.all` construct. Relevant source locations: `readCasinoPlayerWallet` lines 55/123/129; `getProfile` lines 22/47/146/185; `pilotCasinoDebitPermitted` line 79; `readOriginalRound` lines 124/131; `tx.query` lines 153/166/176/184/187/254.
- `fiat-wallet.ts`: 22 `await` tokens, 13 DB-classified, 5 auth, one external-FX classified. `getUsdIrtRate` is called at line **69**; `Promise.all` at 82; `tx.query` lines 125/136/153/169/171/247; `pilotCasinoDebitPermitted` line 217.
- `route.ts` (hash `fca89762e8ff`): one `await` to `withCasinoCallbackTimeoutReuse` at line 68, as a delegating route wrapper.
- Active same original three content hashes already documented; no automatic migration, restart, or cutover.

**Independent cumulative `pg_stat_statements`:** Wallet RPC mean 6.03ms across 830 recorded calls (observations since 2026-09-25), while production median `debit` Nginx request is 4894ms. The app's remote DB connection acquire ~934ms and warm SQL roundtrip ~148ms on previously witnessed benchmark. Network serializations, connection reuse and FX provider latency are **plausible**, not individually measured. Need *per-phase real callback tracing* rather than changing wallet invariants by guess.

New next static source check **`scripts/stage10/inspect_live_fx_pool_path_readonly.py`** discovers the live `getUsdIrtRate` implementation path and HTTP/cache/timeout **tokens**, PostgreSQL connection pooling configuration **presence**, and phase-labelled await line numbers. It pins source file hashes and never exposes source contents, raw queries, tokens, secrets or accounts. The verifier is **not a live timing sample**.

Real play/Spin Stage10 remains blocked by isolated branch's failed automatic migrations, lack of authenticated provider-origin proof and independently reconciled provider history, security/eligibility requirements, and unreviewed callback phase instrumentation. No permission to infer a guaranteed 1-second Spin.

## FX provider and PostgreSQL session timeout findings (2026-10-31)

Operator's actual live 3098 scan `scripts/stage10/inspect_live_fx_pool_path_readonly.py` verified exact file hashes (`ALL_MATCH` for the four key source files). PostgreSQL adapter has **one Pool constructor** with connection/idle timeout/pool-max configuration; not missing Pool. `wallet.ts` carries balance/profile/limits queries; fiat callback wallet has `getUsdIrtRate` at source line 69. The real FX implementation lives at `src/server/providers/arzhaam/client.ts`, with HTTP and an identified `cache` token but **no timeout token in static scanner**.

The current GitHub file `src/server/providers/arzhaam/client.ts` calls Arzhaam with `fetch` and `cache: 'no-store'`, and without explicit `AbortSignal.timeout`; **this is not proof of a reusable cache** despite the previous scanner printing `CACHE_TOKEN=true`. The active VPS file may differ and must be checked separately. A slow external FX request is therefore a plausible delay on the **fiat-only path**, NOT proof that it causes delays on native-USD wallet path. Any eventual change must preserve rate validation, immutable per-round FX snapshots, financial accounting, fail-closed behavior, and must NOT fall back to an arbitrary stale price.

A distinct optimization suspect on the GitHub PostgreSQL adapter is `TransactionDb.run`: it sends a `SET LOCAL statement_timeout = …` command before its own client query. When the DB session already has `statement_timeout` via Pool config, that extra command can incur **one additional network roundtrip per transactional query**. The live deployed `postgres.ts` differs from GitHub, so **actual deployment must first be inspected**. Measured prior live VPS→Postgres warm SELECT1 RTT was ~148 ms; precise additional latency remains unmeasured.

To isolate this without financial writes, added `scripts/stage10/measure_pg_set_local_wire_overhead_readonly.cjs` to PR. Pinned to observed live postgres hash `3d66c5724ff6` and active process CWD; within `BEGIN READ ONLY` and `ROLLBACK`, alternates 6 regular `SELECT 1` with 6 `SET LOCAL statement_timeout` + `SELECT 1` for separate median network RTT. It also reports boolean indicators for *actual* live FX file's no-store, timeout and in-memory cache patterns without showing file contents/keys. No provider callback, wallet RPC, player ID, wager, or casino restart. Source parsed without syntax errors; **VPS operator run still pending**.

When test confirms the overhead, prepare a separate code candidate with a safe server-side statement timeout strategy that maintains per-operation safety, e.g. eliminating redundant repeated SET only where identical session-enforced limits are proven, **without relaxing timeout or transaction/replay guarantees**. Benchmark and run financial transaction/idempotency tests on isolated staging, and do not replace the active 3098 release until the migration and legal/customer-data gates clear.

## Stage10 real 3098 database wire-cost CONFIRMED; nonproduction fix prototype (2026-10-31)

Operator ran read-only `scripts/stage10/measure_pg_set_local_wire_overhead_readonly.cjs` on the live VPS with all source/listener guards passing and no financial operations:
- Active `TransactionDb.run` explicitly sends **one `SET LOCAL statement_timeout` before each transactional query**; configured `pg.Pool` itself also specifies `statement_timeout`.
- Initial database connection acquisition **913.8ms**; six warm `SELECT 1` RTT samples median **146.1ms**; six separate `SET LOCAL` RTT samples median **145.9ms**; `SELECT 1` after `SET LOCAL` median **145.7ms**. All commands were in a **READ ONLY** transaction then rolled back. No service changes.
- The extra ~145.9ms per repeated SET is confirmed. **1,167.2ms for eight SETs is a conditional hypothetical**, NOT a measured number of redundant SETs per authentic supplier debit and not a guarantee of 1.17s real-spin improvement. The repository's PostgreSQL driver uses a generic shared `TransactionDb` and the active deployed source hash differs from GitHub.
- Live Arzhaam FX file: HTTP fetch true, `cache:'no-store'` true, explicit AbortSignal timeout false, in-memory cache pattern false. Only relevant to the fiat-FX path. Changing FX freshness/round price or using stale rates is prohibited without separate review.

**Candidate code change on DRAFT PR #370 — NOT DEPLOYED**: `src/server/db/postgres.ts` now memoizes the current transaction's `SET LOCAL statement_timeout` value. It **always executes the first SET LOCAL**, repeats it when a per-query timeout override changes, and invalidates the cache for explicit SQL `SET/RESET`, `set_config`, `SAVEPOINT/ROLLBACK TO`; state belongs only to that transaction's `TransactionDb` instance and cannot leak across transactions. Neither provider signatures, FX conversion, native wallet RPC, receipt integrity, transaction BEGIN/COMMIT/ROLLBACK, nor customer accounts were changed. Because the active source differs, do NOT copy the entire GitHub adapter over live 3098.

**Automated test source**: `tests/unit/postgres-transaction-timeout-dedupe.test.ts` includes cases for repeated identical duration, alternate timeout, floor timeout, explicit setting invalidation, failed SQL rollback, across-transaction reset and unmodified direct pool queries. `scripts/stage10/test_candidate_timeout_adapter_mock.cjs` is a standalone **in-memory mock** runner which loads downloaded candidate source with an existing TypeScript compiler and fake `pg`, checks the same guards without any DB or network access. JS harness syntax was parsed; GitHub Actions PR workflow count on commit was 0 at the time of check; **regression tests have not yet been executed remotely or in CI and thus are NOT claimed PASSED**.

**Safe next step**: Download pinned candidate TypeScript + in-memory runner into a separate restricted folder on VPS, run node mock. If all pass, reconcile and apply only a reviewed minimal diff to a **copied active source in a separate candidate release**, run full isolated migration/schema-complete finance tests and per-phase provider-origin callback analysis. Do not alter 3098 before all gates. Branch hour-based billing continues.
