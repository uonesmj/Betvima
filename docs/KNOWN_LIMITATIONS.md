# Known limitations (honest status)

Everything here is deliberately not finished, not verified, or dependent on an external party. None
of it is hidden behind a fake success path — each item names what is missing and what happens today.

## Requires an external provider (implemented, disabled)

| # | Item | Current behaviour |
| --- | --- | --- |
| 1 | Live/pre-match odds from a sports data feed | No provider configured → matches and odds lists are empty and labelled; `SPORTS_PROVIDER=disabled` |
| 2 | Automatic settlement from provider results | Implemented end to end, but currently driven by operator-entered results (`/admin/matches/[id]`); provider result ingestion activates the same pipeline |
| 3 | Deposits and withdrawals | `/api/v1/wallet/deposit|withdraw` return `PROVIDER_NOT_CONFIGURED`; methods are listed as unavailable; no balance is ever created without a verified provider event |
| 4 | Affiliate payouts reaching `paid` | Implemented, but a payout cannot be marked paid without a real provider reference — so payouts stay `approved` until a payment provider (or documented manual transfer evidence) exists |
| 5 | Email / SMS / push delivery | Notifications are queued and rendered in-app; the worker records `NOT_CONFIGURED` and retries instead of pretending delivery |
| 6 | Auth (Supabase) | Without `NEXT_PUBLIC_SUPABASE_URL`/anon key the account area reports `authUnavailable`; no session is simulated |
| 7 | KYC document verification | Status transitions and gating are implemented; the verification itself is the provider's job |

## Verified-but-limited

| # | Item | Detail |
| --- | --- | --- |
| 8 | Real-time odds transport | Odds are delivered by polling with `force-dynamic` endpoints; the WebSocket upgrade is configured in Nginx and the provider contract supports streaming (`SPORTS_PROVIDER_LIVE_WS_URL`), but the streaming adapter itself is not written |
| 9 | Cash-out pricing model | The quote uses a configured margin over the live implied probability (`cashout_quote(..., p_margin_bps)`); it is not a risk-adjusted book model |
| 10 | Local development database | The container uses PostgreSQL 17 on `127.0.0.1:5432` with a local `nova`/`nova_test` database. End-to-end verification against a managed Supabase instance has **not** been performed (no credentials available here), so authenticated admin/affiliate screens are exercised through the service and API layers (integration + contract tests) rather than through a browser session |
| 11 | Load/soak testing | Concurrency is proven at the transaction level (parallel placements, job claims, idempotent replays) but no sustained load test (thousands of rps, long-running soak) has been executed |
| 12 | Multi-region / HA | Single-region deployment; PM2 cluster mode and stateless web processes allow scale-out, but failover and replication topology are deployment decisions |
| 13 | Browser matrix for E2E | Playwright runs four projects in this container — Chromium mobile (Pixel 5), Chromium desktop, Firefox and WebKit — all green (132 tests). A Windows Chrome channel project is declared but disabled, and real mobile devices (iOS Safari, Android Chrome) are not covered |
| 14 | Accessibility audit | Automated axe scans (WCAG 2.0/2.1 A + AA tags) run over 8 representative pages plus the match page with the bet slip open, and report 0 critical/serious violations. Eight pages is not the whole surface (authenticated admin screens are not reachable without Supabase credentials) and no manual screen-reader review (NVDA/VoiceOver) has been performed |
| 15 | Localisation coverage | Persian is the default and English is complete for the shipped UI; a native-speaker linguistic review of long-form legal/help copy is outstanding |
| 16 | Penalty shoot-out / extra-time settlement nuance | Grading supports the market rules implemented in `src/domain/market-rules.ts`; exotic markets (player props, corners race, session markets) need their rule definitions added before they can be offered |

## Operational items the operator must complete

* Set real values for every `SERVER_ONLY`/`WORKER_ONLY` variable, including
  `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, provider keys and `HEALTH_DEEP_CHECK_TOKEN`.
* Configure DNS/TLS for the production domain (`NEXT_PUBLIC_SITE_URL`, Nginx `server_name`) — the
  code never hard-codes a host.
* Schedule `ops/backup.sh`, `ops/restore-test.sh` and `ops/health-watch.sh` in cron, and wire the
  health watcher to real alerting.
* Run at least one restore drill on the production database before going live, and confirm the
  reconciliation checks pass on real traffic.
* Decide and document licensing/jurisdiction rules; the platform implements the controls, not the
  licence.

## Not claimed

* No claim of 100% test coverage, formal verification, or zero-defect behaviour.
* No claim that the platform is PCI-DSS certified: card data never touches it (redirect/hosted
  provider flows), which is a design choice, not a certification.
* No claim of production hardening against a determined DDoS beyond Nginx rate limiting, proxying
  and the documented operational controls.
