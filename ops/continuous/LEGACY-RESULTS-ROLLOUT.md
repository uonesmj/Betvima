# FiveDollar legacy results: isolated, fail-closed rollout

Scope: **historical matches already stored with `nova.matches.provider = '5dollarfootballapi'`** that have accepted or partially settled bets. This feature never makes FiveDollar an odds or new-fixture source.

## Current production vs. GitHub

- The existing Odds API bulk worker is configured with `SPORTS_PROVIDER=the_odds_api`, `ODDS_WORKER_MODE=bulk`, and an empty `FIVEDOLLAR_API_KEY`. **Do not alter that process's FiveDollar setting.**
- GitHub production publication in `ops/continuous/production.py` is deliberately **web-only**; it does not deploy, restart or configure workers. A merged change or PM2 save does not install the new results-only worker or update existing workers.
- New code is isolated behind `ODDS_WORKER_MODE=legacy-results`; bulk and live modes do not run in that process. This mode claims no queued odds jobs, does not fetch odds, and does not insert new fixture/catalog records.
- The results-only worker defaults to **audit mode**, even when started. It records legacy pending-bet counts by match status and does not call the provider or modify scores, wallets or settlement queues. Audit mode needs no FiveDollar API key.

## Before write enablement

1. Deploy the reviewed and tested release to an immutable worker directory without changing production web/odds/settlement processes. Never use a mismatched `odds.worker.ts` or unverified credentials.
2. Start *one* dedicated `worker:legacy-results` process with `ODDS_WORKER_MODE=legacy-results` and `LEGACY_RESULTS_WRITE_ENABLED` absent/false. Inspect `LEGACY_RESULTS_AUDIT_ONLY` counts, existing authoritative results, old-VPS ownership, and pending bet statuses using read-only queries.
3. Check provider account access and result integrity against representative historical fixtures, including scores/fixture IDs; missing scores must remain null rather than being silently treated as 0-0.
4. Confirm no overlapping old FiveDollar results worker is running and that the existing financial settlement controls and queue semantics are healthy. Only after an explicit operator approval, supply a FiveDollar key to **this process only** and set `LEGACY_RESULTS_WRITE_ENABLED=true`. Keep `FIVEDOLLAR_API_KEY` blank in the Odds API worker.
5. Process a limited set and reconcile actual final scores, duplicate/final ownership conflicts, resulting settlement jobs and wallet ledger entries before widening the lookback.

## Design boundaries

- The query reads existing canonical FiveDollar-owned match IDs **only** when an accepted/partially settled bet refers to them, scheduled within the last 365 days (configurable downward via `LEGACY_RESULTS_LOOKBACK_DAYS`), and without an existing authoritative finished result.
- The worker requests results within one UTC kickoff day per cycle, rotates through outstanding days and caps each cycle to 50 known match IDs. Missing provider snapshots are **not** evidence of finality; unmatched results cannot create a fixture.
- Finished results must be authoritative with whole-number home and away scores. Existing authority conflicts and changed final scores require manual review; the established `enqueue_match_settlement` mechanism is used for safe eligible finals.
- One legacy worker may coexist with the current Odds API bulk worker, but its result authority covers only canonical FiveDollar matches. Cross-provider alias mappings do not permit overwriting an Odds-owned final result.
- The dedicated worker has no job handlers and uses a distinct `legacy-results:reconcile` lease.

**Not included:** restoring old 5Dollar live markets, creating new 5Dollar fixtures, enabling casino/payments/payouts, changing users' balances or automatically modifying the installed privileged deployment controller.
