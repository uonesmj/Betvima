# BetVima casino identity review — safe rollout

## Customer experience
- A registered user may view the casino catalogue and use existing wallet/deposit flows.
- `Settings → Identity verification` uploads an ID scan (JPEG, PNG, WebP or PDF, max 8 MB) and optionally a selfie.
- The customer sees pending, approved or rejected with a review reason if rejected.
- Until approved, all game launch APIs (demo and paid) refuse the request; casino catalogue stays visible.
- When approved, only the identity/age condition is satisfied. **Approving KYC does not enable real-money casino, bypass provider test-account allowlist, jurisdiction rules, financial-readiness requirements or launch switches.**

## Operator workflow
- `/admin/kyc` shows pending submissions. Only administrators with `users.kyc` may list or review.
- Private Supabase Storage objects are downloaded by a 60-second signed link issued after RBAC.
- Each decision records an operator ID, explanation and age-check confirmation in a transaction with the account flags and audit.
- The legacy direct `set_kyc` mutation on the generic user administration route is removed to prevent flag-only approval.

## Deployment sequence — required
1. Review operator authorization and applicable jurisdiction, age, identity, privacy and document-retention requirements.
2. Verify a fresh **restorable** production database backup before any database change.
3. Verify `0214_casino_kyc_review.sql` schema in an isolated database, then apply through the approved migration process. Ensure the **private** storage bucket `betvima-kyc` exists and `public=false`. Confirm **no** `anon`/`authenticated` grants or storage policies.
4. Ensure deployed Nginx limits only the exact `/api/v1/account/kyc` route to 17 MB for up to two documents (existing general API remains at 8 MB).
5. Deploy application code only after the table and private bucket are confirmed, then test: user uploads actual ID; user sees pending; non-admin can't read another user's docs; admin opens restricted signed URL and marks approved with age confirmed; casino demo is blocked before and allowed after; rejected files can be resubmitted; user can still deposit. Verify no customer-submitted storage paths or public URLs exist.
6. Confirm correct retention policy, scheduled purge, encrypted storage, access and download logs and a documented deletion process before accepting production identity data.
7. Keep live real-money casino in its existing independently gated pilot state. Follow `docs/CASINO_REAL_MONEY_RELEASE_GATE_20261016.md` before cash movement.

Do **not** run this database migration as a side effect of a PR merge or bypass the independent production release workflow.
