# BetVima Stage 8B — isolated Ireland database, real wallet RPC (2026-10-31)

## Billing / isolation
- Cost approval explicitly granted by owner: $0.01344/hour.
- Created Supabase branch `betvima-casino-stage8b-finance-isolated`, **project ref `qrirgzvxpjhhwvyazvpn`**, org Uoni, without copied production data. Main production ref `mqygiufkubxxxjodsycu` never receives synthetic financial writes.
- Important: automatic branch build reported **`MIGRATIONS_FAILED`**, so this branch is *not* a full copy of production schema or a promotable production migration. Instead, installed original pinned migration subset from commit `9d0476a619e81b5b78f612d401eb6e35758dc19c`: `0001`, `0010`, `0030`, `0070`, and `0208`–`0212`, directly on the isolated branch. Migration status must be resolved before full production parity testing.
- Initially `auth.users`, profiles, wallets, ledger all contained zero rows.
- Created exactly one synthetic *nonlogin* identity `00000000-0000-0000-0000-0000000088b1`, with no email/password or KYC approval, one matching synthetic profile, and a USD wallet funded via original `nova.post_wallet_entry` for exactly 1000 minor units.

## Real staging PostgreSQL evidence (connector executed; VERIFIED)
- Branch-only `public.stage8b_synthetic_financial_round(p_nonce text)` SECURITY DEFINER function, accepts only a strict hex nonce; all user, currency, and transaction amounts are fixed in code. Source archived in `scripts/stage8b/staging_only_real_wallet_rehearsal.sql`; **never apply to production**.
- Executes original `nova.post_wallet_entry` for debit -25, win credit +40, refund +25, reverse win -40; posts four coherent ledger-backed SoftAggregator-shaped synthetic receipts validated by all four integrity/immutability triggers, including round FX wallet binding. Zero provider callbacks actually sent.
- First call using the fixed `bbbb...` nonce succeeded: DB transaction 17.060 ms total, per RPC debit 2.956 ms, credit 0.695 ms, refund 0.715 ms, reverse win 0.738 ms, four ledger rows, four receipts, final balance 1000 minor units.
- Replay of identical nonce succeeded with four idempotent replays, DB total 10.505 ms and no new ledger/receipt rows.
- Independent SELECT confirmed `auth_users=1`, `profiles=1`, `wallets=1`, `wallet_ledger=5` including seed, `receipts=4`, `balance_minor=1000`. `anon` and `authenticated` cannot execute branch test RPC, `service_role` can; four receipt triggers enabled.

## Stage8B Edge function (deployed; signed VPS test PENDING)
- `betvima-eu-casino-stage8b-real-finance` ACTIVE v1 deployed **only on branch** `qrirgzvxpjhhwvyazvpn`, with `verify_jwt=false` specifically because it enforces the existing pinned Ed25519 signed synthetic marker and <=30 sec timestamp before any work. The body accepts no user/amount/provider fields. This is NOT an open financial API.
- Before server-side service role use, its code requires the runtime `SUPABASE_URL` origin to match **exactly the branch**. PostgREST RPC calls are sent to hardcoded branch URL. Any missing/wrong branch credentials fail closed. It never targets production project.
- Normal finance response advertises `staging_financial_rpc_executed=true`, `production_project_used=false`, `production_financial_operations_enabled=false`; returns server-side `rpc_e2e_ms` and DB phase durations.
- VPS script `scripts/stage8b/stage8b-signed-preload.cjs` is an isolated test-only wrapper around the existing signed Stage7 Node client, redirecting ONLY its exact test endpoint to branch Stage8B. It captures the authentic, **unmodified** Stage8B HTTP response and verifies staging branch identity, account balance, and four persisted receipts. Expected Stage7 assertion failures are reported separately and do NOT count as a Stage8B pass. Runner `scripts/stage8b/run_signed_real_branch_finance.sh`.
- The script may fail to intercept if the client's transport is not global Node `fetch`; such a failure is non-mutating and requires inspection of local client source without disclosing signing keys.

## Still not tested
- Full VPS-signed invocation to Edge to isolated staging **has not yet been confirmed** by operator. Database times are **not** real spin/user app latency.
- Real supplier-origin ingress Worker and callback path, network provider delay, regulatory/account eligibility, real production wallet reconciliation, migration rebuild failure and revert plan all remain gates before any account-money pilot.
- Production casino process port 3098, provider route, live balances and public Next app were not modified.

## Billing cleanup
Branch continues to incur approximately $0.01344 per hour until stopped/deleted. When finished and no longer needed, confirm with owner and delete branch `qrirgzvxpjhhwvyazvpn` after saving nonsecret test metrics. Never delete the primary project.
