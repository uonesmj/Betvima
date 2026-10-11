# Affiliate programme

Two commission models, one ledger, four settlement steps, and an explicit audit trail for every
number. All arithmetic happens in PostgreSQL (`nova.apply_bps`, `nova.affiliate_payable_balance`,
`nova.settle_affiliate_period`); the TypeScript engines in `src/domain/affiliate-engine.ts` are
pure mirrors used by tests.

## Models

### MODEL A — `PROFIT_LOSS_35` (35 % commission, negative carry-forward preserved)

Negative commission months are carried forward and offset against future positive months, so the
affiliate only ever receives payment on a positive running balance.

| Step (spec §99 worked example) | Event | Opening payable | Closing payable |
| --- | --- | --- | --- |
| 1 | user loses 10,000,000 | 0 | **+3,500,000** (`user_loss_commission`) |
| 2 | same book settles a 20,000,000 user win | +3,500,000 | **−3,500,000** (`user_win_debit −7,000,000`) |
| 3 | next period nets another 10,000,000 loss | −3,500,000 | **+6,500,000 payable** → payout 6,500,000 |

Nothing is ever reset: the negative balance stays on the ledger until real commission covers it, and
`payable = opening − deficit + period commission` is computed in SQL, never in the browser. The three
steps are asserted by `tests/unit/affiliate-commission.test.ts` ("preserves a negative balance",
"next period +10,000,000 → payable 6,500,000") and against the database by the SQL suite.

### MODEL B — `NON_NEGATIVE_35` (35 % commission, payable floor zero)

The payable balance has a **floor of zero**. A user win of 100 M, 500 M or 1 B can never produce a
negative payable balance; the amount that would have been negative is recorded as
`suppressed_minor` (raw event row preserved) so the operator can see exactly how much commission
was suppressed and why. `nova.affiliate_payable_balance()` returns
`raw_minor, payable_minor, suppressed_minor, floor_applied, currency` and is the single source of
truth for the number shown in the affiliate dashboard, the admin panel and the payout engine.

## Commission configuration

Resolution order (most specific wins), implemented by `nova.resolve_commission_config`:

```
GLOBAL → SPORT → GROUP → AFFILIATE → CAMPAIGN
```

Defaults come from env (`AFFILIATE_DEFAULT_MODEL=NON_NEGATIVE_35`,
`AFFILIATE_DEFAULT_RATE_BPS=3500`, `AFFILIATE_MIN_PAYOUT_MINOR=5000000`). Parent override bps can be
set per hierarchy link (`nova.affiliate_relationships.parent_override_bps`) and is capped by
`net_cap_bps`, with proration applied parent-first so the sum of all payouts never exceeds the
configured share of net revenue.

## Hierarchy

* Registration with a parent code goes through `nova.register_affiliate(...)` /
  `POST /api/v1/affiliate/register`; self-referral and circular hierarchies are rejected
  (`AFFILIATE_SELF_REFERRAL`, `AFFILIATE_CYCLE`).
* Depth is capped (`set_affiliate_parent(..., max_depth)`), and `validateHierarchyChange`
  (mirrored in SQL) rejects cycles, self-parenting and excess depth with actionable errors.
* Attribution: `nova.attach_attribution(user_id, code, click_id, ip_hash, device)` — one confirmed
  attribution per user, protected by `guard_attribution_immutable()`.

## Friday settlement

| Setting | Env | Default |
| --- | --- | --- |
| Day of week | `AFFILIATE_SETTLEMENT_DAY` | `5` (Friday) |
| Hour / minute | `AFFILIATE_SETTLEMENT_HOUR`, `_MINUTE` | `0` / `0` |
| Timezone | `AFFILIATE_SETTLEMENT_TIMEZONE` | `Asia/Tehran` |
| Minimum payout | `AFFILIATE_MIN_PAYOUT_MINOR` | 5,000,000 |
| Period cutoff | the settlement window start | last Friday 00:00 in the configured zone |

`src/lib/timezone/index.ts` computes windows with `Intl` only (no hard-coded offsets), so
daylight-saving changes are handled by the platform tz database. `/api/v1/config` exposes the
schedule (`lastWindowEndsAt`, `nextWindowEndsAt`, `currentPeriodStart/End`, `localLabel`) and the
affiliate dashboard renders the same values — there is no second implementation of the schedule.

`nova.settle_affiliate_period(...)` is idempotent (unique on `(affiliate_id, period_end)`):
re-running a settlement for a closed period never doubles a commission or a payout. The pipeline is:

```
detect eligible users → compute commission per user (35 %) → apply model floor / carry-forward
  → write affiliate_ledger rows + affiliate_settlements (status/amount/period)
  → create payout when payable ≥ min payout (create_affiliate_payout, idempotency key)
  → notify the affiliate (queued; delivery requires a messaging provider)
```

## Payouts

`nova.affiliate_payouts` lifecycle:

```
requested → approved → processing → paid
                    ↘ rejected        ↘ failed
```

* A payout below the minimum (`AFFILIATE_MIN_PAYOUT_MINOR`, default 5,000,000) is not created: the
  balance is carried to the next period (`carry_forward` ledger entry), verified by
  `tests/unit/affiliate-commission.test.ts` ("below minimum → no payout, balance carried").
* `transition_affiliate_payout(...)` enforces legal transitions only; `guard_payout_no_double_pay()`
  refuses a second `paid` transition for the same payout.
* A payout can only reach `paid` with a `provider_reference` (a real transfer reference or a
  documented manual reference). Without a payment provider, payouts stay `approved`/`processing` —
  the platform does not pretend money moved.
* Dual approval is required above `DUAL_APPROVAL_THRESHOLD_AMOUNT`; self-approval is blocked
  (`SELF_APPROVAL_BLOCKED`) for wallet adjustments and payouts alike.
* Every state change writes to `nova.affiliate_audit_logs` and `nova.audit_logs`.

## Fraud and reconciliation

Signals (`nova.affiliate_fraud_flags`, `services.affiliate.fraudSignals`): self-referral patterns,
suspicious click/IP concentration, bonus abuse, mismatched settlement snapshots, unusual
device/campaign overlap. Each flag carries `severity`, `status`
(`open|reviewing|confirmed|dismissed`), evidence JSON and an operator resolution trail
(`/admin/affiliate-fraud`).

`nova.reconcile_financial_period(period_start, period_end)` performs six controls and writes one
row per check into `nova.reconciliation_records` (`passed`, `expected`, `actual`, `difference`):

1. wallet balance = ledger sum, 2. bet payouts = settlements, 3. affiliate payable = ledger,
4. ledger commission totals = settlement rows, 5. payouts ≤ payable, 6. no orphaned transactions.

The same six checks run in `/admin/reconciliation` on demand and can be scheduled by a cron worker;
a mismatch is reported, never auto-corrected by rewriting history.
