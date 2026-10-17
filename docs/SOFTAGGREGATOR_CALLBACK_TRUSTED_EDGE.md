# SoftAggregator cash pilot — trusted callback ingress (not yet deployed)

Source of truth: https://softaggregator.com/docs.html (wallet callbacks). The vendor
documents a GET callback with `key=MD5(timestamp + salt)` and a 30-second tolerance.
That signature authenticates only the timestamp, not the amount, round or user.
The BetVima balance/debit/credit callback therefore needs an additional authenticated
transport before real currency can move.

## Staged solution: independent signed Cloudflare ingress

- `ops/cloudflare/softaggregator-callback-worker.js` is a **template**, not a deployed Worker.
  Configure it for a **dedicated** route `betvima.com/api/webhooks/softaggregator*`
  and ensure it never overlaps with or displaces the existing geo-attestation Worker.
- Require the vendor to **confirm its callback egress IP addresses in writing**.
  Populate Worker private configuration `SOFTAGGREGATOR_CALLBACK_ALLOWED_IPS` with
  those **exact addresses**, never guesses, arbitrary CIDR ranges or `*`.
  Verify that the callback actually originates from these addresses.
- Create an independently generated 32+ byte `SOFTAGGREGATOR_EDGE_HMAC_SECRET`
  in Cloudflare Worker secrets and separately in the backend's protected runtime.
  This is **not** the vendor `salt_key` or its API password.
- The Worker accepts only source-IP-admitted GET callbacks, strips any client
  `X-Signature`, signs an unambiguous canonical representation of ALL query
  parameters with HMAC-SHA256, and forwards to the backend.
- The backend verifies both the supplier's MD5 timestamp key and independent
  full-payload HMAC in constant time, rejecting everything else.
- Prevent clients from reaching the origin directly or bypassing the Cloudflare
  route, using authenticated origin pulls, Cloudflare Tunnel and/or firewall
  policy. Disable publicly exposed preview/secondary callback routes.
  Check that no other Worker can manipulate authenticated source IP headers.
  Protect backend secrets and rotate any previously exposed vendor credentials.
- Do not assume a passing local synthetic signature test is proof of an
  authenticated vendor-origin message.

## Runtime gates (never commit values)

Only **after** the dedicated Worker, origin isolation, vendor IP confirmation,
supplier-generated conformance test and secure key provisioning:

- `SOFTAGGREGATOR_EDGE_HMAC_SECRET`: same private 32+ byte secret at backend.
- `SOFTAGGREGATOR_CALLBACK_EDGE_READY=true`: operator attests that source
  authentication, full payload signing and origin isolation were validated.
- Keep existing controls: `SOFTAGGREGATOR_ENABLED`,
  `SOFTAGGREGATOR_REAL_MONEY_ENABLED`,
  `SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY`,
  `SOFTAGGREGATOR_SALT_KEY`,
  `SOFTAGGREGATOR_TEST_USER_ID` and explicit permitted countries.
  Do not enable cash flags before all prerequisites pass.

The backend now refuses real-money mode when the edge readiness attestation or
separate signing secret is absent. Catalogue and demo remain available with
their previous configuration.

## Account-specific eligibility

- Use a single existing dedicated pilot user. Assign the account's UUID to
  `SOFTAGGREGATOR_TEST_USER_ID` privately, **not in a public file or PR**.
- Confirm active account, actual adult age verification, eligibility and
  independently verified present country and operator authorization. A provider
  saying it does not collect player KYC does not verify the operator's own duties.
  Do not mark `kyc_status='verified'` or invent a `jurisdiction` solely to
  satisfy code checks. If identity verification is not required for the
  authorized territory, document a lawful alternative risk/eligibility control
  in a separately reviewed change.
- Existing pilot caps are casino-only: $1 per stake, $5 daily stake total,
  $3 daily net loss and $5 weekly net loss. No sportsbook limits are changed.
- First use a strictly isolated test wallet/database with no real user deposits.
  Confirm legitimate supplier-origin balance, debit, credit, rollback, free
  spins, repeated IDs, changed-amount replay and concurrent request handling.
- Reconcile `getPlayerHistory`, immutable casino receipts and actual wallet
  journal movements with no discrepancy. Back up and test rollback before
  any customer-fund pilot. Do not go public until approved and recorded.

## Remaining external dependencies

1. SoftAggregator-supplied verified callback IPs, samples and current live
   integration behavior, rather than locally synthesized signatures.
2. Operator access to Cloudflare and protected production server settings.
3. Evidence of permitted territories/operator authority and the selected
   pilot account's actual country and eligibility.
4. Real provider-to-wallet monetary rehearsal, supplier-history reconciliation,
   verified restorable backup and production deployment controls.

**This document and its code do not activate cash play.**
