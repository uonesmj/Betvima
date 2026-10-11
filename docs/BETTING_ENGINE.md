# Betting engine

## Placement (`nova.place_bet`)

`POST /api/v1/bets` never calculates anything financial. It forwards the selection ids, a client
odds snapshot (`clientOddsScaled`, `marketVersion`) and an idempotency key to `nova.place_bet`,
which runs inside one transaction:

1. **Idempotency** — the key is stored; a replay returns the original bet with `idempotent_replay`.
2. **Server-side odds authority** — the authoritative odds always come from `nova.selections`.
   The client value is only used to *detect* a change. Freshness windows are enforced
   (`p_prematch_max_age_seconds` 45 s, `p_live_max_age_seconds` 12 s).
3. **Odds change** — if any leg moved, placement fails with `ODDS_CHANGED` and returns the
   `old → new` diff plus a `quoteToken`. The bet is only placed when the client re-submits with
   `acceptOddsChange: true` and the accepted odds. Silent replacement is impossible.
4. **Market gates** — a market must be `open`, its match not `suspended`/`finished`, the operation
   switch `BETTING` on, and the outcome not already determined. Anything else is a typed error
   (`MARKET_SUSPENDED`, `ODDS_EXPIRED`, `OPERATION_DISABLED`, …).
5. **Risk engine** — rules are evaluated on stake, stake patterns, odds, and account state; the
   decision is one of `ALLOW`, `LIMIT`, `REJECT` or `MANUAL_REVIEW` (`nova.risk_decision`).
   `MANUAL_REVIEW` places the bet in `manual_review` and freezes settlement until an operator
   decides; `LIMIT` clamps the stake to the allowed maximum (the client is told the clamp, it is
   never applied silently).
6. **Money** — the stake is debited through `nova.post_wallet_entry` (`bet_debit`, floor 0), the
   bet row and legs are written, and an audit event records the actor, ip hash and correlation id.
7. **Response** — `{ ok, bet, wallet_balance_minor }`; the caller learns the new balance from the
   database, not from arithmetic.

Stake limits are checked server-side, never in the client:

* `nova.risk_rules` — global (optionally currency-scoped) `min_stake`, `max_stake` and `max_payout`
  rules, defaulting to 10,000 / 500,000,000 / 2,000,000,000 minor units when no rule row exists;
  `place_bet` reads them inside the same transaction as the debit.
* `nova.user_limits` — per-user `max_stake_per_bet_minor`, `max_stake_per_day_minor` and the
  deposit/loss limits, applied by the risk engine as additional caps.
* `DUAL_APPROVAL_THRESHOLD_AMOUNT` — wallet adjustments above it need a second administrator.

## Settlement (`nova.settle_bet`)

Settlement is **automatic by default**:

```
match result recorded (operator UI or provider feed)
  → nova.enqueue_match_settlement(match_id, reason)      -- one job per open bet
  → settlement worker claims job (nova.claim_settlement_jobs)
  → grading per leg → bet status → payout → wallet credit → ledger → audit → affiliate commission
  → nova.complete_settlement_job(done | manual_review | skipped | failed)
```

Grading rules (`src/domain/settlement-grading.ts`, mirrored by the SQL functions):

| Leg outcome | Multiplier applied to odds |
| --- | --- |
| `WON` | full odds |
| `HALF_WON` | `(odds + 1) / 2` |
| `VOID` | 1 (stake returned) |
| `HALF_LOST` | ½ (half the stake is lost) |
| `LOST` | 0 |

Combinations: any `LOST` → bet `LOST` (payout 0); all `VOID` → `VOID` with the full stake refunded;
any `HALF_*` → `partially_settled` with a recalculated payout. Payout uses integer maths only:
`round_div(stake × Π odds, 10000^n)`. Draw-no-bet, totals, handicaps, both-teams-to-score and 1X2
are expressed by the market rules in `src/domain/market-rules.ts` so grading is data-driven, not
hard-coded per market name.

Manual settlement is available to authorised roles (`bets.settle`) through
`POST /api/v1/admin/bets/[id]/settle` and writes `nova.manual_settle_decision` with the operator id,
reason and correlation id. Automatic and manual settlement cannot both apply: the settlement row is
unique per bet and revision.

## Regrade

`POST /api/v1/admin/bets/[id]/regrade` inserts a **new settlement revision**:

1. The previous settlement is reversed (`nova.reverse_bet_settlement`) — a ledger reversal entry is
   posted, the balance returns to its pre-settlement value, and the original ledger row is untouched.
2. The bet is re-graded against the corrected result and settled again.
3. `nova.bet_settlements` keeps every revision (`revision`, `reversal_of`, `reversed_by`,
   `kind`, `net_user_result_minor`), so the full history is auditable forever.

Double payouts are impossible: `guard_bet_settlement_mutation()` blocks updates,
`guard_payout_no_double_pay()` blocks paying a payout twice, and the reversal is idempotent.

## Cash-out

`POST /api/v1/bets/[id]/cashout` → quote → accept:

* `nova.cashout_quote(bet_id, user_id, margin_bps, ttl_seconds)` returns a quote that is **not**
  clamped to the potential payout, with an expiry and a single-use `quote_id`.
* `nova.accept_cashout(bet_id, quote_id, user_id, idempotency_key)` credits `cashout` exactly once.
  A replay returns `idempotent_replay`; an expired quote fails with `ODDS_EXPIRED`;
  an accepted quote cannot be reused.

Verified in the integration suite: quote `237,500` on a live single, accept → `537,500` balance,
replay → no second credit, reused quote → refused.

## Cash-out and live betting gates

`NEXT_PUBLIC_FLAG_CASHOUT`, `NEXT_PUBLIC_FLAG_LIVE_BETTING` and the DB operation switches
(`BETTING`, `CASHOUT`, `LIVE_BETTING`) must both allow the feature; the UI hides what the server
will refuse, and the server refuses regardless of what the UI showed.
