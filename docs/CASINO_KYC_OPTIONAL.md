# Casino-specific KYC / support review — temporarily optional

Status: **not required by default**.

This change removes casino-specific mandatory document collection and support
approval from the user-facing game flow. No request to upload ID or to contact
support is presented before browsing or launching sandbox demos.

## Runtime switch

`SOFTAGGREGATOR_SUPPORT_REVIEW_REQUIRED`:

- **Unset or `false` (default):** do not require manual support review for
  casino launches or new wallet debits. The dormant admin review UI and write
  endpoint are disabled, but existing records are retained for future use.
- **`true`:** the existing support-reviewed approval gate returns, subject to
  authorized staff action and the stored review state.

The switch does **not** change the independent safeguards for wagering: legal-age
clearance, account restrictions, self-exclusion, licensed territory/verified
location, wallet settlement integrity, single-pilot limits, and explicit
real-money provider enablement. An age attestation at signup is not
automatically equivalent to the stronger legal-age verification a regulator
may require for real-money gaming.

## Rollout

Deploy the updated application through the normal audited CI/release process.
Do **not** set `SOFTAGGREGATOR_REAL_MONEY_ENABLED=true` as part of this change;
real-money play remains subject to separate regulatory and operational release
checks, supplier-origin callback and history reconciliation.

The previously created private
`nova.casino_support_approvals` table is retained; it is not used as a
mandatory casino access requirement while the switch is off. Preserving the
table permits later opt-in without erasing evidence or database history.

Existing optional, general account KYC pages remain separate from casino
access and may still be required for financial transactions where applicable.
