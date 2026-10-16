# BetVima — production casino cash readiness audit

This is a **read-only verification step**, not a casino enablement instruction.
The canonical financial migrations `0208`–`0212` were installed on
2026-10-16 and merged into `main` in PR #126. The existing CI includes
synthetic HMAC/HTTP/PostgreSQL wallet debit, credit, refund, replay,
concurrency and loss-limit tests. Those tests do **not** prove a real
SoftAggregator-origin transaction or an operator's legal authorization.

## Run on an authorized backend host

With the existing private backend DB settings already provisioned:

```bash
npm run casino:readiness
```

The command does not call the provider, touch accounts, start a game, send a
callback, set feature flags, or mutate the database. It reads:

- Five canonical migration checksums and non-baseline application records.
- The actual schema's RLS, audit triggers, rollback constraints and indexes.
- All posted wallet-journal totals versus stored balances.
- Successful SoftAggregator receipts versus their matching native ledger
  entries and immutable per-round currency.
- Presence **only**, not values, of runtime credentials, callback/edge
  signing keys, explicit country list and the single pilot ID.

The output is a single JSON object with aggregate counts and statuses. No
wallet balance, player ID, provider credentials, salts, session links or
signature payloads appear.

**Exit codes:** `1` = a technical gate failed or unavailable;
`2` = automated checks passed but external proof remains outstanding.
The script intentionally **never returns public launch approval**; a process
cannot derive supplier provenance, regulatory permission or Cloudflare
deployment from database row counts or presence of environment variables.

## Mandatory independently witnessed tests

1. Rotate old provider credentials and signing salt **through the vendor**;
   provision only private host/edge secrets. Do not send them to GitHub or
   support chat. Confirm inbound callback source IP with the supplier.
2. Confirm the SoftAggregator GET callback format against their official
   contract and from **real supplier-generated signed traffic**:
   `timestamp` / `key=MD5(timestamp+salt)` and `X-Signature` HMAC-SHA256
   over sorted decoded query fields. Do not mistake self-signed fixtures for
   genuine supplier-origin callbacks. The documented supplier endpoint is
   `https://softaggregator.com/docs.html`.
3. On an isolated/sandbox test player and non-production cash ledger:
   balance, minimum permitted debit, insufficient funds, credit/free-spin
   credit, exact rollback of debit, exact reversal of win, duplicate ID,
   amount-changing replay, concurrent distinct IDs, and timeout/retry.
4. Reconcile `getPlayerHistory` **all pages**, per-game/per-round USD cents,
   against receipt rows and their native-currency ledger entries with
   `npm run casino:reconcile` (read-only). The existing reconciler exits
   nonzero on missing, mismatched, rolled-back, unsettled or orphan rounds.
   Never repair financial rows automatically.
5. Deploy the Cloudflare geolocation Worker with matching private backend
   HMAC secret, restrict origin access, test trusted metadata and
   missing/forged/stale/replayed signatures. A repository source file is
   **not** a deployed Worker. Check actual KYC, age, responsible-gaming and
   jurisdictional restrictions in approved markets.
6. Obtain independent confirmation of legal operating authority for each
   permitted location and retain the evidence outside this repository.
   SoftAggregator game availability and an API country parameter do not
   constitute that confirmation.
7. After all prior items, review the release with a verified, restorable
   production backup, a single-user authorized pilot, supplier settlement
   reconciliation and explicit final approval. Keep public real-money
   wagering disabled until then.

## What has not been done by this audit

- No production VPS/Cloudflare secret changes.
- No direct supplier callback delivery or live transfer.
- No licensing determination.
- No `SOFTAGGREGATOR_REAL_MONEY_ENABLED` configuration change.
- No public Android or real-money casino activation.
