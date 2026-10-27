# Casino operator identity approval — documents held outside BetVima

## Operator workflow
1. A new user registers with an account on BetVima.
2. The customer independently sends identity documents to the operator over the chosen channel. BetVima does not fetch any Telegram messages or receive document bytes.
3. Operator verifies **legal age**, ID authenticity, document-to-account link, local jurisdiction, restrictions and consent. Operator keeps the documents securely **outside** BetVima, organized by the customer's **Public ID** (the admin form displays this value). Implement an explicit retention and deletion policy.
4. Admin with MFA and `users.kyc` permission opens **Customers → Casino approvals**, chooses the actual document type, and presses **Approve casino**. A confirmation explicitly attests to identity, age, consent and external custody.
5. The server records an `external_custody` KYC submission with `document_path=NULL`, the operator ID and UTC review time. An opaque Public ID, not a Telegram handle or ID number, links the operator's external record. An audit event records the decision and updates the existing protected profile status.
6. The admin view can display existing private documents (legacy KYC) but external-custody records have no download link.

## Security
- No image, passport number, Telegram URL, content, account password or file path is stored by this flow.
- There is **no bypass** of KYC or legal-age verification: the authorized operator is responsible for completing the actual review before clicking. A checkbox, click or metadata field cannot itself establish adulthood.
- Approving identity alone does **not** activate casino release flags, countries or pilot user allowlists, or alter wallet, sportsbook, settlement or callback logic.
- Existing verified KYC users and previously uploaded private KYC records are unchanged.
- Required one-time schema migration adds `evidence_source`, `external_evidence_reference`, and makes `document_path` nullable while enforcing check constraints. Client roles have no access to the KYC table.
- The client sends only JSON with document type and mandatory human attestation booleans; backend verifies MFA, role permission, origin, user eligibility, serializes approvals and records the audit atomically.

## Rollout (not automatic)
1. Obtain database backup and review operator legal and record-retention requirements, including whether external document custody is lawful in every authorized territory.
2. Run migration `supabase/migrations/0219_casino_kyc_external_custody.sql` on staging, inspect privacy/RLS, test an external approval and old private-upload approvals. Apply to production **before** deploying the matching app build, with recoverable backup.
3. Run TypeScript, unit tests and build in CI.
4. Deploy Next.js through the existing approved workflow, test new users, existing KYC, admin MFA, duplicate click, current location and live access.
5. Independently inspect the live **VPS port 3098** casino service. The active financial code is not in current GitHub `main`; it may require changes if it assumes KYC document path is non-null. Do not assert cash-game launch works until checked in a legally compliant test.
6. No Telegram bot or automatic sync is built; documents remain operator-managed and outside app.

Migration/deployment must **not** be inferred from merging source code alone.
