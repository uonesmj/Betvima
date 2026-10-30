# Ireland callback relocation — staging gate, not production

Validated 2026-10-30: the active Supabase Postgres project is in **eu-west-1**, but live casino callbacks currently run on the original VPS and connect to shared transaction pooler 6543. Measured VPS DB RTT 188–221 ms; measured actual V4 USD Debit settlement 3200.1/3670.1/4386.9 ms. Existing Supabase `betvima-debit-eu-canary` is strictly read-only and MUST NOT receive real callbacks.

## Selected migration path
Run the exact audited Next.js callback source as an isolated Node service on a **second private VPS in AWS eu-west-1 (Ireland)**, in preference to a fresh Deno port of money-handling transaction code. A country-local VPS is necessary; keeping the existing VPS public website and Android app unchanged. Both original and Ireland service connect to the same existing PostgreSQL wallet and ledger; never clone wallets, create a second authoritative ledger, or run migrations.

1. Create a private Ireland VPS (Ubuntu 24.04, >=2 vCPU, >=4 GiB RAM, >=40 GiB disk, public SSH restricted to operator; do NOT open HTTP 3129 publicly).
2. From the exact **running 3098 release**, stage a root-only, secret-free source/runtime archive of the previously tested isolated V4 candidate BUILD_ID `22bm4qdwFjO8ccemAMDIn`. Pin and compare V3 wallet and V4 timing route SHA256. Do not copy dev-branch `pilot-limits.ts` because it has different caps from production.
3. Transfer over verified SSH directly to Ireland. Install exact lockfile dependencies using Node >=20.9 (prefer Node 22), with a non-login service account. Never put DB passwords in source tarballs or GitHub.
4. Keep Ireland application **loopback only**. Provision secrets separately via protected root-only deployment on Ireland (use approved secure channel, not shell echo or command-line parameters); run local unsigned rejection and DB RTT read-only tests. Do not start live financial callbacks until full source parity and all policy, signature, concurrency/idempotency tests pass.
5. Create an authenticated private tunnel (e.g. SSH/WireGuard) original VPS <-> Ireland VPS; protect it against outside access. Measure network RTT, PostgreSQL RTT in Ireland, and exact signed callback response timing. No production routing at this stage.
6. Preinstall and independently verify rollback timer before routing a limited, owner-authorized pilot. Switch ONLY the existing SoftAggregator callback Nginx location under an atomic config backup with `nginx -t`. Never simultaneously process an unacknowledged financial callback at both endpoints or implement unsafe automatic request retry/fallback. Preserve transaction lock order and immutable receipts. Stop candidate only after draining in-flight requests.
7. Verify signed Debit, Credit, Balance, Rollback parity; duplicate call-id idempotency; frozen balance; user limits; geo/age/KYC; ledger receipt reconciliation; and p50/p95. Revert on any discrepancy.

## Status
**STARTED — preparing private source bundle; target VPS not yet provisioned; production callback still 3098.** No secrets, database writes or migrations, Nginx cutover, background jobs, or new billed resources have been created by this preparatory work. No claim that signed real money processing moved to Ireland.

Deployment must remain fail-closed if any source manifest or connectivity checks fail. Existing Edge read-only canary stays unchanged.
