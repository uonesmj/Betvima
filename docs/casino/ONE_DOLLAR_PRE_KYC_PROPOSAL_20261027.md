# BetVima casino — provisional cumulative US$1 cap (not for production)

This branch is an **inactive source-code proposal** based on the older, isolated
`codex/casino-prekyc-10usd-controlled-20261017` branch. It is **not** the
deployed callback server or current `main`. It does **not** activate new
accounts, remove mandatory identity checks, enable a provider, change wallet
balances, or deploy Nginx, Android or Supabase configuration.

## Intended rule where independently confirmed lawful

- The **lifetime aggregate stakes** on casino games before completed KYC
  must not exceed 100 USD cents across all games and supported native wallet
  currencies. This is a sum of original successful debits, NOT available
  balance, net loss, a one-dollar deposit, or a per-session allowance.
- At 80 cents consumed, at most 20 cents remain. A 21-cent next stake must
  fail, not partially debit. At exactly $1.00, further wagering is denied
  until valid identity approval. Successful credits/refunds remain payable
  and do not restore wagering allowance.
- All checks belong on the signed supplier **financial callback path**,
  inside the existing serialized transaction, never only in the UI.
  Existing per-user pre-KYC advisory lock must be retained.
- The previous feature's separate jurisdiction allowlist and existing age,
  verified location, operator-authorization, sanctions/responsible-gaming,
  binding/FX, limits and wallet-integrity gates must stay in place.
- A new independent `SOFTAGGREGATOR_PRE_KYC_LEGAL_APPROVAL=true` attestation
  is required in addition to the already off-by-default
  `SOFTAGGREGATOR_PRE_KYC_ENABLED=true` and an explicit jurisdiction allowlist.
  **Never enable any of these** without independent, documented authorization
  that identity verification may lawfully be deferred for the applicable
  territory. Where KYC is legally required **before the first wager**, the
  provisional real-money route must remain DISABLED.

## Preconditions before any deployment

1. Determine the actual authorized operating jurisdictions and applicable
   first-wager KYC/age rules, and record externally reviewed evidence.
2. Verify authoritative age, user uniqueness, fraud/duplicate registration,
   geolocation and account restrictions. A new registration by itself never
   establishes adulthood or suitability for real-money play.
3. Rebase this proposal onto the exact fingerprinted live server source.
   Current `main` no longer contains this financial callback backend, and
   earlier audit reported deployed 3098 source differing from GitHub.
4. Add a server-authoritative newly-registered-user cohort rule rather than
   treating all historical unverified accounts as newly registered.
5. Preserve the isolated one-user pilot until independent production approval.
   This branch explicitly does NOT unlock every registered user.
6. Complete signed genuine supplier callback and test-wallet trials for
   first wager, concurrent $0.60 wagers, boundary $1.00, $1.01, rollback,
   timeout, stale profile, account switch, and race-safe ledger reconciliation.
7. Verify transaction accounting, deployment rollback and restore-able backups.

Changes here are **not** evidence of regulatory permission and do not authorize
unlicensed casino operations.
