# BetVima closed casino pilot (up to 20 selected accounts)

This is **code preparation only**, NOT an authorization or instruction to activate real-money gaming. The production default remains **OFF**. The casino demo and sportsbook behavior are unchanged.

## Scope

BetVima is a limited prelaunch integration site. The intended pilot is 1–20 individually authorized existing accounts; afterward any migration to a separate primary site requires its own supplier credentials, callback domain/edge trust and financial signoff. No unrestricted public enrollment is supported.

`casinoRealMoneyUserAllowed` accepts either `SOFTAGGREGATOR_TEST_USER_ID` (legacy, one UUID), OR `SOFTAGGREGATOR_PILOT_USER_IDS` (1–20 comma-separated full UUIDs). Both simultaneously configured, duplicate IDs, invalid entries, trailing commas, wildcards, and more than 20 entries all deny **every** real-money request. Do not publish tester IDs. Never put credentials, player IDs, or wallet balances in GitHub.

## Existing independent gates remain mandatory

- The entire real-money environment is OFF unless `SOFTAGGREGATOR_ENABLED`, `SOFTAGGREGATOR_REAL_MONEY_ENABLED`, `SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY` and callback-edge readiness, unique private vendor salt, and independent >=32-byte HMAC secret are satisfied.
- Each selected user still requires actual approved age/KYC evidence, active unrestricted account, non-frozen wallet, independently verified current location, and explicit authorized country configuration.
- Callback settlement must be separately verified with authentic supplier-origin HMAC proof and edge attestation; a successful demo, sports bet, or database schema audit is NOT proof.
- Respect wallet audit, exact-once receipt journaling, immutable FX, rollback protection and per-player stake/loss limits. Keep existing independent migration/backup/prod owner-release controls.

## Required prelaunch verification

Before allowing a cash player, obtain actual supported jurisdictions and required legal authorization, verify supplier-specific private credentials and inbound callback IPs, confirm signed provider debit/credit/rollback against an isolated eligible test wallet, reconcile immutable local receipts and wallet journals to provider history, test repeats and replay rejection, and document approval. Start with **one** eligible pilot account, then gradually add a limited number of approved accounts **only after** successful signed cash round and verified reconciliation.

A merged pull request changes only the *allowlist reader*. It does not create a wallet, deposit money, set any server flags, provision secrets, grant permission or deploy a version. No public activation from this document.
