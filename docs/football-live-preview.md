# BetVima: separate football live match centre (development preview)

Status: **UI and licensed-feed contract only, NOT 1Win replication / production data ingestion.**

## Scope
- Expandable country/league navigation, match cards, minutes, score, 1X2 odds.
- Multiple named market families: results, totals, goals, corner bets,
  cards, handicap, shots, half-time and exact score. Each market carries
  arbitrary selection IDs, lines and suspension states.
- Match incident timeline: goal, cards, substitution, corner, VAR and more.
- Per-fixture statistics: shots, possession, corners, cards, fouls.
- A strict read-only feed contract with fixture and selection IDs,
  per-market suspension, whole-snapshot uniqueness and 20-second
  transport-heartbeat freshness.
- Source rights require explicit commercial authorization and licence reference.
  A changing market price timestamp does NOT equal freshness.
- Existing sportsbook odds ingestion, live bet switch, wallet, settlement
  and user-facing /live page are untouched.

## Development only

Run a local Next dev server with BETVIMA_FOOTBALL_PREVIEW=true and open
/research/football-live. The page is 404 in NODE_ENV=production regardless of
environment flags. Every demo match, price, statistic, score and incident is
**fictional**, does not originate from 1Win, and is not bettable. There is no
network connection to 1Win or any other provider in this feature.

## Production blockers

The requested exact 1Win mirror requires proper rights to copy/commercially
redistribute another sportsbook's data. 1win.ng official terms section 15.3
expressly disallow copying its website. Direct DOM observations of three
matches are not commercial authorization or complete feed coverage.

Do NOT:
- redirect existing /live consumers to this research preview;
- link preview choices to betslip or any trading API;
- write unverified external provider event IDs into nova.matches or markets;
- change MATCH_SOURCE_ODDS authorization in sports-provider-sync.ts;
- promote fictional fixture or odds snapshots to real-world quotations;
- represent this UI as a settled operational sportsbook data feed.

After commercially authorized access is available, implement a separately
reviewed adapter, source heartbeat and suspension checks, stable event/market
mapping, streaming replay/outage tests, authoritative results, and a release
gate before accepting wagers. Existing wallets and bet settlement must be
isolated in any staging demonstration.
