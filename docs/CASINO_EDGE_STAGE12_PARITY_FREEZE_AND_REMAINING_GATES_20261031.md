# BetVima Stage12 — post-Stage11 read-only parity & frozen behaviour gates (2026-10-31)

## Confirmed Stage11 test result

Operator executed exactly pinned original 3098 and isolated-shadow adapters against fresh Podman PostgreSQL with network disabled, no public ports, UNIX socket. **Stage11 passed**: both candidates passed SQL commit, custom timeout/reset, rollback and server timeout cancellation; original ran **6** transaction-local SET calls during 6 statements and optimized shadow **1**; production DB was not connected, no live wallet actions, 3098 unchanged, test container removed. Previously a separate live VPS-to-Postgres `SET LOCAL` roundtrip median was 145.9 ms; that is not proof of real customer Spin latency.

### Current production/isolated branch comparison — fresh read-only SQL via Supabase
Production `mqygiufkubxxxjodsycu`: `nova` has **97 tables, 96 routines, 45 noninternal triggers**. All 8 watched objects present: `bets, profiles, softaggregator_callback_receipts, softaggregator_player_wallet_bindings, softaggregator_round_fx, user_limits, wallet_transactions, wallets`.

Irish branch `qrirgzvxpjhhwvyazvpn`: `nova` has **23 tables, 24 routines, 13 noninternal triggers**. Six watched objects present: `profiles, softaggregator_callback_receipts, softaggregator_player_wallet_bindings, softaggregator_round_fx, wallet_transactions, wallets`; **`bets`, `user_limits` absent**. Branch status **`MIGRATIONS_FAILED`**. None of these queries read actual user values or changed either database.

## Scope locked: preserve current working features
User confirmed existing production registration/login, deposits, withdrawals, wallet, geo-restrictions, age and identity checks, and casino eligibility already work. **Do not redesign/recreate/change their behaviour**. Any future speed experiment must establish regression equivalence, and code must remain inactive on production until the normal security/legal eligibility checks and provider provenance requirements can be verified.

## Safe remaining work, in priority order
1. Do not run the schema-incomplete Irish branch as a replacement for production; trace its first failing migrations **read-only** and prepare non-destructive, separate staging repair plan. Do not reset/rebase without review because branch contains intentional synthetic ledger records.
2. Run performance instrumentation in a **separate isolated copy** on synthetic callbacks to measure DB acquire/SQL, FX rate and serialization phases, without sending vendor-origin financial callbacks to production, handling real money or weakening signing.
3. Test current financial semantics end-to-end via fake user/synthetic-only financial fixtures, verifying idempotency, receipt dedupe, debit/credit/refund/reversal, transaction safety and wallet/header consistency. Do not alter existing business rules.
4. Compare baseline versus candidate complete latency boundary and prepare an exact release/rollback diff under standard deployment approval; production 3098 is unchanged pending the gates.

**Current status:** Stage11 verified complete; production optimization not deployed, and no claim of improved live player Spin. Irish branch continues incurring its previously approved hourly rate until explicitly deleted.
