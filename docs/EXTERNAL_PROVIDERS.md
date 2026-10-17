# External providers — what is required to switch each feature on

The sportsbook uses **The Odds API exclusively** for fixtures, results, live odds and all betting markets. No backup football odds/results vendor is registered. Missing upstream data is not replaced by stale odds. Financial history for legacy fixtures is retained only to preserve settlement and audit integrity.

## 1. Sports data + odds (The Odds API only)

Configure the web server and both odds workers with The Odds API credentials:

```sh
ODDS_API_KEY=<The Odds API key>
ODDS_API_BASE_URL=https://api.the-odds-api.com
ODDS_API_SPORT_KEYS=soccer_epl
ODDS_API_REGIONS=eu
ODDS_API_MARKETS=h2h,spreads,totals
SPORTS_ODDS_FRESHNESS_SECONDS=45
```

The older generic `SPORTS_PROVIDER_BASE_URL`/`SPORTS_PROVIDER_API_KEY` variables are accepted **only** as a compatibility alias when `SPORTS_PROVIDER=the_odds_api`; a retired provider is never instantiated. Prefer dedicated `ODDS_API_*` variables. Remove unused retired vendor keys from VPS secrets after confirming these variables are loaded by both workers.

* The Odds API supports only its actual bookmaker markets and fixture data; do not synthesize missing live minutes or odds.
* `/api/v1/live`, `/api/v1/matches` and mobile clients read the same authenticated first-party catalogue, restricted to `the_odds_api`.
* Worker code and environment both need updating on the actual VPS. The normal web deployment workflow does not restart worker processes.
* Historical provider rows linked to prior bets should not be deleted or re-labeled, because that could corrupt results, disputes and settlement records.

## BetsAPI game and full-market site catalogue (temporary migration phase)

**UI:** `/betsapi` from the homepage and Admin → Providers.
Browse 28 documented sports, Live / Upcoming, a country + league/team search,
UTC-date filters and multiple Upcoming pages. Click an FI match to request all
available bookmaker market groups. Both `/v1/bet365/event` and
`/v4/bet365/prematch` are parsed (including v4 dynamic `others`).

**Access immediately:** An existing admin can paste a **new rotated token**
into the private field on `/betsapi`. The token remains only in volatile browser
memory; API requests go through authenticated same-origin HTTPS POST. There is
no need to add a token to GitHub, rebuild Android, or modify the financial DB.
Once browser state is closed the token is gone.

**Optional public read-only preview (after secure VPS provisioning):**
```ini
BETSAPI_TRIAL_ENABLED=true
BETSAPI_TRIAL_TOKEN=<new-secret-from-betsapi-panel>
BETSAPI_PUBLIC_PREVIEW_ENABLED=true
BETSAPI_EXPLORER_REQUESTS_PER_HOUR=1000
```
The UI GET route fails closed if any required server config is missing.
The private token MUST never be in any `NEXT_PUBLIC_*` field. Site browsing
shares a bounded process-local upstream request budget and short cache. A public
read-only feed requires operational monitoring to prevent overusing trial quota.

**No wagering switch here:** Keep the existing The Odds API selection IDs,
outstanding wagers, wallet debits, and settlement intact until the owner
approves a separately tested source migration. The browse page is a *read-only*
BetsAPI bookmaker preview, **not** a source-authorized betting endpoint.
Even valid displayed prices may be suspended or out of date before use.

**Limits:** Bet365 upcoming endpoint is paginated (max 100 pages); choose a UTC
day to browse beyond that window. The parser supports up to 1000 market groups
with up to 250 valid prices per group and hides upstream-suspended outcomes.
No undocumented market outcome is invented. Some sports are not offered by
Bet365; empty results are honest. Live pages cache up to ~12 s and can refresh
every 30 s; prematch lists cache ~90 s.

**Rollback:** `BETSAPI_PUBLIC_PREVIEW_ENABLED=false` hides the new public
catalogue without affecting current betting or pending settlements.

## BetsAPI Everything Trial — evaluation only (no production cutover)

The operator has a three-day *Everything Trial*. Keep The Odds API serving all existing
events, bet slips and settlement until a separately approved, tested migration is ready.

1. **Revoke and rotate any trial token posted in a screenshot/chat.** The old token
   should be treated as exposed. Never commit a token, store it in a mobile APK,
   include it in `NEXT_PUBLIC_*`, or paste it in an issue/CI log.
2. On the **web server's secret environment**, set:
   ```sh
   BETSAPI_TRIAL_ENABLED=true
   BETSAPI_TRIAL_TOKEN=<newly-rotated-private-token>
   ```
3. Deploy the website through the standard owner-approved workflow and reload the
   **web** process so the secret environment is available. This diagnostic does not
   need an odds-worker restart and does not write to `nova.*`.
4. As an admin, open `/admin/providers` and click **Test BetsAPI coverage**.
   Or call `GET /api/v1/admin/betsapi/trial` with your authenticated admin session.
   This read-only, rate-bounded probe samples up to five sports, two event-odds
   books, and the Bet365 in-play entitlement. It caches results for 120 seconds.
