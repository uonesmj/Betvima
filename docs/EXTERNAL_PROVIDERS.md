# External providers — what is required to switch each feature on

The platform is deliberately provider-agnostic: adapters, database structures, error states and
tests exist; only credentials and the vendor-specific mapping are missing. Until then every feature
reports `NOT_CONFIGURED` and refuses the operation instead of faking success.

## 1. Sports data + odds (live betting, automatic settlement from provider results)

Required environment variables:

```
SPORTS_PROVIDER=<vendor adapter name>      # currently: disabled | http
SPORTS_PROVIDER_BASE_URL=https://...
SPORTS_PROVIDER_API_KEY=...
SPORTS_PROVIDER_LIVE_WS_URL=wss://...      # optional: streaming odds
SPORTS_ODDS_FRESHNESS_SECONDS=45
SPORTS_LIVE_FRESHNESS_SECONDS=12
```

What must be provided: a vendor implementing `SportsDataProvider`
(`fetchMatches`, `fetchLiveMatches`, `fetchOdds`, `fetchResult`, `fetchResults`) with a documented
payload mapping. The adapter is the only new code required; publishing odds, freshness checks,
anomaly detection (`detectOddsAnomalies`), suspension of stale selections and settlement enqueueing
already exist and are exercised by the odds and settlement workers.

Without it: matches/odds lists are empty and labelled, live betting is unavailable, results must be
entered by an operator in `/admin/matches/[id]` (automatic settlement then works exactly as designed).

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
