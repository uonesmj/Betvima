# Testing

Six layers, each with a distinct job. Nothing is mocked where it matters: the integration and SQL
suites run against a **real PostgreSQL database with the real migrations and the real SQL functions**,
and the E2E suite runs against a **real production build** (`npm run build` + `next start`).

| Suite | Command | What it proves |
| --- | --- | --- |
| Unit (12 files, 118 tests) | `npx vitest run tests/unit` | Pure rules: money rounding, odds maths, market rules, settlement grading, commission models A/B, risk engine, referral/timezone windows, bet-slip store, enum mirrors, fixture contract, and the API-contract checker's own regression test |
| Integration (3 files, 19 tests) | `PGHOST=127.0.0.1 PGPORT=5432 PGUSER=nova PGPASSWORD=nova_local_dev PGDATABASE=nova npx vitest run tests/integration` | Real placement → settlement → ledger flow, concurrency, cash-out single-use, worker pipeline through the **real worker process**, and the whole admin query surface |
| SQL (6 files) | `bash scripts/run-sql-tests.sh` | Schema invariants, RLS behaviour for anon/authenticated/service roles, money function semantics, affiliate settlement maths, idempotency, concurrency |
| E2E (4 files, 132 tests) | `npx playwright test` | Browser behaviour across **4 projects** (Chromium mobile, Chromium desktop, Firefox desktop, WebKit desktop): responsive layout at 9 viewports, bet-slip contract, access control, security headers, automated accessibility (axe) |
| Static contract check | `node scripts/verify-api-contract.mjs` | Every browser-side API call matches a real route **and** an exported method, and every protected mutation authorises before it validates |
| Static gates | `npm run typecheck`, `npm run lint`, `npm run build`, `bash scripts/scan-service-role-exposure.sh`, `bash scripts/verify-deploy-config.sh`, `bash scripts/preflight-production.sh` | Types, lint, build, secret containment, deploy artifacts, production configuration |

## What the integration suite covers

* **`betting-flow.test.ts`** — deposit → place → settle → wallet balance; odds-change refusal and
  explicit acceptance; insufficient funds; idempotent replay of a placement; 8 identical placement
  keys produce exactly 1 bet / 1 debit; 4 concurrent placements on a 50,000 balance produce exactly
  1 winner; cash-out quote/accept/replay/expiry.
* **`worker-pipeline.test.ts`** — runs `src/workers/entrypoints/settlement.worker.ts` as a child
  process in one-shot mode, proves it claims a queued settlement job, settles the bet (2.50 odds ×
  100,000 → 250,000 payout through the ledger) and records a heartbeat; plus that kind filtering
  (migration `0140`) prevents a worker from claiming jobs it cannot handle.
* **`admin-query-surface.test.ts`** — every admin read path with every filter combination
  (dashboard windows, user directory, bet explorer sorts, payment intent direction/status, wallet
  adjustments, affiliate directory/payouts/settlement queue, affiliate detail sections, job queue,
  heartbeats, audit, settings, operations, roles, provider health, reconciliation history). This is
  the regression guard for SQL that only fails when a filter is applied — the class of bug that
  produced `operator does not exist: payment_tx_type = text` and `order by rp.approved_at` in
  development.

## E2E contract highlights

`tests/e2e/betslip.spec.ts` encodes the product rule directly: the slip opens **only** from
`[data-testid="betslip-open-control"]` / `[data-testid="betslip-mobile-control"]`, hovering or
clicking a match/team/league/score/market never opens it, closing it keeps it closed, and clicking
content navigates instead. The panel is queried as `[data-betslip-panel]:visible` so the mobile sheet
and the desktop rail are tested identically.

`tests/e2e/responsive.spec.ts` walks 360/375/390/414/768/1024/1280/1440/1920 px across ten public
paths and asserts `document.scrollWidth <= viewport + 1`, reporting up to five offending elements
when it fails. It also re-checks the layout with the bet slip open.

`tests/e2e/security.spec.ts` asserts that protected routes expose no data to an anonymous visitor,
that API errors use the standard envelope with a correlation id and no stack traces,
`X-Content-Type-Options: nosniff` is present, and that `/api/health` reports provider gaps honestly
instead of claiming everything is fine.

## Accessibility (axe)

`tests/e2e/a11y.spec.ts` runs `@axe-core/playwright` with the `wcag2a`, `wcag2aa`, `wcag21a` and
`wcag21aa` rule tags over eight representative pages (`/`, `/live`, `/help`, the three legal pages,
`/auth/login`, `/admin/dashboard`), plus two behavioural checks: the document declares a language and
a direction (`<html lang="fa" dir="rtl">`), and a real match page **with the bet slip opened** is
still accessible. The suite fails on `critical` and `serious` impact violations and prints the
per-node selectors; minor/moderate findings are reported but do not fail the build. Current state:
0 violations of any impact on all eight pages.

## Cross-browser coverage

The same contract specs run on four Playwright projects — `chromium-mobile` (Pixel 5),
`chromium-desktop`, `firefox-desktop` and `webkit-desktop` — so the bet-slip and layout contracts are
verified on Blink, Gecko and WebKit. `windows-chrome` exists as a declared-but-disabled placeholder
(`testIgnore`) for teams that need to run the suite on Windows agents.

## Client/API contract check

`scripts/verify-api-contract.mjs` is a zero-dependency static check with two jobs:

1. **Route/method agreement** — every `apiRequest(...)`, `adminPost(...)` and `useApiQuery(...)` call
   in `src/` is resolved against the real App-Router files, comparing normalised path segments
   (`${...}` → wildcard) and the exported HTTP methods. It caught two genuine 405s in the admin
   panel (`settings-client.tsx` and `affiliate-fraud-client.tsx` POSTing to a PATCH-only route) that
   type checking, linting and the happy-path tests could not see.
2. **Authorisation before validation** — a protected mutation must resolve the session
   (`withUser`/`withAdmin`) *before* it parses the body, otherwise an anonymous caller receives
   schema feedback (422) about a privileged payload instead of 401/503. Public handlers
   (`/api/v1/auth/**`, `/api/webhooks/**`, `/api/v1/ref/**`, health) are exempt by path.

The checker is run by `scripts/preflight-production.sh` (step 10) and is itself covered by
`tests/unit/api-contract-checker.test.ts`, which executes it against the real tree (must pass) and
against a temporary tree containing a deliberate violation (must fail), so a silently broken checker
cannot masquerade as a clean result.

## Local prerequisites

```bash
# database
createdb nova_test    # the SQL suite creates/drops its own scratch database
# browsers for E2E
npx playwright install --with-deps chromium firefox webkit
```

Use `--with-deps`: a plain `npx playwright install firefox webkit` aborts with *"Host system is
missing dependencies"* on Debian/Ubuntu images, and installing the libraries by hand is not
sufficient. The E2E suite targets an already running production build (`npm run build` followed by
`npx next start -H 0.0.0.0 -p 3000`); restart the server after any UI change, because `next start`
serves the build that existed when it booted.

The suites skip (never silently pass) when no database is configured, and every financial assertion
is on integer minor units — a test that cannot reproduce the exact expected integer fails.

## Determinism notes

`tests/e2e/` uses fixed locales (`fa-IR`), timezone (`Asia/Tehran`), and `workers: 1` so
pagination/overflow assertions cannot race. The integration helpers generate unique fixture keys
(`key('prefix')`), and the country fixture uses a fixed code with an upsert to keep repeated runs
idempotent.
