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

## Stage17 operator second pg_dump attempt — client compatible, root failure unclassified (2026-10-30 ~22:51 UTC)

Operator output:
- `/usr/lib/postgresql/17/bin/pg_dump --version` = **17.11**; `/usr/bin/pg_dump` = **17.11**. Direct Supabase project version previously verified 17.6. **Client/server major mismatch ruled out**.
- `STAGE17_SELECTED_PG_DUMP_CLIENT_MAJOR=17`, `STAGE17_ABORT=PG_DUMP_UNKNOWN_REDACTED`. Since v2 intentionally did not log raw `pg_dump` stderr, this classification cannot identify whether the failure came from the pooler (startup parameters), auth/TLS, source read permissions, SQL, or the subprocess itself. Do not claim schema archived.
- No archive success marker, no production writes or restart. This is **two failed pg_dump attempts**, so run a **read-only connection-only diagnostic first** rather than immediately retrying the same dump command.

### Stage17 v3 diagnosed-safe probe prepared, not yet operator executed
Committed `scripts/stage17/create_private_nova_schema_only_archive_v3.cjs`, JS syntax parsed:
1. `STAGE17_PROBE_ONLY=1 node ...` selects the pinned production connection from the current 3098 process (same strict project ref check), then runs a single `psql --no-psqlrc -At -c 'SELECT 1'` under the same 12-second timeout, read-only `PGOPTIONS`, and prints **only success or sanitized failure category**. No pg_dump, archive, DDL, provider or customer records.
2. If probe succeeds, separately run the normal v3 archive. On failure, v3 prints pg_dump numeric exit status, signal enum, stderr length *band*, SHA256 prefix, sanitized category and a **single** same-target `SELECT 1` read-only connection probe. Raw stderr, host, user, DSN, password and source SQL are **never logged**. No credential files committed to GitHub.
3. Existing archiver guards unchanged: PostgreSQL 17+ pg_dump/pg_restore pair, read-only transaction with bounded lock wait, `-Fc --schema-only -n nova` into private root 0700 directory/0600 file, no table data TOC, count exactly 97 NOVA tables, cleanup after failed archive. No package installs or modifications to port 3098.

**Do not use `pg_restore` against production, rebase/reset existing Irish branch, bypass KYC/geo/age controls, or claim that standalone PostgreSQL can reproduce Supabase auth/RLS/extensions without a managed compatible baseline.**

## Stage17 operator third attempt — transaction pooler identified (2026-10-30 ~22:55 UTC)

Operator ran v3 in `STAGE17_PROBE_ONLY=1` mode. Exact redacted output:
- `STAGE17_SELECTED_PG_DUMP_CLIENT_MAJOR=17`
- `STAGE17_DATABASE_ROUTE_CLASS=POOLER`
- `STAGE17_DATABASE_PORT_CLASS=TRANSACTION_POOLER`
- `STAGE17_READONLY_CONNECT_PROBE=FAIL`
- `STAGE17_READONLY_CONNECT_PROBE_CATEGORY=ERROR_UNCATEGORIZED`
- `STAGE17_ABORT=READONLY_CONNECT_PROBE_FAILED`

Thus the system had been attempting native `pg_dump` over Supabase **transaction-pooling port 6543**. Major-version mismatch is ruled out (`pg_dump 17.11` vs production server 17.6). The failure likely involves connection routing or unsupported startup settings, but the sanitized error does **not** prove which parameter failed. Do not modify persistent production 3098 `DATABASE_URL` or process environment to fix a backup tool.

Supabase official documentation recommends **direct connection for `pg_dump`** and states **session pooler 5432** is appropriate for persistent clients, whereas transaction mode 6543 lacks per-session behavior. Source: https://supabase.com/docs/guides/database/connecting-to-postgres . Direct PostgreSQL endpoint may be IPv6-only, so the tool first tests a safe same-host session pooler route rather than inventing any new hostname/project/user/database.

### Safe v4 archiver — source committed, VPS run NOT YET VERIFIED
`scripts/stage17/create_private_nova_schema_only_archive_v4.cjs`:

1. Reads existing 3098 live DB settings in a temporary root-owned process; validates pinned original Supabase **production** project ref; **never writes these settings back**.
2. Requires the existing endpoint to be a pooler on port **6543**. Only derives **same hostname / same username / same database**, changing **the child process's port to 5432** for a Supabase **session pooler**. No other route is attempted.
3. Makes a bounded, `-w` noninteractive, `SELECT 1` read-only probe on 5432 with existing `PGOPTIONS`. If that fails, retries `SELECT 1` with **PGOPTIONS omitted only in the temporary child process**. Fails closed if both fail and prints only categorized failure codes; no raw stderr/host/login secrets.
4. `STAGE17_PROBE_ONLY=1` stops after probe (no pg_dump). When the probe succeeds, the normal invocation attempts the exact same session route to export `pg_dump -Fc --schema-only -n nova`; no customer rows, no auth/storage dump, no migration, no writes to production DB.
5. Verifies private 0700 directory, 0600 file, `pg_restore --list` contains no data records and exactly 97 NOVA table definitions. Deletes any failed partial archive. Source JS syntax checked but **not operator-executed** at time of commit.
6. If the session route fails, do not brute-force credentials/ports or install a new database server; inspect specific sanitized failure and select supported safe alternative with explicit scope.

