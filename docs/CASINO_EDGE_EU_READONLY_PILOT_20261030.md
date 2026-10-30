# BetVima — EU Edge casino latency pilot (2026-10-30)

## Scope and status
- Supabase project: `mqygiufkubxxxjodsycu`, region `eu-west-1`, organization's Pro plan.
- Deployed: `betvima-eu-debit-batch-probe` (Edge, JWT verification enabled). Source: `supabase/functions/betvima-eu-debit-batch-probe/`.
- **Read-only and synthetic ONLY.** No casino callback, actual bet, wallet mutation, settlement, rollback, currency conversion or provider request has moved to Edge.
- Live route `https://betvima.com/api/webhooks/softaggregator` remains pointed at the verified production `3098` service. Do not forward real provider traffic to the probe.

## What the probe measures
The probe accepts one tightly validated Ed25519-signed synthetic body, in addition to Supabase's JWT gateway validation. It checks the invocation runtime is `eu-west-1`; uses static `SELECT` statements against a non-existent zero UUID; records timing for sequential read shapes and one batched equivalent SELECT; and returns only phase timings. It never accepts a player ID, round ID, amount or arbitrary SQL. The public SPKI value is a *verification key* (not the signing key). Never put private signing keys, DB URLs, service keys or supplier salts in Git.

To call from the **already authorized diagnostic signer**, send a JWT plus the existing valid Ed25519 signed synthetic marker (`v`, `kind=debit_eu_canary`, `nonce`, `ts`) and `X-BetVima-Bridge-Signature`. Use `?forceFunctionRegion=eu-west-1` if regional invocation headers cannot be set. Unauthorized, expired or modified requests must return 401. Check `x-sb-edge-region` and `SB_REGION` on successful responses.

### Benchmark interpretation
- Source sample of live `3098` callbacks on Oct 30, 2026: balance mean 0.977s (18); debit mean 3.841s (9); credit mean 3.512s (5). These values are **not Edge transactions**.
- Earlier read-only canary calls returned four 200s with mean Edge execution time ~438.5ms; this does not include all client-to-Edge travel and is not a settlement performance claim.
- Compare `sequential_reads_ms` with `batched_reads_ms` from this new probe, preferably on 30+ signed invocations at representative load, including cold starts. Do not estimate production debit latency by multiplying SELECT timings alone.
- The probe's SQL may be limited by current database privileges and must return fail-closed 503 if not configured.

## Pro plan quota
Supabase Pro includes **2,000,000 Edge Function invocations per billing period**, shared at organization level, not 2 million gaming rounds. Calls above quota are billed in one-million packages (currently $2/package), depending on spending controls. Invalid requests also consume invocations; monitor actual usage and set alerts. If 50,000 rounds/day require roughly 3 callbacks each, estimate 4.5m function calls per 30-day month *before* launch/health calls. This is not yet an authorized architecture.

## Production readiness gate — NOT SATISFIED BY THIS PROBE
1. Confirm operator rights, allowed jurisdictions, age/KYC requirements, supplier approval of callback endpoint, egress IPs and URL.
2. Review **actual current** `3098` source, middleware and database transaction semantics. The public GitHub `main` version differs from the live casino release.
3. Implement the full supplier signed GET protocol (timestamp, legacy MD5, full HMAC verification) and independent trusted ingress. Block caller spoofing; do not accept an authenticated browser JWT as supplier identity.
4. Maintain one authoritative journal, atomic debit/credit/rollback, original-round currency FX snapshot, idempotent receipts, exact rollback/reversal, concurrency/locking and per-player eligibility. Under no circumstances acknowledge debit before the database commit.
5. Stage with a **separate non-production wallet/database** and vendor-generated signed callbacks. Test balance, debit, credit, duplicate IDs, failure/retry, rollback, reversed credit and reconciliation against provider history. Test cold-start and latency percentiles.
6. Perform independent risk/security review; verify backups and documented rollback. Then do a controlled, explicitly approved traffic cutover with live monitoring. Do not alter the provider URL, Nginx proxy, `3098`, or financial feature flags while these gates are open.
7. Run operational measurements on end-user spin-start time. Even if callbacks are fast, provider-controlled reel animation cannot be assumed to start within 1 second.

## References
- https://supabase.com/docs/guides/functions/regional-invocation
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
- `docs/SOFTAGGREGATOR_CALLBACK_TRUSTED_EDGE.md`
- `docs/CASINO_REAL_MONEY_RELEASE_GATE_20261016.md`

## Verified 32-invocation baseline (2026-10-30)
From the signed diagnostic script running on the existing VPS (all 32 accepted, no financial writes):
- Full caller-to-Edge E2E: median **505.0 ms**, mean **605.4 ms**, p95 **1165.8 ms**, maximum **2222.4 ms**; **29/32 <1000 ms**.
- All nine static SELECT probes combined: median **164.2 ms**, mean **155.5 ms**, p95 **216.4 ms**.
- Sequential six read shapes, 20 detailed samples: median **25.8 ms**, mean **26.5 ms**, p95 **33.0 ms**.
- One batched equivalent SELECT, 20 detailed samples: median **5.1 ms**, mean **5.0 ms**, p95 **5.6 ms**.
- Supabase Edge logs in the benchmark window recorded **33 HTTP 200** (32 new + 1 earlier test), and **17 HTTP 401** (consistent with included negative authentication checks), all tagged `eu-west-1`.
- These values do **NOT** measure an actual provider debit, player balance mutation, ledger commit, contention, retry, or the reel's start time. It would be incorrect to substitute these values for measured production settlement latency.
- **Decision:** proceed to *staged* signed financial callback parity testing only. Do not route live supplier callbacks to Edge. The actual active VPS release source must be imported and audited before implementing parity, since GitHub main lacks the current production handler.
