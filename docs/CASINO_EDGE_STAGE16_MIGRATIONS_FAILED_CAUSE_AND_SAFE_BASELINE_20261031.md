# BetVima Stage16 — Supabase Ireland branch migration failure: exact cause and safe baseline plan (2026-10-31)

## Status
- **Root-cause investigation COMPLETE and independently reproduced via read-only catalog checks.**
- **Branch repair NOT performed.** Preview branch `qrirgzvxpjhhwvyazvpn` remains `MIGRATIONS_FAILED`; synthetic casino finance branch remains isolated, without user data.
- **Production legacy casino on port 3098 untouched.** NO changes to registration, wallet deposits/withdrawals, geo, age, identity/KYC, or existing access controls.
- **Do NOT run** `supabase migration repair`, production DDL, branch reset/rebase/merge, new provider callback or any transfer of customer money to staging as an automatic fix. All these require a separately verified migration baseline and rollback strategy.

## Evidence: failed migration identified exactly
Branch creation: 2026-10-30 ~20:37 UTC. Retrieved branch's `postgres_logs` with error `event_message` and `parsed.query`, not just SQLSTATE.

First two transient metadata errors:
- 20:37:45.886 / 20:37:47.509 UTC — `42P01 relation "supabase_migrations.schema_migrations" does not exist`; queries checking the migration registry at startup. Both production and current preview now have this table; these two messages alone do **not** establish the blocker.

Proven actual replay error:
- **20:37:47.801 UTC — `P0001: ODDS_FUNCTION_MISSING`** from a `DO $patched$` migration that executes
  `pg_get_functiondef(to_regprocedure('nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)'))`.
- The SQL throws when this exact function is absent. This error appears within the failed migration statement logged in `parsed.query`.
- Read-only query against **production** `supabase_migrations.schema_migrations` confirmed the matching single-statement migration:
  **`20261012160639 repair_clean_prematch_odds_resumption_20261012`**.
- Direct catalog check: exact `nova.publish_odds_tick` function **exists on production** and **is absent on this preview branch**. Base schema objects had not been replayed before a *patch* against them, so the patch's protective guard correctly failed.
- The branch's 10 manually installed Stage8B migrations and present `supabase_migrations.schema_migrations` table were added **after** the original branch creation failure. Their existence today does not cure the failed original migration pipeline.

## Why a single SQL quick fix is incorrect
Production's Supabase native migration history has **29** timestamped entries, the earliest only `20261012160639`. Production also maintains a separate **legacy `nova.migrations` registry with 104 applied filenames**, including 2 baseline-marked rows. GitHub main contains only **99** legacy `supabase/migrations/*.sql` files. Exact missing GitHub legacy files (names only, no SQL or user data):
- `0202_vip_cashback_historical_fx.sql`
- `0203_vip_cashback_fx_payout_audit.sql`
- `0204_vip_cashback_fx_blocking_audit.sql`
- `0205_vip_cashback_fx_ingest.sql`
- `0206_vip_cashback_fx_blocker_scope.sql`

Thus the managed preview replay currently starts with recent **patch migrations** rather than a reproducible **base schema**. Adding a dummy `publish_odds_tick`, blindly marking this migration applied, skipping it, or merging/in-place rebase risks a misleading partial schema and subsequent failures. Note that 99 legacy filenames use short numeric prefixes, with duplicate numeric prefixes; this set does not form a valid standalone timestamped Supabase native migration sequence.

**Observed full schema parity drift:**
- Live production `nova`: **97 tables / 96 routines / 45 noninternal triggers**.
- Irish preview `nova`: **23 tables / 24 routines / 13 noninternal triggers**, 74 live tables missing, including `bets`, `user_limits` and `kyc_submissions`. These legacy systems must **not be rewritten** as part of the speed project.
- Isolated branch still has the needed 6 core wallet/receipts objects and synthetic finance fixtures, but must **never serve real users**.

## Verified Stage16 read-only guard
Added `scripts/stage16/diagnose_branch_replay_prerequisites_readonly.sql`, which was **executed against BOTH** production and the Irish preview via read-only Supabase SQL:
- Production: `nova_base_tables=97`, `migration_rows=29`, `first_failing_migration_registered=1`, `odds_function_present=true`, `legacy_nova_migration_registry_present=true`, `first_migration_base_dependencies_present=true`.
- Preview: `nova_base_tables=23`, `migration_rows=10`, `first_failing_migration_registered=0`, `odds_function_present=false`, `legacy_nova_migration_registry_present=false`, `first_migration_base_dependencies_present=false`.
- Independent Stage14 synthetic financial read-only audit re-run after Stage16 investigation remained `stage14_synthetic_audit_pass=true`: fake USD wallet 1000 minor = posted journal 1000, 18 fake rounds, 72 unique receipts, 73 journal entries including seed, 0 financial mismatches.

## Correct repair sequence — strictly *isolated*, and not yet executed
1. Obtain a private, access-restricted, **schema-only** snapshot of the current production database; no `COPY` rows, no production user/account/KYC data, no secrets committed to GitHub. Because migrations include function source, inspect privately for any embedded sensitive constants before sharing even a schema dump. Verify the exact schema against production metadata counts and function signatures.
2. Reconstruct any missing legacy schema dependencies and the five absent historical migration definitions **without inventing semantics**. Recover from trusted backups/source of truth when needed; never guess financial/KYC logic. A full normalized schema baseline may be preferable to re-executing 104 patch migrations.
3. Test baseline plus timestamped historical patches in a **fresh temporary, isolated Postgres/Supabase development environment**, with no production credentials or live network provider calls. Verify `publish_odds_tick`, all 97 tables / 96 routines / triggers, wallet RPC behavior, and current age/geo/KYC rules unchanged **as schema only**.
4. Preserve current Irish Stage8B fake journal fixtures; **do not reset/rebase/merge/delete** this preview until explicit inventory and an alternative fresh schema test have passed. If a *new* paid preview is needed, separately verify cost and user approval. No new server needed for root-cause diagnosis.
5. Only after complete clean-room replay and independent eligible deployment review, consider a controlled environment deployment with a rollback plan. **Do not apply migration history fixes to production** merely to clear a preview status.

Official docs: https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status ; https://supabase.com/docs/guides/deployment/branching/troubleshooting

### Stage gate
**STAGE16_FAILURE_ROOT_CAUSE=VERIFIED**
**STAGE16_SCHEMA_BASELINE_REPLAY=NOT_YET_VERIFIED**
**STAGE16_PREVIEW_MIGRATION_STATUS=MIGRATIONS_FAILED**
**STAGE16_LEGACY_PRODUCTION_MUTATIONS=0**
