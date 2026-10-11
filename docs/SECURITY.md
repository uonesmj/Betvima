# Security

## Secrets

* `SUPABASE_SERVICE_ROLE_KEY` exists only in `SERVER_ONLY` env, is read in `src/server/env.ts`, and is
  never returned by an API, rendered in a page, logged (the logger scrubs key/secret/token/password
  fields) or bundled. `scripts/scan-service-role-exposure.sh` scans source **and** build output for
  the literal key name and any `NEXT_PUBLIC_` misuse; it fails the build and the preflight.
* Provider keys live in env as well; nothing is stored in the database in plaintext, and
  `/admin/settings` masks secrets as `••••••` while never sending the real value.
* Rotating a leaked key is documented in [OPERATIONS.md](OPERATIONS.md) (incident playbook).

## Database authorisation

* **RLS is enabled on all 74 base tables** (83 policies; `scripts/db-verify.sh` asserts
  "tables without RLS = 0" against an explicit service-only exclusion list) — `tests/sql/02_rls_test.sql`
  asserts that anonymous and authenticated roles see only what they should, and migration `0151`
  grants table privileges explicitly (a table with RLS but no grant fails closed with
  `insufficient_privilege`, which is asserted too).
* Privileged operations are authorised **server-side**: `nova.require_admin()`, `nova.is_admin()`,
  `nova.has_role(...)`, and per-function checks such as `guard_adjustment_approval()` and
  `guard_profile_update()` (which only allows `is_affiliate = true` inside a signed
  `register_affiliate` transaction).
* The service role is used only by the server and workers; the browser gets the anon key at most.

## Application

* Session resolution is server-side; the client never decides who it is. `withUser`/`withAdmin`
  attach a typed `SessionUser`, and RBAC is checked per route.
* **Authorise before you validate.** A protected handler resolves the session (401 when there is
  none, 503 when the auth backend is unavailable) *before* it parses or schema-checks the body, so an
  anonymous caller never receives validation feedback about a privileged payload. Where the required
  permission depends on the requested action, the flow is session → validate → permission check, and
  the permission is evaluated before any service call. `scripts/verify-api-contract.mjs` enforces
  this ordering statically across every mutating route (preflight step 10); public handlers
  (`/api/v1/auth/**`, `/api/webhooks/**`, `/api/v1/ref/**`, health) are the only exemptions.
* Input validation with Zod at every boundary; money and odds arrive as strings and are parsed to
  integer minor units; client-supplied odds/payout/balance are never trusted (`quoteToken` +
  `acceptedOdds` are re-validated server-side).
* Idempotency keys are mandatory on financial mutations (`Idempotency-Key` header or body field,
  minimum 8 characters), which makes retries and double-clicks harmless.
* Security headers (`next.config.mjs` + Nginx): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production.
* Rate limiting at two layers (Nginx zones + `nova.check_rate_limit`) for auth, payments and betting.
* Error envelopes never include stack traces or SQL; failures carry a `correlationId` that is also
  written into the audit/ledger metadata so a support ticket can be traced end to end.
* The service worker caches the app shell only and **never** caches `/api/` responses, so no stale
  financial data can be served from cache.

## Auditability

| Table | Contents |
| --- | --- |
| `nova.audit_logs` | actor, action, entity, before/after, reason, ip_hash, user_agent_hash, correlation_id — append-only |
| `nova.wallet_transactions` | every money movement, with idempotency key and reversal links |
| `nova.bet_settlements` | every settlement revision, reversal link, actor |
| `nova.settlement_events` | granular settlement/regrade events with payloads |
| `nova.affiliate_ledger`, `nova.affiliate_audit_logs`, `nova.affiliate_adjustments` | commission, settlements, payouts and every manual affiliate change |
| `nova.admin_adjustments` | requested/approved/applied adjustment with both actors |
| `nova.risk_decisions` | decision, rule, facts snapshot, actor |

Append-only enforcement is structural: `nova.prevent_mutation()` and `nova.prevent_delete_only()`
triggers raise on UPDATE/DELETE for ledger, settlement, audit and odds-history tables. Corrections
are reversals (`reversal_of`/`reversed_by`), which is what makes a financial dispute resolvable
months later.

## Privacy

* Raw IP addresses are hashed (`nova.attach_attribution(..., ip_hash)`, rate-limit buckets) and never
  stored in the clear; user agents are stored as hashes in audit rows.
* KYC documents are handled by the KYC provider — the platform stores status, not documents.
* Customer-visible data is scoped by `user_id` in SQL and RLS; the API also filters by the session
  user (`bets/[id]`, wallet, affiliate endpoints).