5. Inspect real availability, authorization, market coverage, request quotas and
   source timestamps. Some packages grant Events API but not bookmaker-specific
   Bet365 API; the trial must verify which groups are actually enabled.
6. For migration, separately implement BetsAPI-owned match IDs, settlement data
   lineage, margin/rules compatibility, a production worker, sport/market mappings,
   and an **operator-approved** cutover. Do not re-label existing The Odds API
   matches/quotes, or share their market IDs, or run both sources against the
   same bet selection. Old accepted wagers must remain settleable.

API documentation:
- https://betsapi.com/docs/events/inplay.html
- https://betsapi.com/docs/events/odds.html
- https://betsapi.com/docs/bet365/
- https://betsapi.com/docs/pricing.html

## 2. Payments (deposits, withdrawals, refunds, payout confirmations)

```
PAYMENT_PROVIDER=<vendor adapter name>     # currently: disabled | http
PAYMENT_PROVIDER_BASE_URL=https://...
PAYMENT_PROVIDER_MERCHANT_ID=...
PAYMENT_PROVIDER_API_KEY=...
PAYMENT_WEBHOOK_SECRET=...
PAYMENT_WEBHOOK_TOLERANCE_SECONDS=300
```

What must be provided: an implementation of `PaymentProviderAdapter` (`listMethods`, `createDeposit`,
`createWithdrawal`, `verifyAndParseWebhook`, `refund`, `payoutStatus`). The platform already
implements: intent lifecycle, wallet holds, webhook receipt/duplicate detection, operator review,
refunds as ledger reversals, and the rule that a payout cannot be marked paid without a provider
reference.

Without it: `/api/v1/payments/methods` lists methods as unavailable,
`/api/v1/wallet/deposit` and `/api/v1/wallet/withdraw` return `PROVIDER_NOT_CONFIGURED`, and
affiliate payouts stop at `approved` — no money is ever reported as moved.

## 3. Transactional messaging (email / SMS / push)

```
NOTIFY_EMAIL_PROVIDER=...   SMTP_URL=...
NOTIFY_SMS_PROVIDER=...     SMS_API_KEY=...
NOTIFY_PUSH_PROVIDER=...    PUSH_VAPID_PUBLIC_KEY=... PUSH_VAPID_PRIVATE_KEY=...
```

Notifications are queued with templates and preferences already in the database; without a provider
the notification worker records `NOT_CONFIGURED` and leaves the notification queued for retry. The
admin dashboard reports each channel's configured state and the env vars it needs.

## 4. Auth, KYC, hosting

* **Auth** — Supabase URL + anon key (server-side session resolution is already Supabase-compatible);
  without them the account area reports `authUnavailable` and never simulates a login.
* **KYC** — a provider for document verification; the platform stores status transitions.
* **Object storage** — only if you choose to store KYC/evidence documents yourself (optional).
* **Nginx + TLS**, PM2/systemd, off-host backups, and a monitoring endpoint scraper
  (`/api/metrics` with `HEALTH_DEEP_CHECK_TOKEN`).

## 5. Team/league logos (no key required)

Odds providers ship names without artwork, so the logo worker (`npm run worker:logo`,
queue `logo`) resolves REAL badges out of band:

```
LOGO_ESPN_ENABLED=true            # official ESPN artwork (soccer, NBA, NFL, MLB, NHL)
LOGO_SPORTSDB_ENABLED=true        # sport-verified TheSportsDB fallback (volleyball, handball, ...)
LOGO_SPORTSDB_API_KEY=123         # optional: your own TheSportsDB key (default: free test key)
LOGO_WORKER_INTERVAL_MS=600000    # sweep cadence (default 10 min)
LOGO_WORKER_TEAM_BATCH=30         # teams per sweep (prioritised by recent matches)
LOGO_WORKER_LEAGUE_BATCH=10       # leagues per sweep
```

Every candidate is conservatively name-matched, every stored URL is HEAD-verified
to be a real image, and confirmed misses are cached in `nova.logo_cache`
(migration `0196`) so upstream APIs are hit once per name. Individual sports
(tennis, boxing, MMA) are skipped on purpose — athletes have no team badges,
and the UI shows an honest initial instead of a fake logo.

Backfill everything once with `NOVA_WORKER_ONCE=true npm run worker:logo`
(repeat until the sweep reports no new resolutions).

## Switching a provider on — checklist

1. Implement the adapter and add it to `src/providers/` registry selection.
2. Set the environment variables in the server/worker environment (never `NEXT_PUBLIC_*`).
3. `bash scripts/preflight-production.sh` (it verifies the variables are present and consistent).
4. Restart the web process and the relevant worker.
5. Verify in `/admin/providers` that the provider is `configured: true` and `reachable: true`.
6. Exercise a real end-to-end operation in staging (small real transaction) before enabling in
   production — the platform will not fabricate that evidence for you.
