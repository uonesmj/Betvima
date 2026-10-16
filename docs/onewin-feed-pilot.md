# 1Win coverage pilot — evaluation only (BetVima)

Status: **not approved for production**. This pilot evaluates the *independent*
Odds-API.io 1Win-labelled bookmaker feed. It does NOT directly scrape 1Win and
does NOT imply partnership with 1Win. No betting, settlement, wallet, database,
PM2 worker, scheduled task or Android app code is changed.

## What we know before paying

Official provider coverage listing (accessed 2026-10-16):
https://odds-api.io/sportsbooks/1win
- 15 sports, **21 football market types**, pre-match and live.
- Football player props are **not supported** on that 1Win feed.
- The marketed football feed cannot be assumed to replicate every market
  visible on 1Win, nor every fixture or match incident.
- Cost quoted at https://odds-api.io/pricing is $65/month REST-only, or
  $130/month with WebSocket for the Solo tier, subject to checkout.
- Public demo snippets are not live validation.

Before buying a subscription or using the data on a real-money sportsbook,
obtain written authorization from **hello@odds-api.io** explicitly covering:
1. BetVima's jurisdiction(s) and licensed sportsbook activity.
2. Commercial display of bookmaker-branded odds and accepting wagers.
3. Permitted storage/retention, derivative pricing and redistribution terms.
4. Whether 1Win source rights are included (provider is not affiliated).
5. Complete market list, fixtures by league (Iran, Turkey, Afghanistan),
   incident/timeline support, freshness SLA and settlement/data correction SLA.

Terms: https://odds-api.io/terms . Do not assume a normal developer plan
provides production operator rights.

## Running the evaluation safely

Use a **separately issued sandbox/evaluation API key**. Set it as an environment
variable on a controlled test machine (never commit it, paste it in chat, put
it in mobile builds, or include it in browser URLs).

Requires Node.js >=20, no extra npm package. Execute in the repository root:

    ODDS_API_IO_KEY='<key-in-secure-env>' \
    ONEWIN_MAX_LEAGUES=5 ONEWIN_MAX_EVENTS=15 \
    ONEWIN_REPORT_PATH=./onewin-coverage-report.json \
    node scripts/onewin-feed-audit.mjs

The example inline key above is a placeholder, not an instruction to store
a real key in shell history. Prefer your runtime's secret injection mechanism.

Optional exact league slugs, separated by commas:

    ONEWIN_LEAGUES=iran-league,turkey-super-lig

Omit to auto-select up to 5 league names matching Iran, Turkey, Afghanistan
and major international leagues, based on the live API response. Empty matches
are reported as empty; do not infer a league is supported from its slug.

To compare with a manually recorded, independently authorized 1Win reference,
create a local JSON file (never in git, if data rights restrict disclosure):

    {
      "events": [
        {
          "home": "Example FC",
          "away": "Another FC",
          "date": "2026-10-17T18:00:00Z",
          "markets": ["Moneyline", "Corners Totals"]
        }
      ]
    }

Then set ONEWIN_REFERENCE_JSON=/private/path/reference.json. Comparisons use
exact normalized team names and a two-hour kickoff tolerance. They are useful
for identifying apparent gaps, but naming collisions, different team aliases
and market naming conventions can yield false mismatches. Verify manually.

The report contains:
- sampled fixtures (live and pre-match), scores-present flag;
- market count, market names and timestamps of the last price change (not feed freshness) per sampled fixture;
- reference fixture and market gaps (if the reference file was provided);
- API request count and errors.

The report deliberately does **not** claim to measure:
- complete parity with 1Win (only a bounded sample is evaluated);
- incident timeline (goal, cards, VAR, subs, possession, corner updates);
- end-to-end live latency or push delivery; requires a separate WebSocket test;
- source-provider legal rights, settlement integrity, or coverage of unsampled
  matches.

Report output can contain provider event data. Retain and share only in
accordance with the data provider's licensing terms.

## Go / no-go decision for the user's exact-parity requirement

This pilot is only one gate. **Do not activate a production provider** unless:
- an explicit licensed operator usage agreement is documented;
- all required target leagues, games, event updates and market types are
  independently verified across a representative multi-day window;
- each displayed odds selection maps to a stable canonical market and line;
- suspension, removal, correction and stale-quote handling are fail-closed;
- event timeline and authoritative results/settlement sources are verified;
- loss-of-feed, mismatch, duplicate event and rollback tests pass;
- the deployment stays behind a disabled provider flag until reviewed.

A provider advertising only 21 football market types and no football player
props is **not sufficient for a guarantee of exactly every 1Win market**.
Switching the existing sportsbook worker would also require a deliberately
separate identity-mapping migration and full regression testing; it currently
accepts only the_odds_api for bet-related price changes.
