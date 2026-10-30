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
