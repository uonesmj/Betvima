# PM2 process layout

| Process | Instances | Purpose |
| --- | --- | --- |
| `nova-web` | 2 (cluster) | Next.js server: pages, API routes, server actions |
| `nova-worker-odds` | 1 | Provider odds/match sync, freshness, anomaly rejection |
| `nova-worker-settlement` | 1 | Result sweep, bet settlement, regrade |
| `nova-worker-affiliate` | 1 | Commission accrual, Friday period settlement, payouts |
| `nova-worker-notification` | 1 | Notification outbox delivery (in-app + configured channels) |

Workers are single-instance on purpose. The queue itself is safe for many workers
(`for update skip locked`), but a single odds sync and a single settlement sweep per cycle is
what the provider budget and the audit trail expect. Scale by queue, not by candidate kind.

## Commands

```bash
pm2 start deploy/pm2/ecosystem.config.cjs --env production
pm2 logs nova-worker-settlement --lines 100
pm2 reload nova-web            # zero-downtime reload (workers keep running)
pm2 restart nova-worker-odds
pm2 save
```

## Cron-style alternative

If you prefer cron over long-running workers (or want a safety net in addition to them),
run the shipped one-shot mode instead:

```bash
# every minute: settle anything due, then exit (exit code 1 if a job failed)
* * * * * cd /srv/nova-sportsbook && NOVA_WORKER_ONCE=true SUPABASE_DB_URL="$SUPABASE_DB_URL" \
  /usr/bin/node --import tsx src/workers/entrypoints/settlement.worker.ts >> /var/log/nova/settlement-cron.log 2>&1

# daily at 00:15: settlement + affiliate + notification sweep
15 0 * * * cd /srv/nova-sportsbook && bash scripts/workers-smoke.sh >> /var/log/nova/workers-daily.log 2>&1
```

One-shot mode runs the periodic tick, drains the claimable queue and exits, so a cron job can
never overlap with a long-running worker: the queue is claimed atomically either way.
