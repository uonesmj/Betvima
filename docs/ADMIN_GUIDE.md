# Admin guide

The admin surface is protected twice: an RBAC permission on every route/page and database-level
checks (`nova.require_admin()`, `nova.is_admin()` in RLS policies, `assert_nonzero_amount()`, audit
triggers). Hiding a button is never the only protection.

## Roles and permissions

Mirrored 1:1 between `src/server/auth/rbac.ts` and the `nova.admin_roles()` database function
(`ADMIN_ROLES` in `src/lib/db-enums.ts`; a unit test asserts the two lists agree).

| Role | Focus | Notable permissions |
| --- | --- | --- |
| `support` | Customer service | `users.view`, `users.notes`, `bets.view`, `payments.view` |
| `finance` | Money | `wallet.view`, `wallet.adjust`, `wallet.approve_adjustment`, `payments.approve/reject/refund`, `reconciliation.run` |
| `risk_manager` | Risk | `risk.view/edit`, `limits.edit`, `bets.settle/regrade/void/reverse`, `affiliates.fraud` |
| `settlement_manager` | Results & settlement | `bets.settle/regrade/reverse/void`, `matches.manage`, `odds.view`, `reconciliation.run` |
| `trader` | Odds | `odds.view/edit`, `markets.suspend`, `matches.manage` |
| `affiliate_manager` | Affiliates | `affiliates.view/edit/approve/payout/fraud` |
| `admin` | Full operations | everything above + `settings.view/edit`, `killswitch.toggle`, `admin.roles`, `admin.audit` |
| `super_admin` | Root of trust | `admin` + `maintenance.toggle` |

Self-approval is always blocked: an operator cannot approve their own wallet adjustment
(`SELF_APPROVAL_BLOCKED`) or their own payout. Adjustments above `DUAL_APPROVAL_THRESHOLD_AMOUNT`
require a second approver.

## Screens

| Page | What it shows | Actions |
| --- | --- | --- |
| `/admin/dashboard` | 24h/7d/30d metrics (users, betting, wallet, affiliate, risk, providers, jobs, workers) | window switch; a `degraded[]` banner when an optional section could not be read |
| `/admin/health` | Live dependency report: database, ledger integrity, auth, sports provider, payment provider, workers | auto-refresh; honest `degraded`/`down`/`unknown` |
| `/admin/workers` | Heartbeats (worker, queue, status, counters, hostname) with staleness detection, queue depth, recent runs | refresh |
| `/admin/jobs` | Durable `nova.job_queue` with filters by queue/status, stats per queue | retry, cancel |
| `/admin/providers` | Configured/reachable state for sports, payments and messaging, with the env vars each needs, plus `provider_health` history | refresh |
| `/admin/users` | Directory with filters (status, role, KYC, search) | open profile |
| `/admin/users/[id]` | Profile summary, notes, recent bets, wallet, payments, restrictions | set status, set role, set KYC, edit limits, add note (each audited with a reason) |
| `/admin/bets` | Bet explorer: filters (user, status, type, search, min stake), sortable | open bet |
| `/admin/bets/[id]` | Bet + legs, settlement revisions, settlement events, risk decisions | manual settle, regrade (both need a reason; regrade reverses then re-settles) |
| `/admin/payments` | Deposit/withdrawal queue with filters | approve/reject withdrawal, mark paid (requires provider reference), refund |
| `/admin/wallet-adjustments` | Adjustment requests and their approval state | create request, approve/reject (dual approval above threshold, no self-approval) |
| `/admin/matches` | Match list with status and result state | open match |
| `/admin/matches/[id]` | Match, markets, selections, odds history, current result | record result (enqueues settlement), suspend/resume market, override selection odds (with reason) |
| `/admin/settlements` | `nova.settlement_jobs` queue with per-status counters **and** the generic worker job list | retry/cancel worker jobs |
| `/admin/affiliates` | Directory with payable, carry-forward, suppressed, model, rate, flags | open affiliate |
| `/admin/affiliates/[id]` | Detail: payable breakdown, stats, ledger, referrals, payouts, hierarchy, fraud flags | set status, set parent, update terms, manual adjustment, settle period |
| `/admin/affiliate-payouts` | Payout queue with filters | transition status (approve → processing → paid with reference, or reject with reason) |
| `/admin/affiliate-fraud` | Fraud flags with severity and evidence | set status `open → reviewing → confirmed | dismissed` |
| `/admin/risk-rules` | Rules with scope/kind/value/action/priority | create/update rule |
| `/admin/risk-decisions` | Decision log with the facts snapshot | filter by decision/user |
| `/admin/operations` | Operation switches and kill switches, maintenance mode | toggle with a mandatory reason (audited) |
| `/admin/settings` | System settings (secrets masked as `••••••`) | update a setting (audited) |
| `/admin/reconciliation` | Six financial control checks + history of runs | run reconciliation now |
| `/admin/roles` | Role list with permissions and user counts | read-only |
| `/admin/audit` | Audit log with filters (actor, action, entity, date, search) | read-only |
| `/admin/reports` | Cross-domain report view (betting, wallet, affiliate, risk, jobs) | export where permitted |

## Operating notes

* **Result recording** is the trigger for automatic settlement. Recording a result for a match with
  open bets enqueues one settlement job per bet; the worker settles them and the UI reflects the new
  state. A correction is recorded as a new result revision and a regrade, never by editing history.
* **Odds overrides** (`/admin/matches/[id]`) write to `nova.odds_history` through
  `nova.publish_odds_tick` and require a reason; the previous value is preserved.
* **Kill switches** are database rows, not deployment settings, so flipping one during an incident
  takes effect immediately for every replica and worker.
* **Every mutation** writes an audit entry with actor, target, before/after and reason; the audit
  log is append-only (`nova.prevent_mutation()`), which is what makes disputes resolvable.
