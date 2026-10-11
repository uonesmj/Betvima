# Data model

**74 base tables, 26 enums, 5 views, 64 SQL functions, 83 RLS policies, 20 migrations.**
Everything financial is enforced by the database, not by the application: functions are the API,
tables are the record, and triggers make the record append-only.

## Domains

| Domain | Tables |
| --- | --- |
| Identity & access | `profiles`, `user_sessions`, `user_limits`, `user_restrictions`, `user_notes`, `account_events`, `favorites`, `migrations` |
| Catalog | `sports`, `countries`, `leagues`, `teams`, `seasons`, `players`, `matches`, `match_periods`, `match_events`, `match_stats`, `match_results`, `current_match_results` (view) |
| Markets & odds | `markets`, `selections`, `odds_history`, `provider_entities`, `provider_health`, `bonus_ledger`, `promotions`, `user_promotions`, `feature_flags` |
| Betting | `bets`, `bet_legs`, `bet_settlements`, `cashout_quotes`, `settlement_jobs`, `settlement_events` |
| Wallet & money | `wallets`, `wallet_transactions`, `wallet_ledger` (view), `wallet_balances` (view), `payment_methods`, `payment_transactions`, `webhook_receipts`, `admin_adjustments`, `bonus_ledger` |
| Affiliates | `affiliates`, `affiliate_relationships`, `affiliate_attributions`, `affiliate_clicks`, `affiliate_links`, `affiliate_campaigns`, `affiliate_commission_configs`, `affiliate_groups`, `affiliate_group_members`, `affiliate_ledger`, `affiliate_settlements`, `affiliate_payouts`, `affiliate_adjustments`, `affiliate_daily_stats`, `affiliate_weekly_stats`, `affiliate_referral_stats`, `affiliate_fraud_flags`, `affiliate_audit_logs` |
| Risk | `risk_rules`, `risk_decisions` |
| Notifications | `notifications`, `notification_templates`, `notification_preferences`, `notification_deliveries` |
| Operations | `job_queue`, `worker_heartbeats`, `worker_locks`, `worker_runs`, `idempotency_keys`, `rate_limit_buckets`, `system_settings`, `system_operations`, `audit_logs`, `reconciliation_records`, `reconciliation_status_view` (view) |

## Enums (26)

```
account_status, affiliate_ledger_status, affiliate_ledger_type, affiliate_payout_status,
affiliate_settlement_status, affiliate_status, attribution_status, bet_leg_status, bet_status,
bet_type, commission_model, commission_scope, job_status, kyc_status, market_status, match_status,
notification_type, payment_tx_status, payment_tx_type, reconciliation_status, risk_decision,
selection_status, settlement_job_status, user_role, wallet_tx_status, wallet_tx_type
```
(`settlement_kind` and the affiliate period types are plain `text`/`varchar` columns, not enums.)

`src/lib/db-enums.ts` mirrors every one of them 1:1 (a unit test asserts the lists agree), so an enum
rename in SQL becomes a TypeScript error instead of a runtime crash. Two production-grade lessons are
already encoded in the code: enum columns are compared as `col::text = $n` when the parameter is also
used as text (otherwise PostgreSQL raises `operator does not exist: <enum> = text`), and enum
literals are cast on write (`$2::payment_tx_status`).

## Money representation

| Layer | Representation |
| --- | --- |
| PostgreSQL | `bigint` minor units; `numeric` only inside rounding helpers |
| TypeScript | `bigint` (never `number` for money) |
| HTTP/JSON | decimal strings (`"1250000"`) via `BigInt.prototype.toJSON` in `src/server/json.ts` |
| UI | formatted by `formatMinor()`; parsing a displayed value back into a number is never done |

## Migrations

| File | Contents |
| --- | --- |
| `0000_migrations.sql` | migration bookkeeping table (`nova.migrations`) |
| `0001_extensions_helpers.sql` | extensions, helper functions, enums, id generators |
| `0010_catalog.sql` | sports, countries, leagues, teams, seasons, players, matches, match data |
| `0020_markets_odds.sql` | markets, selections, odds history, provider tables |
| `0030_wallet.sql` | wallets, ledger, payment methods/transactions, webhooks |
| `0040_betting.sql` | bets, legs, settlements, cash-out quotes |
| `0050_affiliate.sql` | the entire affiliate domain |
| `0070…0083` | wallet, betting, settlement, affiliate and reconciliation functions |
| `0090_rls.sql` | row-level security baseline for every table |
| `0100_seed_configuration.sql` | system settings, operation switches, feature flags, risk rules, payment methods (configuration, **no** fake customers/bets/odds) |
| `0110_account_admin_ops.sql` | account events, admin operations, worker tables |
| `0120_audit_columns.sql` | audit columns and append-only triggers |
| `0130_affiliate_registration.sql` | hardened affiliate registration |
| `0140_job_claim_kinds.sql` | 5-argument `nova.claim_jobs` with kind filtering inside `for update skip locked` |
| `0150_rls_gaps.sql` / `0151_rls_grants.sql` | RLS for the tables that lacked it, plus the matching grants |

`scripts/db-migrate.sh` records filename, checksum, applied_at and duration per migration and fails
on checksum drift; `--status` shows what is pending and `--baseline` marks an existing database.
`scripts/db-verify.sh` then checks migration count, RLS gaps, wallet = ledger, orphan ledger rows,
duplicate commission keys, duplicate settlements, negative balances, paid payouts without a provider
reference and the betting kill switch.
