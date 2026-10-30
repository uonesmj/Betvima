# BetVima Casino — Stage 9 latency & robustness check, 2026-10-31

## Evidence independently verified before VPS field run

- Isolated Supabase branch `qrirgzvxpjhhwvyazvpn` only; production `mqygiufkubxxxjodsycu` must not be sent financial test payloads.
- Executed four additional finite synthetic wallet rounds in overlapping Supabase calls against the original `nova.post_wallet_entry` and branch-only strict receipt integrity constraints; each round internally applied debit -25, win credit +40, refund +25, reverse win -40. Tests were followed by idempotent second invocation under the same fixed nonce.
- Read-only branch reconciliation verified 25 ledger rows including the original seed, 24 callback receipts, six completed synthetic rounds, **wallet balance 1,000 minor units, journal SUM 1,000, zero orphan receipts**. No proof of live-money performance is implied by the tool call wall clock.
- `anon` and `authenticated` cannot execute `public.stage8b_synthetic_financial_round(text)`; only the staging backend service role can.
- Earlier signed Stage8B direct VPS request measured 592.9ms, isolated DB round 13.209ms; **one successful sample is not sufficient for p95**.
- Pre-existing read-only live baseline in `docs/CASINO_EDGE_EU_READONLY_PILOT_20261030.md` had mean balance 0.977s (n=18), debit 3.841s (n=9), credit 3.512s (n=5). This is not comparable directly to the 592.9ms staging sample without identical boundaries.

## Operator Stage9 measurement — pending

Read-only parser `scripts/stage9/parse_existing_callback_timing.py` reads only a bounded slice of existing Nginx dedicated callback timing logs, never prints provider URLs, signatures, IPs, account identifiers or full log lines. It will explicitly report unverifiable if the log path/format does not match.

The `scripts/stage9/run_stage9_irish_finance_and_live_readonly.sh` runner:
1. Guards the **original tested** VPS-side signed staging-only Stage8B client and the network-isolated older Postgres fixture. Does not patch original signer code or live code.
2. Captures actual live server resource state, callback log latency p50/p95 where present, three read-only local and public catalogue GET timings, and a live Postgres **READ ONLY SELECT 1** network RTT diagnostic if the active release's pg dependency and runtime DB config are available. Never prints DB config values or users.
3. Sends 10 signed Stage8B Edge calls to the isolated Irish branch, six serial and four with a maximum of two concurrent requests, collecting p50/p95 and max full **VPS→Edge→financial-staging-Postgres** latency. Each round uses a synthetic-only, non-login 1,000-unit wallet and net-zero ledger postings. The original Stage7 legacy assertion exit code is irrelevant; only verified `STAGE8B_REAL_E2E=PASS` counts.
4. Sends one invalid unsigned request only to isolated Stage8B Edge; expects HTTP 401. No real provider callback or production financial request.
5. Writes raw operator logs to a restrictive private temporary directory and erases them afterwards; terminal output contains only allowlisted metrics.

### Stage9 closure gates

- Operator output: 10/10 verified signed isolated Edge financial rounds, unsigned 401, no anomalous synthetic balance/ledger mismatches independently checked via connector after running.
- Existing production provider callback timing parsed from real Nginx timings, or explicitly documented why unverifiable; DB network RTT and public/local RTT to localize 3–8 second delay; do **not** infer from one staging sample that actual player Spin will meet one second.
- A true user-visible Spin timing test requires separately controlled **Stage10** test and eligibility plus provider-origin callback reconciliation and valid jurisdiction.
- Automatic branch migration remains `MIGRATIONS_FAILED`; no main-project or 3098 cutover, no live balance experiments, and PR #370 stays draft. Remove stage branch when testing no longer needed to stop hourly $0.01344 cost.

**Status:** stage9 bounded synthetic financial test and permissions preflight PASS; VPS latency test pending operator execution. Not yet declared fully complete.

## Operator Stage9 VPS benchmark — FINISHED, financial robustness PASS (2026-10-30T21:08 UTC)

