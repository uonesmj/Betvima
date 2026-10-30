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
