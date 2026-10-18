# BetsAPI migration runbook — 2026-10-18

Status: **NOT DEPLOYED. NO PRODUCTION SOURCE SWITCH.**

## Confirmed repository state

- Production sportsbook prices and match identities are currently owned by `the_odds_api` (`src/workers/sports-provider-sync.ts`).
- `src/server/env.ts` enables sports-provider processing using `ODDS_API_KEY` or `SPORTS_PROVIDER_API_KEY` for `the_odds_api`; simply setting `SPORTS_PROVIDER=betsapi` is insufficient.
- `src/providers/betsapi-explorer.ts` and `src/providers/betsapi-trial.ts` are read-only diagnostics. They are explicitly separated from real betting and settlement.
- `src/providers/betsapi-normalization.ts` only maps a small, known Events API market subset; Bet365 FI requires a separate verified full-market adapter.
- User-approved target: BetsAPI to supply fixtures, prematch and live offers, and results across available sports; no automatic switch while data integrity is unverified.

## Required changes before switching

1. Create a production-grade `SportsDataProvider` implementation for BetsAPI using the **server-side** token only. Implement `health`, `fetchMatches`, `fetchLiveMatches`, `fetchOdds`, `fetchEventOdds`, `fetchResult`, and `fetchResults` with bounded calls, caching, quota, timeout, and complete errors without token leakage.
2. Normalize Bet365 FI IDs, leagues, teams, score, minute, league country, full quoted markets, handicap lines, individual selections, market open/suspended status, and source timestamps. Never synthesize unavailable prices.
3. Introduce distinct namespace for BetsAPI IDs and a documented collision-safe mapping. Retain historical `the_odds_api` match/market/selection references for all outstanding slips and settlement records. Avoid silent reinterpretation of current selections.
4. Use explicit owner-approved provider configuration, fail closed if token or entitlements are missing. Never treat a configured but denied API as valid live pricing.
5. Prove result mapping and settlement grading for 1X2, handicap, totals, half/full and all newly supported market types; unsupported grading rules must remain unavailable for wagering.
6. Verify on the *real* subscription: Algerian league + two major-league events, plus at least live and prematch samples. Record returned fixtures, quoted market/selection counts, update times, suspension transitions, and quota. No token or raw credentialed URL in reports.
7. Staging tests must cover unchanged existing bet settlement, live odds freshness (12 seconds), prematch odds freshness (45 seconds), odds-change consent, suspend-after-loss-of-feed, duplicate provider event matching, replay/idempotency, reconnects, and rollbacks.
8. Only then stage a controlled read-only comparison, a scoped canary, explicit production publication approval, and a one-switch rollback that preserves historical data.

## Current blocker

No validated real subscription response or safe production deployment access is available in this change. Until #1–#7 are complete, **do not disable The Odds API worker, reroute outstanding bets, or enable BetsAPI as the authoritative wagering source**.
