# Operations

All scripts live in `scripts/` (build-time, CI) and `ops/` (runtime), are POSIX `bash`, pass
`bash -n`, and print a single-line verdict with a non-zero exit code on failure so cron/monitoring
can alert on them.

## Daily / continuous

| Need | Command | Behaviour |
| --- | --- | --- |
| Liveness + readiness + ledger + workers | `bash ops/health-watch.sh` | Prints one line: `ok` / `degraded` / `down` with reasons; exits 1 unless `ok`. Suitable for cron every minute + alerting. |
| Deep health over HTTP | `curl -fsS "$SITE/api/health"` | Full dependency report; `/api/health/ready` returns 503 while production configuration is incomplete. |
| Metrics | `curl -fsS -H "x-health-token: $HEALTH_DEEP_CHECK_TOKEN" "$SITE/api/metrics"` | Prometheus text format. |
| Provider state | `/admin/providers` | Configured/reachable/required-env for each provider. |

## Backups

```bash
SUPABASE_DB_URL=... BACKUP_DIR=/var/backups/nova bash ops/backup.sh
```

* `pg_dump --format=custom` + `pg_restore --list` verification (a dump that cannot be listed is
  treated as failed).
* A manifest is written next to the dump: timestamp, git revision, build id, migration count,
  wallet/ledger checksums, and the archive `sha256`.
* Retention is 72 files by default; old dumps are pruned only after a successful new backup.

## Restore drills

```bash
SUPABASE_DB_URL=... bash ops/restore-test.sh
```

Restores the newest dump into a scratch database (`nova_restore_test`), runs `scripts/db-verify.sh`
against it, compares live-vs-restored profile/bet/wallet/ledger/affiliate totals, then drops the
scratch database. A restore that does not reproduce the totals fails loudly. Run it after any
migration batch and at least monthly in production.

## Rollback

```bash
RELEASE_TAG=2026-09-01-1200 SUPABASE_DB_URL=... bash ops/rollback.sh
```

1. Refuses to roll the code back when the database has migrations the target release does not know
   about (rolling back code against a newer schema is how financial systems break).
2. Checks out the target ref, reinstalls dependencies, runs `scripts/db-verify.sh`.
3. `pm2 reload nova-web` (zero-downtime), restarts workers, runs the secret scan and the worker
   smoke test.

## Incident playbook

| Symptom | First action |
| --- | --- |
| Wrong result settled | `/admin/bets/[id]` → regrade (reverses, then re-settles; both revisions stay in `bet_settlements`) |
| Provider feeding bad odds | `/admin/operations` → disable the odds sync, suspend affected markets in `/admin/matches/[id]` |
| Payments misbehaving | `/admin/operations` → switch off `DEPOSITS`/`WITHDRAWALS`; payments fail closed; review intents in `/admin/payments` |
| Ledger alarm | `/admin/reconciliation` → run checks; `bash ops/health-watch.sh`; never edit ledger rows — post a reversal instead |
| Affiliate dispute | `/admin/affiliates/[id]` → ledger + settlements + suppressed amounts are all visible with reasons |
| Worker backlog | `/admin/workers` + `/admin/jobs` → retry/cancel; scale out by starting more worker processes (advisory locks prevent double ticks) |
| Suspected compromise | rotate `SUPABASE_SERVICE_ROLE_KEY` and provider keys, `/admin/audit` for the affected window, `scripts/scan-service-role-exposure.sh` before redeploying |

## Routine maintenance

* Weekly: `ops/restore-test.sh`, review `/admin/reconciliation` history, review dead-letter jobs.
* Monthly: rotate provider/API credentials, review admin accounts in `/admin/roles` + `nova.profiles`,
  confirm the audit log is append-only, re-run the full test suite against a restored copy.
* Per deploy: `scripts/preflight-production.sh`, `scripts/db-migrate.sh`, `scripts/db-verify.sh`,
  `scripts/workers-smoke.sh`, secret scan.
