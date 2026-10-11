# Wallet and ledger

## Invariants

1. **One mutation path.** `nova.post_wallet_entry(...)` is the only function that changes
   `nova.wallets.balance_minor`. It writes a `nova.wallet_transactions` row (the immutable ledger),
   updates the wallet row, and refuses anything that would break the rules below. Every other
   function (`place_bet`, `settle_bet`, `accept_cashout`, `credit_wallet`, `debit_wallet`,
   `admin_adjust_wallet`, `refund`) calls it.
2. **Balance = ledger sum.** `scripts/db-verify.sh` asserts
   `wallets.balance_minor = Σ posted wallet_transactions.amount_minor` for every wallet; the
   `/api/health` deep check reports `ledger_integrity` using the same predicate.
3. **Idempotency.** Every entry carries an `idempotency_key`; a repeated call with the same key
   returns the original entry with `idempotent_replay = true` and never applies money twice.
4. **No floating point.** Authoritative amounts are `bigint` minor units in PostgreSQL and
   `bigint` in TypeScript. Money crosses the HTTP boundary as **decimal strings**; the JSON
   serializer converts bigints to strings, so no `.5`-style rounding error can ever appear.
5. **History is append-only.** Ledger rows are protected by `nova.prevent_mutation()` /
   `nova.prevent_delete_only()` triggers. Corrections are *reversals*: a new row referencing the
   original (`reversal_of` / `reversed_by`), never an edit.
6. **No negative balances from betting.** `debit_wallet` takes `p_balance_floor` (default `0`); a
   bet cannot push a wallet below zero. The single exception is an explicit admin debit adjustment
   whose direction is `debit` and which still uses floor zero for customers.

## Entry types

`deposit, withdrawal, withdrawal_hold, withdrawal_release, bet_debit, bet_refund, win_credit,
void_refund, bonus, adjustment, reversal, affiliate_payout, cashout` (mirrors
`nova.wallet_tx_type`, and the same list exists in `src/lib/types/wallet.ts`).

Statuses: `posted, pending, reversed, failed`. Only `posted` rows count towards the balance.

## Money arithmetic

| Concept | Representation | Rule |
| --- | --- | --- |
| Currency | `IRT`, `IRR`, `USD`, `EUR` | Per-wallet currency; the platform never mixes currencies in one balance |
| Amount | minor units (`bigint`) | IRT/IRR 1 rial = 1 minor unit; USD/EUR cents |
| Odds | scaled integer, `10000 = 1.00` | Decimal odds only; `21000` = 2.10 |
| Payout | `round_div(stake × Π odds_scaled, 10000^(legs))` | HALF_UP, computed in SQL numeric and mirrored in `src/domain/money.ts` |
| Commission | `apply_bps(amount, bps)` | Basis points, rounded HALF_UP, never `float` |
| Display | `formatMinor()` | Locale-aware (`fa-IR` / `en-US`), grouped digits, never used for maths |

## Example (verified by integration tests)

```
deposit 1,000,000 → bet 200,000 @ 2.10 (single) → win
  balance 1,000,000
  bet_debit        −200,000   → 800,000
  win_credit       +420,000   → 1,220,000     (payout 420,000 = round_div(200000×21000, 10000))
```
