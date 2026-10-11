# Deployment

## Prerequisites

* Node.js 20+, PostgreSQL 15+ (Supabase-compatible), Nginx, PM2 (or systemd).
* A Supabase project (or any Postgres) with the `auth` schema available for `auth.users`
  (the shipped `nova.profiles` references it). Purely-local deployments can run with direct
  Postgres credentials instead — the platform degrades the account area honestly if Supabase
  auth is not configured.
* A sports data provider and a payment provider are **optional for deployment** and required for
  those features (see [EXTERNAL_PROVIDERS.md](EXTERNAL_PROVIDERS.md)).

## Environment

Copy `.env.example` → `.env.local` (or provide real env vars in the process manager). It is grouped:

* **PUBLIC** (`NEXT_PUBLIC_*`) — site URL/name, locale, currency, display timezone, feature flags,
  Supabase URL + anon key. These ship to the browser; **no secret may ever be `NEXT_PUBLIC_`**.
* **SERVER_ONLY** — `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, provider keys and webhook
  secrets, `SESSION_SECRET`, dual-approval threshold, log level, metrics token.
* **WORKER_ONLY** — worker id/heartbeat/lock/backoff settings, sync intervals, settlement cron and
  timezone, reconciliation interval, reconciliation provider credentials.

The service-role key is read only on the server (`src/server/env.ts`) and never serialised into a
response; `scripts/scan-service-role-exposure.sh` fails the build if the literal appears anywhere in
browser code or in the built output.

## First deployment

```bash
git clone <repo> /srv/nova-sportsbook && cd /srv/nova-sportsbook
cp .env.example .env.local && $EDITOR .env.local      # fill in real values
npm ci
bash scripts/preflight-production.sh                  # 9 checks; non-zero exit aborts the deploy
bash scripts/db-migrate.sh                            # applies supabase/migrations in order
bash scripts/db-verify.sh                             # schema, RLS, ledger, invariants
npm run build
pm2 start deploy/pm2/ecosystem.config.cjs
bash scripts/workers-smoke.sh                         # one-shot run of all four workers
curl -fsS http://127.0.0.1:3000/api/health | jq .
```

Then put Nginx in front (`deploy/nginx/nova.conf`, see below) and set up cron:

```cron
* * * * *   bash /srv/nova-sportsbook/ops/health-watch.sh >> /var/log/nova/health.log 2>&1
15 3 * * *  BACKUP_DIR=/var/backups/nova SUPABASE_DB_URL="$SUPABASE_DB_URL" bash /srv/nova-sportsbook/ops/backup.sh
30 4 * * 0  SUPABASE_DB_URL="$SUPABASE_DB_URL" bash /srv/nova-sportsbook/ops/restore-test.sh
```

## Every subsequent deployment

```bash
git pull && npm ci
bash scripts/preflight-production.sh
bash scripts/db-migrate.sh --status                   # what is pending?
bash scripts/db-migrate.sh                            # apply (checksum drift fails the run)
bash scripts/db-verify.sh
npm run build
pm2 reload nova-web                                   # zero-downtime (cluster mode)
pm2 reload nova-odds nova-settlement nova-affiliate nova-notification
bash scripts/workers-smoke.sh
bash scripts/scan-service-role-exposure.sh
```

**Migrations are forward-only.** A migration that has already run is immutable: `db-migrate.sh`
stores a checksum per file and fails on drift instead of silently diverging. Financial history is
never rewritten by a migration — corrections are new migrations that reverse an effect compatibly.

## Nginx

`deploy/nginx/nova.conf` (with `snippets/nova-proxy.conf`) provides:

* TLS 1.2/1.3, HSTS, security headers, `server_tokens off`.
* gzip/br for text, `Cache-Control: public, immutable` for `/_next/static`.
* Rate-limit zones: `api` (20 r/s), `auth` (2 r/s), `payment` (1 r/s) with 429 responses.
* WebSocket upgrade for realtime odds.
* `/api/health` and `/api/metrics` restricted to loopback/RFC1918.
* Maintenance page fallback (`503` with `Retry-After`), dotfiles and `*.map` denied.

Set `client_max_body_size` and the proxy timeouts to match your KYC upload sizes; keep
`X-Forwarded-*` intact so the app can hash IPs (the app never logs raw IPs).

## PM2

`deploy/pm2/ecosystem.config.cjs` runs `nova-web` in **cluster mode with 2 instances** plus the four
workers as single-instance forks, each with its own log file, memory limit and graceful shutdown.
`deploy/pm2/README.md` documents the alternative: run the workers with `NOVA_WORKER_ONCE=true` from
cron instead of as daemons (useful on very small hosts).

## Rollback

```bash
RELEASE_TAG=<previous-tag> SUPABASE_DB_URL=... bash ops/rollback.sh
```

Code rolls back; schema does not (see [OPERATIONS.md](OPERATIONS.md)). If the database contains
migrations unknown to the target release, the script refuses and prints the migrations to inspect.

## Domain and hosting

The public host is **configuration, not code**: `NEXT_PUBLIC_SITE_URL` drives canonical URLs,
`sitemap.xml`, robots, PWA manifest and referral links. Nothing in the codebase hard-codes a domain
(`grep -R "melbet-ir" src` returns nothing; the production domain is set via env + Nginx `server_name`).