**DO NOT declare Stage17 archive successful until real operator stdout prints `STAGE17_SCHEMA_ONLY_ARCHIVE=PASS`.** Existing production registration, geo, age, KYC, deposit, withdrawal and 3098 remain unchanged.

## Stage17 fourth operator attempt: 5432 Session Pooler could not complete SELECT 1

Operator executed v4 in `STAGE17_PROBE_ONLY=1` mode, providing:
- Original active database URL resolves to same Supabase project Transaction Pooler 6543.
- `SESSION_PROBE_SERVER_READONLY_STARTUP=FAIL`, sanitized `ERROR_UNCATEGORIZED`.
- `SESSION_PROBE_NO_STARTUP_OPTIONS=FAIL`, sanitized `ERROR_UNCATEGORIZED`.
- `STAGE17_ABORT=NO_WORKING_SESSION_POOLER_ROUTE`.

Both candidate child connections failed, even without PGOPTIONS. **No schema archive created, no dump or server code changes attempted.** The failure does **not** establish credential or networking cause; stderr was deliberately redacted. Root cause investigation should NOT re-run equivalent `pg_dump` or alter the live site's pooler credentials.

Production Supabase `supavisor_logs` inspected read-only for 2026-10-30 22:55–23:05 UTC: many normal, successful transaction-mode app connections; no session-mode connection observed from that known VPS IP in queried window. Absence of logged session authentication is consistent with but **does not prove** connection routing failure.

New GitHub-only diagnostic: `scripts/stage17/probe_pooler_network_and_sql_readonly.cjs`:
- Uses exactly the v4 validated original database hostname/user/database from the active 3098 process, without writing or revealing secrets; never derives an alternative hostname and does NOT change production configuration.
- Performs only DNS family flags (IPv4/IPv6), bounded TCP socket checks on the existing 6543 and same-host 5432, then at most 3 `SELECT 1` calls via installed psql 17; one of them checks whether optional read-only startup PGOPTIONS are accepted. Never performs any `pg_dump`, dump extraction, migrations, data reads or writes.
- Prints sanitized network classifications and SQL error categories. Does NOT print host, IP, user, password, PostgreSQL stdout beyond validated literal `1`, or raw stderr. Version and environment are validated before network probes.
- Script was checked for JavaScript syntax and committed only to draft PR, **not yet executed on VPS**. Do not report that network connectivity or schema snapshot succeeded until operator runs it.
- If both ports' TCP probes fail, investigate VPS outbound/network egress/DNS. If both TCP connect but psql fails, investigate independently the SQL auth/startup protocol and configuration. If 6543 `SELECT 1` passes but 5432 fails, determine availability of same-host session pooler or a supported direct (IPv6) endpoint rather than editing the active application's transaction URI.

Official Supabase guidance for `pg_dump`: https://supabase.com/docs/guides/database/connecting-to-postgres (direct preferred, session pooler for session-bound clients).

## Stage17 operator TCP vs libpq results — both TCP ports PASS, SQL labeled TLS_ERROR

Operator ran `scripts/stage17/probe_pooler_network_and_sql_readonly.cjs` on VPS. Verified (only benign metadata output):

```text
STAGE17_NET_DNS_IPV4_PRESENT=true
STAGE17_NET_DNS_IPV6_PRESENT=false
STAGE17_NET_TRANSACTION_6543_TCP=PASS
STAGE17_NET_SESSION_5432_TCP=PASS
STAGE17_NET_TRANSACTION_6543_SELECT1=FAIL
STAGE17_NET_TRANSACTION_6543_ERROR_CATEGORY=TLS_ERROR
STAGE17_NET_SESSION_5432_SELECT1=FAIL
STAGE17_NET_SESSION_5432_ERROR_CATEGORY=TLS_ERROR
STAGE17_NET_DB_SQL_WRITES=0
STAGE17_NET_LIVE_3098_CHANGED=false
STAGE17_NET_DIAGNOSTIC_FINISHED=true
```