Measured locally on the active BetVima VPS with the original production release **unchanged** and **no provider callback or real-money request by this test**:
- Active casino port 3098 listening; RAM used 5403/11959 MB; swap used 2272/4095 MB (~55%); root disk used 78%. These are operational warnings, not a demonstrated cause of casino latency.
- Existing Nginx live SoftAggregator callback timing logs, 104 parseable request-time records:
  - Balance n=58, p50 **1022.5ms**, p95 **1778.6ms**, max 3417ms, all HTTP 2xx.
  - Debit n=30, p50 **4894.0ms**, p95 **11312.6ms**, max **14378ms**, 29 HTTP 2xx and one HTTP 4xx.
  - Credit n=16, p50 **4372.0ms**, p95 **5050.5ms**, max **5223ms**, all HTTP 2xx.
  - Nginx `upstream_response_time` not parseable (`NA`). Therefore cannot divide latency between Nginx, app, PostgreSQL, provider and FX lookups from these metrics alone.
- Read-only live Postgres connection acquisition **933.8ms**, warm `SELECT 1` network RTT: **149.4,147.6,147.6,148.7,147.9ms**.
- Live local 3098 catalogue GET sample TTFB 3960.848, 7.058, 4.922ms; public host TTFB 1165.583, 563.528, 513.489ms. First-call local delay suggests cold-path work but is not proven representative of monetary callbacks.
- Isolated Irish staging Edge **10/10** verified signed actual `nova.post_wallet_entry` synthetic-only rounds (6 serial, 4 at concurrency 2), full VPS E2E median **383.4ms**, p95 **613.2ms**, max **707.9ms**, local financial PostgreSQL round median **3.1ms**.
- Unsigned staging Edge request **401** as expected. Live 3098 unchanged. Baseline production real callback p50 4.9s versus staging synthetic round p50 .38s are **NOT equivalent workloads or matched latency boundaries**; do NOT claim that player Spin is now <1 second or that the Edge route is operating for live users.

### Independent Supabase verification

After user VPS run, restricted **staging** `qrirgzvxpjhhwvyazvpn` SQL returned:
`ledger_rows=65`, `receipt_rows=64`, `staging_rounds=16`, `orphan_receipts=0`, `synthetic_wallet_minor=1000`, `synthetic_ledger_sum_minor=1000`, `auth_user_count=1`, `profile_count=1`, `wallet_count=1`, `failed_receipts=0`, `anon_rpc=false`, `authenticated_rpc=false`.
Isolated Supabase Edge function logs in 2026-10-30T20:57–21:30Z showed `11 × HTTP 200` and `12 × HTTP 401` in `eu-west-1` (window may include nearby previous attempts; do not treat all as Stage9 requests).

**Stage9 technical bounded benchmark and synthetic financial integrity: PASSED.** **Production latency root-cause attribution: INCOMPLETE** because missing upstream/app/DB trace correlation. Real provider-origin correctness, full branch auto-migration `MIGRATIONS_FAILED`, restore/rollback rehearsal and account eligibility remain gates before any production cutover. Keep PR DRAFT and no changes to 3098.

## Stage10 conditions / proposed operator path

1. Inspect existing production 3098 callback source and middleware to identify sequential expensive DB/network calls; instrument phase timers with masked correlation IDs and no secrets at an isolated candidate release, NOT by altering production finance.
2. Obtain authenticated actual supplier-origin Callback (not an Ed25519 canary) in authorized isolated staging test path, review ingress origin protections and supplier history reconciliation. Reject unsigned/forged/replayed callbacks.
3. Resolve branch `MIGRATIONS_FAILED`, verify schema parity, audit Edge auth and service role privileges, backup and tested rollback.
4. Only then stage a **single legal eligible own-account user test with explicit limits and monitoring**; compare player button click→reel start, provider callback TTFB/response, database commit, game wallet and header refresh against current 3098 on the same workflow.
5. Explicitly approved controlled cutover and revert only after objective evidence; never infer live improvement from synthetic 383ms.

**Billing:** Branch continues to incur $0.01344 per hour until explicitly deleted/paused.
