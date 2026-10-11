# Architecture

## Layers and the dependency rule

```
src/app/**            HTTP routes + pages (Next.js App Router)      depends on: server, lib, domain
src/components/**     React UI (client)                             depends on: lib (types, hooks, i18n)
src/server/**         adapters, services, auth, http, workers       depends on: domain, lib
src/domain/**         pure rules: money, odds, engines, risk        depends on: nothing (no I/O, no DB)
src/lib/**            contracts: ports, types, i18n, store, hooks   depends on: nothing
supabase/migrations   the schema AND the financial rules (PL/pgSQL) authoritative
```

The rule that keeps this honest: **money rules live in the database and in `src/domain`, never in
React components or route handlers.** A route handler may *ask* for a money operation; it can never
compute one. `src/domain/money.ts`, `nova.round_div` and `nova.post_wallet_entry` are the only
implementations of rounding, and payout is `round_div(stake × Π odds, 10000^n)` on both sides of
the wire.

## Request lifecycle

```
request
  → middleware/route file            (dynamic = 'force-dynamic', node runtime)
  → withErrorHandling(route, fn)     (correlation id, error envelope, no stack traces)
  → withUser / withAdmin             (session → SessionUser, RBAC permission check)
  → services (container)             (per-request wiring of adapters to ports)
  → repository / SQL function        (nova.* — authoritative, atomic, idempotent)
  → jsonOk / jsonCreated             (BigInt-safe JSON, decimal strings for money)
```

* **Authentication** is Supabase-compatible: a session token is resolved to a `SessionUser`
  server-side (`src/server/auth/session.ts`). Without Supabase env vars the account area reports
  `SERVICE_UNAVAILABLE` instead of inventing a session.
* **Authorisation** is two-layered: the RBAC matrix (`src/server/auth/rbac.ts`, mirrored from the
  `nova.admin_roles()` DB function) and database checks (`nova.require_admin()`, RLS policies).
* **Validation** is Zod at the boundary; identifiers, money and odds are never trusted from the client.

## Job lifecycle (workers)

```
enqueue (SQL, idempotency key) → nova.job_queue / nova.settlement_jobs
  → nova.claim_jobs(queue, worker, limit, ttl, kinds)   -- `for update skip locked`
  → handler (pure domain logic + SQL functions)
  → nova.complete_job / complete_settlement_job         -- done | failed | manual_review | skipped
  → heartbeat + worker_runs breadcrumbs
```

Every job handler is written to be idempotent, because a claim can be redelivered after a crash.
Retries are scheduled by the queue with exponential backoff; a job that exhausts `max_attempts`
moves to `dead_letter` and surfaces in `/admin/workers` and `/admin/jobs`.

## Failure philosophy

| Situation | Behaviour |
| --- | --- |
| No sports provider configured | Matches/odds endpoints return an empty, labelled dataset; admin shows the provider as `not configured`. No fake fixtures. |
| No payment provider configured | Deposit/withdrawal requests are refused with `PROVIDER_NOT_CONFIGURED`; methods list contains no enabled method. |
| Kill switch or `DEPOSITS`/`WITHDRAWALS`/`BETTING` off | The operation is refused at the database level, not only in the UI. If the switch state cannot be read, payments **fail closed**. |
| Slow/broken optional query inside an admin screen | The section is missing **and reported** in `degraded[]` with a log entry — never silently empty. |
| Reconciliation mismatch | Recorded in `nova.reconciliation_records`, surfaced in `/admin/reconciliation`, never auto-"fixed" by mutating history. |
