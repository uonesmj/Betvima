# BetVima casino identity review — existing support chat

## Customer journey (no new upload page)
- Customers use **the existing `/support` full-screen conversation**, with existing JPEG/PNG/WebP/PDF attachment upload (10 MB per regular support attachment).
- Customers explicitly consent in that same chat to processing the submitted ID for identity/legal-age verification. The support reviewer asks for supporting details in that same ticket; closing the popup does not create a new ticket.
- The old `/account/kyc` link redirects to `/support`. `GET /api/v1/account/kyc` continues to report server-side status to website and native clients. The legacy POST upload route rejects with `KYC_VIA_SUPPORT` instead of accepting a parallel new KYC queue.
- Games remain visible while waiting for review. Casino demo/paid launch endpoints are blocked until an authorized operator approves identity and legal age.
- After a successful review, approval is retained on account once and the casino catalogue refreshes status automatically. Real-money play is **separately** restricted by jurisdiction, supplier and financial readiness, real-money user allowlist, kill switch and wallet guard.

## Support administrator workflow
1. Customer uploads a document directly in the existing ticket and explicitly consents in chat.
2. Operator with **both `support.view` and `users.kyc`** permissions, enrolled and verified MFA, opens the same chat in `/admin/support`, views the user-uploaded attachment and checks authenticity and legal gambling age.
3. In the ticket's **Identity review** section, operator selects the customer's document, declares consent and age were checked, records the reason, then confirms approval.
4. Server verifies the attachment belongs to a **user-authored message in that exact ticket**, validates MIME, magic bytes, size <=8 MB and private bucket path, and privately copies it into the `betvima-kyc` bucket. Approval and audit update are committed transactionally; failed writes delete the duplicate copy.
5. Existing support chat and in-app notifications report approval back to the user, using the original ticket link. Never create a new ticket just to verify identity.
6. Only explicit approved `nova.kyc_submissions` records with a reviewer and verified age satisfy the server's identity check. User-uploaded documents or support messages alone never grant access.

## Security and deployment prerequisites
- The existing private `support-attachments` Storage bucket is used for customer submissions. Restrict staff access and retention of identity documents as applicable; sensitive IDs should not be shared beyond authorized staff.
- **Migration `0215_support_attachment_private_metadata.sql` is mandatory**: the pre-existing `public.ticket_attachments` metadata had no RLS and was granted client Data API privileges. The migration enables RLS and revokes all direct anon/authenticated table permissions. The support review POST fails closed until this is installed. The main server-side support API uses privileged database access.
- Migration `0214_casino_kyc_review.sql` supplies the reviewed-only KYC table and private `betvima-kyc` bucket.
- Run isolated SQL smoke tests, verify a **fresh restorable production backup**, apply the migration through the reviewed process and register SHA-256 as non-baseline in `nova.migrations` before attempting the protected production deploy.
- Run full unit/typecheck/lint/build CI and release the web app only using the owner-signed GitHub production workflow. Main push only builds Preview. Do not modify odds, bets, settlement or payout workers.
- Verify: existing support upload and download works; no public Data API can modify attachment metadata; ordinary staff without `users.kyc` cannot approve; incorrect/cross-ticket/support-agent attachment denied; consent and age required; staff review audit; no duplicate approval; existing support reply notification; casino demo locked before and allowed after KYC approval.
- Establish document retention, private storage encryption, download auditing and scheduled purge per applicable obligations before accepting sensitive documents at scale.

**Identity approval never enables real-money games by itself.** Keep independent legal, location, provider-signed callback, reconciliation and funds controls.
