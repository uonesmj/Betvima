# Sports worker takeover gate

Read-only production observations on 2026-10-11 UTC:

- `server1.betvima.com` / `159.198.76.199` has web processes, but no running odds worker. The root PM2 dump describes old workers; it is not live process state. Do not resurrect that dump: it also contains payment, payout and settlement workers.
- `odds-1772452-0dekje`, recorded on `srv9758854928`, continues to update its heartbeat and holds `odds:tick` / `odds:maintenance`. Its PID is absent on the current server. Supabase's connection pool reports its own upstream address, so `pg_stat_activity` does not reveal the worker's originating IP. The recorded hostname alone cannot identify an SSH destination reliably.
- The local `odds-live` heartbeat and its priority lock have been stale since approximately 02:49 UTC. Live selections are stale/suspended.
- GET-only provider probes succeeded: FiveDollar returned 42 live football fixtures and six open markets for one sampled fixture; Odds API returned no live football fixtures at that instant. This does not authorize borrowing FiveDollar prices for an Odds-owned match.

Activation must wait until the active remote sports worker is identified and its ownership is resolved. A new bulk worker must not be started alongside the unknown worker. No lock rows or heartbeat records should be deleted to manufacture availability.

## Prepared topology

1. Keep the current web release, financial workers, original APK and emergency access unchanged.
2. Locate the active host through the hosting inventory/SSH, inspect its sports-only process definitions and source revision, and stop only the superseded sports processes after recording their rollback commands. Confirm their heartbeats stop and their sports leases expire naturally.
3. Use an immutable, tested release on the current host. Start one `ODDS_WORKER_MODE=live` process first under a dedicated account and PM2/systemd definition, without payment/notification credentials. Live mode imports no financial worker and does not perform bulk result reconciliation. Never restore the historical root PM2 dump.
4. Validate current provider-owned fixture discovery, attached cross-provider identities, FiveDollar events, fresh source quotes and suspension reasons using read-only queries. Confirm only the intended sports process owns the live-priority lease. A genuine source suspension or missing owner quote must remain unavailable.
5. Review bulk takeover separately: bulk result reconciliation can enqueue settlement for real matches. Do not activate it as a harmless quote-only test or alter financial workers implicitly.
6. If checks fail, stop only the new sports process and reinstate the previously recorded sports definition. Do not roll back financial data or reopen stale selections.

The runtime regression tests now prevent tick-only live workers from claiming arbitrary queued jobs. Heartbeats now report the OS hostname and actual PID, and refresh hostname/version on conflict; inherited or copied `HOSTNAME` values cannot misidentify a newly deployed worker.

No worker takeover, production migration, financial action or production traffic switch was performed while preparing this plan.
