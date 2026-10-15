# SoftAggregator isolated PostgreSQL financial validation — 2026-10-16

## Scope and environment

- Supabase development branch: `betvima-casino-financial-staging-20261016`
  (project ref `ccpuaalgtjpkwiqsibvd`), created without production data.
- Operator-approved compute rate: USD 0.01344 per hour while the branch is running.
- The branch initially contained no `nova` schema. We restored the exact
  repository migration SQL for `0000`, `0001`, `0002`, `0010`, `0030`,
  and `0070`, plus the exact `user_limits` section of `0110`.
- Applied the original pending `0208` SoftAggregator receipts and the corrected
  `0209` immutable round-FX/rollback migration **only to that staging branch**.
- Verified all four relevant objects exist: `nova.wallets`,
  `nova.wallet_transactions`, `nova.softaggregator_callback_receipts`,
  `nova.softaggregator_round_fx`. The receipt and round tables have
  append-only triggers.

## SQL ledger tests performed

Using the authentic repository `nova.post_wallet_entry` PostgreSQL function,
in `BEGIN; ... ROLLBACK;` test transactions with fresh synthetic users:

1. IRT: funding 2,500,000 toman wallet units; a USD 0.20 stake debits
   50,000; a USD 0.40 win credits 100,000; a canceled USD 0.20 bet refunds
   exactly 50,000 original units. Wallet reconciles to 2,600,000.
2. USD: funding 1,000 USD cents; a 20-cent stake, 40-cent win and 20-cent
   original-value refund reconcile to 1,040 USD cents.
3. IRR: funding 25,000,000 rial units; the same stake, win and refund
   reconcile to 26,000,000 rial units at 250,000 IRT/USD.
4. Replayed idempotency keys return the original ledger result without a
   second debit. A second successful rollback of the same original debit
   is rejected by the database unique index.
5. Oversized debit below the wallet floor raises insufficient-balance and
   is rejected. Historical FX-round and Callback-receipt updates are
   denied by their triggers.
6. Each test finished with a database `ROLLBACK`. Verified afterward:
   **zero persisted staging wallet transactions, receipts and FX rounds**.

## Remaining release blockers

These tests validate database migrations, exact unit conversion and the wallet
RPC, **not** the entire provider-to-Android money flow. This staging branch
includes a subset of canonical core migrations rather than a full production
restore. We have **not** tested:

- An actual supplier-signed HMAC/MD5 real-money Callback from the provider's
  origin `85.122.129.59` with an isolated registered test player.
- An end-to-end real game `getGame`, balance, debit, winnings, reversal,
  free-spin credit and accounting reconciliation using the live provider.
- Peak simultaneous callback races across independent database connections.
- Production FX quote freshness, provider downtime and rate snapshot rollover.
- A separately reviewed/verified production migration/backup and release.

The financial feature remains off for all production users. A single-user
allowlist and audited-schema feature gates are present in backend code but
must not be activated until outstanding signed-callback and reconciliation
checks pass. Nothing in this staging validation changed production balances,
the production migration registry or production provider secrets.
