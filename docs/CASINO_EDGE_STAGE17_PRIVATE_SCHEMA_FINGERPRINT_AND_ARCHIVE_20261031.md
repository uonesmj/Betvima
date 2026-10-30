# BetVima Stage17 — private schema-only production baseline preflight (2026-10-31)

## Scope and verification status
**Stage17 metadata audit COMPLETE and verified via read-only Supabase SQL.** A guarded script for *privately collecting* a schema-only custom archive on the owner's VPS has been committed, with JavaScript syntax parsed, but **NOT yet executed on the VPS**. No production DDL, wallet changes, login/auth, deposits, withdrawals, geo, age or KYC edits; no code deployed and live 3098 unchanged.

### Structural snapshots (read-only catalog queries)
| NOVA metadata | Production `mqygiufkubxxxjodsycu` | Ireland synthetic-only preview `qrirgzvxpjhhwvyazvpn` |
|---|---:|---:|
| base tables | 97 | 23 |
| columns | 1191 | 261 |
| indexes | 288 | 67 |
| routines | 96 | 24 |
| custom noninternal triggers | 45 | 13 |
| tables with RLS active | 91 | 3 |
| RLS policies | 87 | 0 |
| SECURITY DEFINER routines | 67 | 4 |
| foreign-key dependencies on `auth` schema | 1 | 1 |
| selected installed extensions | 5 | 5 |

Read-only schema fingerprints computed in SQL, not function bodies/actual user records:
- Production columns `0597777574adc0e68ae660ad37a5ee27`, routine signature `9b976d56a162530b91276331ea15009a`, triggers `f754ab72cac004662f042731ff88d921`, indexes `1435b391a655cc57af0395f1101cc6c2`.
- Ireland columns `4534e4359cfc3780ce14c3a873f44f6f`, routine signature `24fca80133ba290dca4c029327df1b4a`, triggers `0dcc660095203b80a649b903859d0bae`, indexes `66ba09f7cf6dbc0e67f09e3e9b8fba8f`.

Audited SQL committed to `scripts/stage17/nova_schema_metadata_fingerprints_readonly.sql`; it was executed against both projects with the outputs above.

### Private archiver written, NOT operator-executed
`scripts/stage17/create_private_nova_schema_only_archive.cjs`:

1. Requires root in VPS, existing exact 3098 release directory, exact live listening PID discovered by `ss`, and a production `SUPABASE_DB_URL`/`DATABASE_URL` whose host or username contains the **explicit production ref**. Fails closed if ambiguous, no credentials, or missing `/usr/bin/pg_dump` and `pg_restore`. It does **not** ask for or display credentials.
2. Runs **only** `pg_dump --schema-only --schema=nova --format=custom --no-owner --no-privileges` against current production DB from a read-only session, with 2-second lock timeout, 120-second statement timeout, bounded process runtime. The dumped content includes no table data/rows, auth/storage schemas or wallet balances. It **can** still include sensitive proprietary SQL function source/literals; keep private.
3. Writes to new `/root/betvima-stage5/stage17-schema-only.XXXXXXXX/private-nova-schema-only.dump` (0700 directory, 0600 archive). **DO NOT upload the archive to GitHub, conversation, or public storage.**
4. Validates `pg_restore --list` has no `TABLE DATA`, `MATERIALIZED VIEW DATA`, `SEQUENCE SET` or `BLOBS` entries, exactly 97 NOVA `TABLE` entries. Prints archive SHA256 and private VPS path only. If any check fails the incomplete directory is deleted.
5. No production server restarts, no database migrations, no provider calls, no changes to source or environment configuration.
6. This archiver is preparatory, **not proof a plain PostgreSQL can restore a Supabase schema**. At least one NOVA FK depends on Supabase-managed `auth`; functions, RLS policies and installed extensions depend on managed Supabase roles/schemas. Offline restore needs a version-matched, trusted Supabase development baseline and separate security validation; never copy actual auth/KYC/customer data or invent dummy functions to bypass migration failures.

**Do not run `pg_restore` against production, even for testing.** Do not reset/rebase the billed Irish preview or alter Supabase migration history. Existing production's first managed patch `20261012160639` fails on fresh preview because its prerequisite legacy `nova.publish_odds_tick` function is absent. The correct fix is a complete declarative schema baseline for a separate test environment, not manually skipping/masking the failed patch.

### Next stage gate
Until the operator runs the archiver with `STAGE17_SCHEMA_ONLY_ARCHIVE=PASS`, the private schema snapshot is **NOT COMPLETED**. Afterward, test restore into a fresh *private/offline and Supabase-compatible* sandbox, verify all 97 tables, 96 routines, 45 triggers, 87 RLS policies, 67 privileged functions and exact function signatures; do not connect real funds/providers. Current synthetic branch remains only 23 tables and `MIGRATIONS_FAILED`.

Official Supabase troubleshooting: https://supabase.com/docs/guides/deployment/branching/troubleshooting and CLI dump notes https://supabase.com/docs/reference/cli/supabase-db-dump .

## Stage17 operator first archiver attempt failed closed (2026-10-30 22:21+ UTC)

Operator fetched `create_private_nova_schema_only_archive.cjs`, passed `node --check`, and the archiver reached `STAGE17_MODE=SCHEMA_ONLY_PRIVATE_BACKUP` before terminating with `STAGE17_ABORT=PG_DUMP_FAILED_OR_CLIENT_VERSION_MISMATCH`. No successful private archive was reported. The first version intentionally withheld all raw `pg_dump` stderr to avoid leaking connection strings; this error was therefore **not diagnostic enough to attribute the failure**.

Independent Supabase read-only SQL verified:
- Active **production** server PostgreSQL **17.6** (`server_version_num=170006`).
- Irish isolated preview PostgreSQL **17.11** (`server_version_num=170011`).

A `pg_dump` client older than 17 would refuse a PostgreSQL 17 server, a **credible but unconfirmed** explanation until operator checks VPS client version. The exact error might instead be SSL, connectivity, read privilege, startup PGOPTIONS or another issue.

Added `scripts/stage17/create_private_nova_schema_only_archive_v2.cjs`:
- Selects only an installed **matching pg_dump/pg_restore client pair with major >=17**, prioritizing `/usr/lib/postgresql/17/bin`, then 18/19, then `/usr/bin`. Reads version by the explicit `(PostgreSQL) 17.x` marker, not a packaging suffix.
- Does **not** install packages, alter production, or perform a migration/restore.
- Fails closed with `STAGE17_ABORT=POSTGRESQL_17_CLIENT_REQUIRED` and a list of **client major version numbers only** when incompatible. Other `pg_dump` errors are mapped to safe categories (AUTHENTICATION_REJECTED, CONNECTION_UNAVAILABLE, READ_PERMISSION_DENIED, QUERY_FAILED, etc.) without showing raw stderr or credentials.
- Retains pinned production project check, strict read-only `PGOPTIONS`, root-private 0700 directory and 0600 archive, zero data TOC test, exactly 97 expected NOVA tables, and cleanup of partial archive upon failure.
- Source syntax was parsed; **not run on operator VPS yet**.

Next: run v2. If no 17+ local client, the user can install only a compatible PostgreSQL CLIENT package after verifying package availability/repositories and system change policy; avoid blindly installing/upgrading database server/Ubuntu or touching live 3098. No remote schema archive is currently verified.