- **Network port blocking for 6543/5432 is ruled out**: both accept TCP. No proof that the PostgreSQL SSLRequest or TLS negotiation completed. The previous broad `TLS_ERROR` classifier matches any libpq stderr including 'SSL SYSCALL error' or early EOF, so it cannot distinguish TLS certificate validation from early connection closure, unsupported SSL, or protocol error. Do **not** change production SSL enforcement or disable certificate verification. Do not rotate production credentials from these results.
- Separate read-only Supavisor logs for 2026-10-30 22:51–23:20 UTC had normal authenticated transaction-mode service connections, **no app-name-marked operator probes or session-mode records** in the queried interval; not enough to identify the failure point.
- Supabase documentation: `pg_dump` prefers direct connection for PostgreSQL native commands, or Session pooler for session-bound operations. TLS trust and certificate validation procedures are documented at https://supabase.com/docs/guides/database/psql and https://supabase.com/docs/guides/platform/ssl-enforcement .

### Safer Stage17 network diagnosis — created and syntax-checked, not yet VPS-executed
`scripts/stage17/probe_pooler_tls_handshake_readonly.cjs` distinguishes PostgreSQL protocol SSLRequest acceptance (`S` versus `N`), Node TLS handshake with **certificate validation enabled**, and specific classified libpq failures on same-host ports 6543 and 5432. At most one authenticated SELECT 1 per route, no data rows other than literal 1, no pg_dump, no migrations, no writable DB calls. It outputs only enums, negotiated TLS protocol name, and presence/absence of the default libpq root CA file; never raw stderr, usernames, host/IP, DSN, password, or certificate identity. Does **NOT** alter production SSL settings or Node process. No operator results yet; do not mark Stage17 archive as completed.

**Stage17 schema archive still PENDING.** All old casino behaviour (geo, age, KYC, deposits/withdrawals, registration, wallets) and port 3098 remain unchanged.

## Stage17 TLS certificate root cause and safe v5 recovery

Operator ran pinned TLS diagnostics: both Supavisor ports accept PostgreSQL SSLRequest (`S`) but fail certificate validation in Node's verified handshake; v3 reported:
```text
STAGE17_TLS_LIBPQ_DEFAULT_ROOT_CERT_PRESENT=false
STAGE17_TLS_LIBPQ_SSLMODE_CLASS=VERIFY-FULL
STAGE17_TLS_TRANSACTION_6543_SSL_REQUEST=S
STAGE17_TLS_TRANSACTION_6543_TLS_HANDSHAKE=CERTIFICATE_VALIDATION
STAGE17_TLS_SESSION_5432_SSL_REQUEST=S
STAGE17_TLS_SESSION_5432_TLS_HANDSHAKE=CERTIFICATE_VALIDATION
STAGE17_TLS_PRODUCTION_SQL_WRITES=0
STAGE17_TLS_LIVE_3098_CHANGED=false
```
No local `/root/.postgresql/root.crt` was found. **Root cause strongly points to missing/unpropagated trusted CA**. Existing Stage17 v1–v4 code parsed `sslmode` from the active production URI but **discarded `sslrootcert` URI parameter** when transferring to child `pg_dump/psql` subprocesses; do not blame the database service or alter live server SSL configuration. No certificate content or production connection secrets were requested or revealed.

Added **`scripts/stage17/create_private_nova_schema_only_archive_v5.cjs`** (JS syntax parsed, NOT yet operator-run):
- Child-only `PGSSLMODE=verify-full`, and `PGSSLROOTCERT` from explicit `STAGE17_CA_PATH`, original URL's `sslrootcert` parameter, active process `PGSSLROOTCERT`, or a private `/root/betvima-stage5/supabase-prod-ca.crt` file. If none exists, fallback **only to PostgreSQL 17 system CA trust store (`sslrootcert=system`), still with full certificate and hostname validation**, never to SSL `require`, `prefer` or `disable`.
- Child probes pinned same-host Session Pooler port 5432 with a harmless SELECT 1, including alternate test without PGOPTIONS (but **never** without CA validation). Fails closed if neither verifies. No live process env updates, zero production DB writes, no provider callbacks or user data reads.
- Once probe passes, optional invocation exports **schema-only custom archive** to root-private 0700 directory, 0600 file, verifies no TABLE DATA and exactly 97 NOVA tables in TOC, and deletes unsuccessful partial backup. Do **not** upload archive containing proprietary function definitions to GitHub/chat.
- If `sslrootcert=system` is not trusted, obtain the authentic **project-specific CA certificate** from the authenticated [Supabase Dashboard → Database → Settings → SSL Configuration → Download Certificate](https://supabase.com/dashboard/project/mqygiufkubxxxjodsycu/database/settings), privately transfer the certificate to `/root/betvima-stage5/supabase-prod-ca.crt` and rerun v5 with `STAGE17_CA_PATH=/root/betvima-stage5/supabase-prod-ca.crt`. Never fetch trust anchors from the unverified database TLS endpoint and never disable verification or rotate production credentials to work around diagnostic failure.
- Docs: https://supabase.com/docs/guides/database/psql and https://www.postgresql.org/docs/17/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT

**Verified Stage17 schema archive: STILL PENDING user-side v5 output.** Neither new Supabase development branch nor new VPS needed at present; existing Irish branch remains isolated.
