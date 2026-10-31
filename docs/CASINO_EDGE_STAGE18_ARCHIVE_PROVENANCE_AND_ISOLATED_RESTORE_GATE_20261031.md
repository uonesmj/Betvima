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
- Logs `STAGE18_STAGE18A_ARCHIVE_MANIFEST=PASS` only after all guards succeed. This is not yet proven on owner VPS; no success should be claimed before real output.
- Any unexpected TOC format or count difference fails closed and must be investigated. Do not strip policies/triggers or alter source archive to force a pass.

### Stage18B isolation prerequisite: pending
Production metadata (queried directly read-only) indicates NOVA contains:
- 97 base tables / 1191 columns / 288 catalog indexes / 96 routines / 45 noninternal triggers / 87 policies / 91 RLS-enabled tables / 67 SECURITY DEFINER routines.
- 6 sequences, 5 views, 128 distinct custom composite/enum/domain/range *type rows* (includes automatic composite row types; not directly comparable to standalone pg_dump TOC `TYPE` count).
- An FK from NOVA to managed `auth` schema, and extensions `pg_cron` (pg_catalog), `pg_stat_statements` (extensions), `pg_trgm` (public), `pgcrypto` and `uuid-ossp` (extensions).

A bare PostgreSQL container therefore **cannot claim full Supabase-equivalent restoration** without matching managed `auth`, `extensions`, roles, grants, policies, and extensions. Stage18B should use a pinned version-compatible offline sandbox with **network none**, no published TCP ports, private UNIX socket, no production credentials/money/accounts. It must explicitly report skipped/unrestored dependencies instead of hiding failures. Never run `pg_restore` against the live database or the existing billed Ireland synthetic preview.

### Isolation and freeze statement
The original casino server port 3098, login/registration, deposits/withdrawals, wallet, geo/age/KYC, access controls, and provider callbacks are completely unchanged. Current PR #370 remains **DRAFT** and must not be merged/deployed until sandbox validation and separate authorized release review.

## Stage18A completed — exact user VPS output

Operator ran `scripts/stage18/verify_private_nova_schema_archive_offline.cjs` with original SHA and private archive. **Actual observed stdout:**

```text
STAGE18_MODE=OFFLINE_SCHEMA_ARCHIVE_VALIDATION
STAGE18_SHA256=PASS
STAGE18_ARCHIVE_CUSTOM_TABLES=97
STAGE18_ARCHIVE_TRIGGERS=45
STAGE18_ARCHIVE_RLS_POLICIES=87
STAGE18_ARCHIVE_FUNCTIONS=96
STAGE18_ARCHIVE_INDEXES_EXPLICIT=132
STAGE18_ARCHIVE_SEQUENCES=6
STAGE18_ARCHIVE_VIEWS=5
STAGE18_ARCHIVE_DATA_RECORDS=0
STAGE18_ARCHIVE_DECOMPRESSION=PASS
STAGE18_POSTGRESQL_NETWORK_CONNECTIONS=0
STAGE18_PRODUCTION_DB_SQL_WRITES=0
STAGE18_LIVE_3098_CHANGED=false
STAGE18_STAGE18A_ARCHIVE_MANIFEST=PASS
```

Stage18A is **PASS**. 132 explicit `INDEX` archive objects vs 288 indexed objects in catalog is expected because primary/unique constraint index objects are represented under constraints, not all as independently created indexes.

## Stage18B experimental isolated restoration script — committed, VPS execution pending

Added `scripts/stage18/run_pg17_schema_restore_offline_sandbox.sh`. It:

1. Refuses execution unless root, the previously used `betvima-stage5-pg` reference container is confirmed `--network none`, an already cached Postgres image is available, and the exact archive private path, permissions and SHA256 match the Stage17/18A output. Does **not** create a new paid server/project or pull a network image.
2. Creates a **new disposable Podman container** with `--network none`, no published TCP ports, a private UNIX socket, memory/CPU/pid limits, PostgreSQL major version 17, and a new empty local database `stage18_sandbox`. Verifies both network and ports.
3. Copies **only the already verified schema-only dump** into that container; no source PostgreSQL URI, production credentials, real users, transactions or KYC data passed.
4. Attempts exact `pg_restore --exit-on-error --single-transaction --schema-only --no-owner --no-privileges` into **only** that disposable local database with max execution time. SQL remains inside container; errors are written privately and only **enumerated dependency categories** are exposed.
5. If restore succeeds, checks 97 NOVA base tables, 96 routines, 45 triggers, 87 RLS policies, 91 RLS-enabled tables. If it fails, reports a dependency bucket such as `MANAGED_SUPABASE_AUTH_SCHEMA` or `MANAGED_SUPABASE_EXTENSIONS`, **NOT** a passed full clone.
6. Always deletes the entire transient Podman container, temporary socket and error log. **No production database connections or changes, no port 3098 changes**.

Known caveat: this is a **baseline compatibility experiment**, *not* proof that full Supabase-managed Auth/RLS/extensions functionality or eligibility is identical. The archive excludes managed auth/storage schemas; one NOVA FK refers to auth, and extension schemas/functions may not exist in a bare PostgreSQL image. Do not fabricate auth.users or alter production controls to bypass errors.

Script was committed, not yet executed on the owner VPS. Stage18B only passes upon actual owner output `STAGE18B_OFFLINE_RESTORE_EXPERIMENT=PASS`, and **FULL_SUPABASE_SECURITY_PARITY still requires independent checks**. Local syntax check is included in operator command (`bash -n`). Existing old casino unchanged; PR stays DRAFT.

## Stage18B operator first attempt — PostgreSQL 17 image/version gate blocked safely

On 2026-10-31, user ran initial `run_pg17_schema_restore_offline_sandbox.sh` on VPS. Actual output:

```text
STAGE18B_CONTAINER_NETWORK=NONE
STAGE18B_PUBLIC_PORTS=0
STAGE18B_TARGET=THROWAWAY_LOCAL_POSTGRES
STAGE18B_ABORT=POSTGRES17_REQUIRED
STAGE18B_TEMP_CONTAINER_REMOVED=true
STAGE18B_LIVE_3098_CHANGED=false
```

The existing reference image came from old `betvima-stage5-pg` container and was NOT previously verified to be Postgres 17. The original script also ran a `podman exec ... postgres -V` check immediately after starting a new container **before readiness**, so the failure could be from an **older cached image or a startup race**. **Do not assert which without source server version evidence.** This error occurs before the archive was copied, and no restore was performed.

New v2 script `scripts/stage18/run_pg17_schema_restore_offline_sandbox_v2.sh`:

1. Checks the locally cached reference image version via throwaway network-none `podman run --rm --pull=never --entrypoint postgres <image> -V` (no database boot).
2. If the reference image is not proven PG17, selects the official Docker Hub `docker.io/library/postgres:17.11-bookworm`, pulls only this official image into local Podman cache if missing (no archive/DB credentials involved), and independently checks the exact executable version before any schema archive is copied. Official tag verified at https://hub.docker.com/_/postgres/tags .
3. New Postgres sandbox is still `--network none`, `--pull=never`, no published TCP ports, separate transient UNIX socket. It waits for `pg_isready` to confirm startup **before** checking running `postgres -V`, preventing race-based false `POSTGRES17_REQUIRED`.
4. Keeps exact archive SHA256 and protected path guard, bounded memory/CPU/timeout, local `pg_restore --single-transaction --schema-only`, only synthesized local DB and automatic container/temporary file removal. No production SQL read/writes and absolutely no changes to live 3098 or user, wallet, age, KYC, geo, payments.
5. Full Supabase dependencies (managed `auth`, extensions, roles and policies) may still block a plain Postgres restore. This is accurately reported as `BASELINE_RESTORE=BLOCKED`, not falsely as a complete new casino.
6. v2 is committed to DRAFT PR; user must run and report outcome. Operator Bash syntax check is included in the supplied command.

**Stage18B remains NOT VERIFIED**, while Stage18A archive integrity remains PASS. There is no reason to alter the original private schema backup.
