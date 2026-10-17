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
