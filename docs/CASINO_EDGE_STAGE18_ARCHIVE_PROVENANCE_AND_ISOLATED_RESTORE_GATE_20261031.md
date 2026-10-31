# BetVima Stage18 — Verified source schema archive and offline safety gate (2026-10-31)

## Important stage status
**Stage17 COMPLETE from actual VPS owner output.** Stage18A script **committed and source syntax checked**, but **NOT YET executed on the owner's VPS**. No live or synthetic database has been restored, no production users/payment/KYC/geo/age changes made, and no application deployment to port 3098.

### Stage17 verified operator stdout
- The operator downloaded the authenticated Supabase project CA certificate and privately installed it into the VPS as `/root/betvima-stage5/supabase-prod-ca.crt`.
- Verified PostgreSQL 17 `pg_dump` against **same production project** through **session pooler 5432**, with `sslmode=verify-full` and explicitly configured trusted CA; no SSL downgrade.
- `STAGE17_READONLY_CONNECT_PROBE=PASS`, `STAGE17_PG_DUMP_STARTUP_READONLY_OPTION=ENABLED`, `STAGE17_SCHEMA_ARCHIVE_HAS_DATA=false`, `STAGE17_SCHEMA_TABLES=97`, `STAGE17_PRODUCTION_SQL_WRITES=0`, `STAGE17_ACTIVE_CASINO_3098_CHANGED=false`, `STAGE17_SCHEMA_ONLY_ARCHIVE=PASS`.
- Exact owner-reported private path: `/root/betvima-stage5/stage17-schema-only.l6OC0V/private-nova-schema-only.dump`.
- Exact owner-reported SHA256: `1d297d5dec78418afc4ca019614af8e344f725a3a95f0a47a8dcadcade0e4a61`.
- The custom archive includes `nova` *schema only*; it contains function definitions, so it is **confidential even without table rows**. Never upload archive or dump SQL to GitHub, tools, emails or conversation.

## Stage18A new offline archive verifier
Committed `scripts/stage18/verify_private_nova_schema_archive_offline.cjs`.

- Uses fixed absolute source path and exact expected operator SHA256; root-only permissions 0700 on source directory and 0600 on archive, no symlinks, 1KB–80MB size limit.
- Uses local PostgreSQL 17 `pg_restore --list <archive>` to enumerate the table of contents **without connecting to a database**.
- Rejects `TABLE DATA`, `MATERIALIZED VIEW DATA`, `SEQUENCE SET`, `BLOBS`, and `BLOB COMMENTS` in TOC.
- Requires exactly **97 table definitions**, **45 noninternal trigger definitions**, and **87 RLS policy definitions** as previously observed in live **read-only** catalog metadata. Logs safe counts for functions, indexes, sequences and views as diagnostics.
- Uses `pg_restore --schema-only --file=/dev/null <archive>` to fully decode the SQL from custom archive without creating a restore target/database and without outputting SQL source. All children get a clean environment *without DB credentials*, and no `-d`/`--dbname` option.
- Logs `STAGE18_ST​AGE18A_ARCHIVE_MANIFEST=PASS` (actual marker **`STAGE18_STAGE18A_ARCHIVE_MANIFEST=PASS`**) only after all guards succeed. This is not yet proven on owner VPS; no success should be claimed before real output.
- Any unexpected TOC format or count difference fails closed and must be investigated. Do not strip policies/triggers or alter source archive to force a pass.

### Stage18B isolation prerequisite: pending
Production metadata (queried directly read-only) indicates NOVA contains:
- 97 base tables / 1191 columns / 288 catalog indexes / 96 routines / 45 noninternal triggers / 87 policies / 91 RLS-enabled tables / 67 SECURITY DEFINER routines.
- 6 sequences, 5 views, 128 distinct custom composite/enum/domain/range *type rows* (includes automatic composite row types; not directly comparable to standalone pg_dump TOC `TYPE` count).
- An FK from NOVA to managed `auth` schema, and extensions `pg_cron` (pg_catalog), `pg_stat_statements` (extensions), `pg_trgm` (public), `pgcrypto` and `uuid-ossp` (extensions).

A bare PostgreSQL container therefore **cannot claim full Supabase-equivalent restoration** without matching managed `auth`, `extensions`, roles, grants, policies, and extensions. Stage18B should use a pinned version-compatible offline sandbox with **network none**, no published TCP ports, private UNIX socket, no production credentials/money/accounts. It must explicitly report skipped/unrestored dependencies instead of hiding failures. Never run `pg_restore` against the live database or the existing billed Ireland synthetic preview.

### Isolation and freeze statement
The original casino server port 3098, login/registration, deposits/withdrawals, wallet, geo/age/KYC, access controls, and provider callbacks are completely unchanged. Current PR #370 remains **DRAFT** and must not be merged/deployed until sandbox validation and separate authorized release review.
