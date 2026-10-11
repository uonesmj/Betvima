# NOVA SPORTSBOOK — documentation index

Production-grade sportsbook platform: Next.js 15 (App Router) + PostgreSQL (Supabase-compatible)
with a money-authoritative SQL core, four worker processes, a full affiliate programme, an
RBAC-guarded admin panel and an ops toolchain (backup / restore drill / rollback / health watch).

**Nothing in this platform invents data.** Odds, balances, bets, commissions and payment results
only ever come from real inputs: an external provider, an operator action, or the database itself.
When a dependency is missing the platform reports `degraded`/`NOT_CONFIGURED` and refuses the
operation instead of simulating success.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, dependency rules, request and job lifecycles |
| [DATA_MODEL.md](DATA_MODEL.md) | 78 tables, 26 enums, 5 views, money representation, migrations |
| [WALLET_AND_LEDGER.md](WALLET_AND_LEDGER.md) | Double-entry ledger, the only balance mutation path, idempotency, reversal |
| [BETTING_ENGINE.md](BETTING_ENGINE.md) | Bet placement, odds authority, settlement, grading, regrade, cash-out |
| [AFFILIATE_PROGRAM.md](AFFILIATE_PROGRAM.md) | Model A / Model B, Friday settlement, payouts, hierarchy, fraud, reconciliation |
| [PAYMENTS.md](PAYMENTS.md) | Provider adapter contract, webhooks, deposits/withdrawals, refunds |
| [RISK_ENGINE.md](RISK_ENGINE.md) | Rules, scopes, decisions, limits, manual review |
| [WORKERS.md](WORKERS.md) | Queues, claiming, retries, heartbeats, crash recovery, run-once mode |
| [API.md](API.md) | Every HTTP endpoint, envelope, errors, idempotency headers |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Roles, permissions, each admin screen and its actions |
| [OPERATIONS.md](OPERATIONS.md) | Backups, restore drills, rollback, health watch, alerts |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment variables, migrations, preflight, Nginx, PM2, zero-downtime |
| [SECURITY.md](SECURITY.md) | RLS, service-role containment, headers, secrets scanning, audit trail |
| [TESTING.md](TESTING.md) | Unit / integration / SQL / E2E suites and what each one proves |
| [I18N_AND_PWA.md](I18N_AND_PWA.md) | fa/en, RTL-first layout, responsive contract, PWA, SEO |
| [COMPLIANCE.md](COMPLIANCE.md) | Responsible gaming, KYC, self-exclusion, data protection |
| [EXTERNAL_PROVIDERS.md](EXTERNAL_PROVIDERS.md) | What is required to switch on sports data / payments / messaging |
| [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) | Honest list of unverified or provider-dependent behaviour |
| [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) | Spec requirement → implementation → evidence → status |
| [FINAL_REPORT.md](FINAL_REPORT.md) | Deliverable summary: IMPLEMENTED / EXTERNAL_PROVIDER_REQUIRED / BLOCKED |

## Delivery archive

`bash scripts/make-archive.sh [out-dir]` produces `sportsbook-production-final.tar.gz` (plus a
`.sha256` file) containing the full source tree, the docs, the ops/deploy scripts and
`ARCHIVE_MANIFEST.txt` (file counts, migration checksums, toolchain versions). Build output,
`node_modules`, logs, `.env.local` and scratch files are excluded by design — the recipient runs
`npm ci && npm run build`.

The delivered artifact holds 374 files (21 documents, 20 migrations). It is self-contained: it was
extracted into an empty directory and the extracted copy was verified independently — `npx tsc
--noEmit` reports 0 errors and `node scripts/verify-api-contract.mjs` passes against the extracted
tree, so nothing needed for a build lives outside the archive. The sidecar
`sportsbook-production-final.tar.gz.sha256` pins the exact bytes.
