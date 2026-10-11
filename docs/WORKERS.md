# Workers

Four independent processes, one shared runtime (`src/workers/runtime.ts`), one durable queue
(`nova.job_queue`) plus the settlement-specific queue (`nova.settlement_jobs`).

| Worker | Queue | Cadence (env) | Job kinds | What it does |
| --- | --- | --- | --- | --- |
| Odds | `odds` | `ODDS_SYNC_INTERVAL_SECONDS` (default 30 s) | `odds.sync`, `odds.publish` | Pulls provider odds, validates freshness/anomalies, publishes ticks (`nova.publish_odds_tick`), suspends stale selections |
| Settlement | `settlement` | `SETTLEMENT_SCAN_INTERVAL_SECONDS` (default 60 s) | `settlement.settle_bet`, `settlement.regrade` | Consumes `nova.settlement_jobs`, grades legs, settles atomically, requests regrades; `manual_review` for held bets |
| Affiliate | `affiliate` | `AFFILIATE_SETTLEMENT_CRON` / daily tick | `affiliate.settle_period`, `affiliate.recalc` | Friday settlement windows, commission computation, payout creation, fraud signal refresh |
| Notification | `notification` | `NOTIFICATION_INTERVAL_SECONDS` | `notification.send`, `notification.retry` | Delivers queued notifications through the configured channel; without a provider it records `NOT_CONFIGURED` and retries later instead of failing silently |

## Runtime guarantees

* **Atomic claiming.** `nova.claim_jobs(p_queue, p_worker_id, p_limit, p_lock_ttl_seconds, p_kinds)`
  uses `for update skip locked` and filters by kind inside the same statement (migration `0140`), so
  two workers can never process the same job and a worker never claims a kind it cannot handle.
* **Leases and recovery.** Claims carry a lock TTL; a crashed worker's jobs become claimable again
  and are picked up by the sweep, and `nova.find_stuck_bets(limit)` recovers bets that were left
  unsent when a process died mid-settlement.
* **Retries.** Failures are retried with exponential backoff
  (`WORKER_BACKOFF_BASE_MS`, `WORKER_MAX_ATTEMPTS`); exhausted jobs move to `dead_letter` and are
  visible in `/admin/jobs` with retry/cancel actions.
* **Idempotency.** Handlers are safe to re-run: settlement and commission writes go through
  idempotent SQL functions keyed by bet/settlement/period, so a redelivered job cannot double-pay.
* **Heartbeats.** Each worker upserts `nova.worker_heartbeats` (worker id, queue, status, counters,
  hostname, version, metadata). `/api/health` and `/admin/workers` report `dead` when a heartbeat is
  older than `WORKER_HEARTBEAT_STALE_SECONDS` (60) — staleness is never hidden.
* **Distributed locks.** Periodic sweeps take an advisory lock (`nova.acquire_worker_lock`) so that a
  scheduled tick runs once across the whole fleet, not once per replica.
* **Graceful shutdown.** SIGTERM/SIGINT finish the in-flight job, release the lock and exit 0, which
  makes PM2/systemd restarts and deploys safe.
* **Run-once mode.** `NOVA_WORKER_ONCE=true` runs one tick, drains the queue and exits — used by
  `scripts/workers-smoke.sh`, cron deployments (`deploy/pm2/README.md`) and CI.

## Running

```bash
# long-running (PM2, systemd, Kubernetes)
npm run worker:settlement

# one-shot (cron, CI, smoke test) - exits 0 when the tick and drain succeed
NOVA_WORKER_ONCE=true npm run worker:affiliate
```

`scripts/workers-smoke.sh` runs all four entry points in one-shot mode against the configured
database and fails if any of them exits non-zero, so a broken worker cannot reach production
unnoticed.
