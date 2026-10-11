# HTTP API

Base path `/api/v1` (69 route files in total, including `/api/health`, `/api/metrics` and
`/api/webhooks/[provider]`).

## Conventions

* **Envelope.** Success: `{ "ok": true, "data": … }`. Failure:
  `{ "ok": false, "error": { "code", "message", "details"? }, "correlationId" }` with a matching
  `x-correlation-id` response header. Stack traces are never returned.
* **Money** is always a decimal string of integer minor units (`"1250000"`), never a float.
  **Odds** are integers scaled by 10,000 (`"21000"` = 2.10).
* **Idempotency.** Every mutating money/affiliate endpoint accepts `Idempotency-Key`
  (min 8 chars). A replay returns the original result with `idempotentReplay: true` and never
  applies money twice. Missing keys on financial writes are rejected.
* **Auth.** Session cookie/token resolved server-side. Admin endpoints additionally require an RBAC
  permission, and the database re-checks the actor (`nova.require_admin()`).
* **Caching.** All API routes are `dynamic = 'force-dynamic'`; nothing financial is ever cached.
* **Rate limits.** `nova.check_rate_limit(bucket, limit, window)` plus Nginx zones.

## Degradation and partial success

A failure is never hidden behind an empty screen or a silent success:

* **Composite admin reads** (`/api/v1/admin/dashboard`, `/api/v1/admin/users/[id]`,
  `/api/v1/admin/bets/[id]`, `/api/v1/admin/workers`) return a `degraded` array whose entries name
  the section that could not be read (`{ section, message }`); the rest of the payload is still
  returned and the failure is logged with the request's `correlationId`.
* **Partial successes carry flags** instead of discarding work that already happened:
  `POST /api/v1/admin/matches/[id]/result` returns `settlementQueued` (`false` when the
  re-settlement jobs could not be enqueued) and `POST /api/v1/admin/selections/[id]/odds` returns
  `historyRecorded` (`false` when the odds-history row could not be written). The admin UI shows
  both in the operator's message area instead of reporting a plain success.
* **Payments fail closed.** `GET /api/v1/payments/methods` answers `depositsEnabled: false`,
  `withdrawalsEnabled: false` and `operationsUnavailable: true` when the operation switches cannot
  be read, rather than assuming they are enabled.
* **Pages fail loudly.** The public catalogue pages (`/live`, `/sports/[sport]`, `/match/[id]`)
  propagate read errors to the error boundary, which offers a retry, instead of rendering
  "no events" during a database incident. The homepage aggregates independent sections and lists
  every failed one in a visible notice (`degraded: string[]` from `getHomepageData` /
  `getServiceAvailability`).
* Best-effort reads (rate limiting on a referral click, `generateMetadata`) still fail open, but
  each one is logged: fail-open is a decision, silence is not.

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/config` | Site config, currencies, feature flags, affiliate settlement schedule |
| GET | `/api/v1/sports` | Sports with active match counts |
| GET | `/api/v1/matches` | Filters: `sport`, `league`, `from`, `to`, `status`, `q`, paging |
| GET | `/api/v1/matches/[id]` | Match, markets, selections, `oddsHistory`, result |
| GET | `/api/v1/matches/[id]/odds` | Odds only (fast polling / SSE fallback) |
| GET | `/api/v1/live` | Live matches with live odds |
| GET | `/api/v1/search` | Matches, teams, leagues |
| GET | `/api/v1/ref/[code]` | Referral landing metadata (never personal data) |
| GET | `/api/v1/payments/methods` | Methods + `depositsEnabled`/`withdrawalsEnabled` + `operationsUnavailable` |
| GET | `/api/health`, `/api/health/ready` | Liveness / readiness (503 while configuration is incomplete) |
| GET | `/api/metrics` | Prometheus text metrics (protected by `HEALTH_DEEP_CHECK_TOKEN` in production) |

## Auth and account

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Rate-limited; creates the profile through `nova.profiles` triggers |
| POST | `/api/v1/auth/logout` | Ends the session |
| GET | `/api/v1/auth/session` | `{ authenticated, user }`; `authUnavailable` when Supabase is not configured |
| GET/PATCH | `/api/v1/account/profile` | Profile read/update (server-validated fields only) |
| GET/PATCH | `/api/v1/account/limits` | Responsible-gaming limits, cooling-off, self-exclusion |
| GET/POST | `/api/v1/account/kyc` | KYC submission/status (documents stored by the provider, not by us) |
| GET | `/api/v1/notifications`, POST `/read` | In-app notifications |

## Wallet, bets, payments

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/wallet` | Balances, held funds, lifetime totals, statement (paged) |
| POST | `/api/v1/wallet/deposit` | `503 PROVIDER_NOT_CONFIGURED` until a PSP is configured |
| POST | `/api/v1/wallet/withdraw` | Holds funds, then operator review |
| POST | `/api/v1/bets/quote` | Server-side odds, combined odds, payout, odds-change diff, quote token |
| POST | `/api/v1/bets` | Placement; `409 ODDS_CHANGED` unless the change is explicitly accepted |
| GET | `/api/v1/bets`, `/api/v1/bets/[id]` | Customer's own bets only |
| GET/POST | `/api/v1/bets/[id]/cashout` | Quote (GET) and accept (POST); single-use quote |
| POST | `/api/webhooks/[provider]` | Signature-verified provider callbacks |

## Affiliate (`/api/v1/affiliate/*`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/affiliate/overview` | Payable, carry-forward, suppressed, period, next settlement window |
| GET | `/api/v1/affiliate/referrals` | Referred users and their commission |
| GET | `/api/v1/affiliate/ledger` | Commission ledger (append-only) |
| GET/POST | `/api/v1/affiliate/payouts` | Payout history; request a payout when payable ≥ minimum |
| GET/POST | `/api/v1/affiliate/links` | Referral links/campaigns with click counts |
| POST | `/api/v1/affiliate/register` | Become an affiliate (self-referral and cycles rejected) |

## Admin (`/api/v1/admin/*`) — every route is permission-checked

| Area | Endpoints |
| --- | --- |
| Overview | `GET dashboard?window=24h\|7d\|30d`, `GET providers`, `GET workers`, `GET roles` (the Health page reads the public `/api/health` + `/api/health/ready`) |
| Jobs | `GET jobs`, `POST jobs/[id]/retry`, `POST jobs/[id]/cancel`, `GET settlements` (settlement queue + stats) |
| Customers | `GET users`, `GET/PATCH users/[id]` (`set_status`, `set_role`, `set_kyc`, `update_limits`, `add_note`) |
| Bets | `GET bets`, `GET bets/[id]`, `POST bets/[id]/settle`, `POST bets/[id]/regrade` |
| Trading | `POST matches/[id]/result`, `POST markets/[id]/suspend`, `POST selections/[id]/odds` |
| Money | `GET payments`, `POST payments/[id]/review\|mark-paid\|refund`, `GET/POST wallet/adjustments`, `POST wallet/adjustments/[id]/approve` |
| Affiliates | `GET affiliates`, `GET/PATCH affiliates/[id]`, `POST affiliates/[id]/settle`, `GET/PATCH affiliates/fraud`, `GET affiliates/payouts`, `POST affiliates/payouts/[id]/transition` |
| Risk | `GET/POST risk/rules`, `GET risk/decisions` |
| System | `GET/PATCH operations`, `GET/PATCH settings`, `GET audit`, `GET/POST reconciliation` |

`settings` PATCH accepts `{ key, value }`; `operations` PATCH accepts `{ key, isEnabled, reason }`
and writes an audit entry with the actor and reason.
