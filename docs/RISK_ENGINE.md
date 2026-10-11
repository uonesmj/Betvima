# Risk engine

## Two evaluation layers

1. **Platform limits** (`src/domain/risk-engine.ts`, `DEFAULT_LIMITS`, overridable per environment and
   per user) — min/max stake, max payout, live stake cap, per-market/match/user exposure caps, daily
   stake and payout caps, and a `suspiciousPayoutRatioBps` trigger for accelerated review. These are
   always evaluated and cannot be switched off by a customer.
2. **Operator rules** (`nova.risk_rules`, edited in `/admin/risk-rules`) — additional, scoped rules on
   top of the limits.

| Column | Meaning |
| --- | --- |
| `scope` | `GLOBAL`, `SPORT`, `LEAGUE`, `AFFILIATE`, `USER` (text column, validated by the admin UI) |
| `scope_ref` | Target id for the scope (sport, league, affiliate or user id) |
| `kind` | Rule kind (`max_stake`, `max_payout`, `stake_velocity`, `odds_drift`, `exposure`, …) |
| `value_minor` + `currency` | Money threshold for the rule kind |
| `is_live` | Whether the rule applies to live betting, pre-match betting, or both (null = both) |
| `action` | `ALLOW`, `LIMIT`, `REJECT`, `MANUAL_REVIEW` (`nova.risk_decision`) |
| `priority` | Higher priority wins when several rules match |
| `is_active`, `reason`, `created_by`, `updated_at` | Lifecycle and audit fields |

The approved stake returned by the engine is the **only** stake the betting engine accepts; a rule
change is an audited admin action (`risk.edit`).

## Decision flow at placement

```
place_bet
  → collect facts: stake, odds drift, bets in window, deposits in window, account age,
    kyc status, restrictions, self-exclusion, affiliate attribution, device/IP concentration
  → risk.evaluate(facts, activeRules) → highest-priority matched action
      ALLOW          → place
      LIMIT          → place at the capped stake (never above the customer's request)
      MANUAL_REVIEW  → place into `manual_review`; settlement frozen until an operator decides
      REJECT         → refuse with a typed error, an audit entry and a customer-visible reason
```

Every evaluation is stored in `nova.risk_decisions` with the rule key, facts snapshot, decision and
actor. `/admin/risk-decisions` lists them (filter by decision/user) and `/admin/risk-rules` edits
rules; a rule change is an audited admin action (`risk.edit`).

## Limits and account states

* `nova.user_limits` — max stake per bet, daily/weekly/monthly staking and loss limits, deposit
  limits; enforced at the SQL layer, not only in the API.
* `nova.user_restrictions` — operator restrictions with reasons and expiry; checked before any
  betting or payment action.
* `account_status`: `active`, `restricted`, `suspended`, `closed`, `self_excluded`. A
  `self_excluded` customer cannot bet, deposit or withdraw (a legal requirement in most
  jurisdictions); the state is set by the customer (`/account/limits`) and by support, and both
  paths are audited.
* Velocity checks: `nova.check_rate_limit(bucket, limit, window_seconds)` backs login, registration,
  deposit, withdrawal and bet-rate throttling (Nginx adds an edge layer too).

## Manual review

Bets placed in `manual_review` do not settle automatically: the settlement worker records the job as
`manual_review`, and an operator with `bets.settle` resolves it in `/admin/bets/[id]`
(`nova.manual_settle_decision`) with a mandatory reason and correlation id. The dashboard exposes
`risk.manualReviewBets` and `risk.settlementBacklog` so nothing can pile up unnoticed.
