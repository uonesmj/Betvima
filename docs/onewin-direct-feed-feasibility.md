# Direct 1win public-page feasibility (no paid API)

**Purpose:** A narrow, non-production research check of the public 1win.ng
betting page, requested as a budget-free alternative to paid odds APIs.

## Evidence and limitations

- Public page: https://1win.ng/betting
- Official rules: https://1win.ng/rules/27 (edition dated 2026-03-04).
  Clause **15.3** prohibits copying any part of the website; the rules also
  restrict use and transfer of information to third parties.
- The page did not expose a machine-readable football fixtures/market list in
  the external text view examined on 2026-10-16.
- External network access from the local analysis environment failed DNS
  resolution; this is an environment limitation, **not** evidence the site is down.

## Technical experiment

The Node.js check scripts/onewin-public-page-check.mjs:
- checks robots.txt, and refuses if blocked, inaccessible, or complex;
- performs at most one additional GET to the public /betting page;
- does not use an account, cookie, proxy, browser fingerprint spoofing,
  restricted endpoint, reverse engineering, or security bypass;
- emits ONLY response status, payload-size, number of script tags and the
  presence of common JS hydration markers;
- never logs, stores or copies odds, fixtures, full HTML or match updates.

This **cannot** validate full real-time bookmaker parity. It only establishes
whether the publicly accessible page responds with HTML and appears JS-driven.

## Operator decision

**NO-GO for a direct 1win ingestion production feed at this point.**

Reasons:
1. No clear permission to copy/republish 1win prices and sporting data for
   wagers accepted by another sportsbook.
2. No verified complete data stream (all games, all markets, minute/score,
   cards/corners/VAR incidents, suspensions, result corrections).
3. No verified recovery, staleness window, latency or source settlement SLA.
4. Copying odds directly without guaranteed market suspension creates a
   material financial risk to customers and BetVima.

A path to the exact requirement would require written permission to reuse
1win data, technically authorized access and exhaustive production-readiness
testing. Until then, leave the existing odds worker and betting unchanged.

Run only with the applicable site's permission:
    node scripts/onewin-public-page-check.mjs
Test locally, with NO external calls:
    node --test tests/research/onewin-public-page.test.mjs

## Real-world observations (2026-10-16)
- A GitHub Actions runner received HTTP 403 for 1win.ng/betting.
- The same independent runner received HTTP 200 for 1win.com/betting/live
  after a 200 robots.txt response, with 96,818 bytes of HTML and 19 script tags.
- This is evidence that the main public page may be loadable, NOT that it
  exposes all football fixtures, all price updates, incidents or settlement.
- The bounded browser observation in scripts/onewin-browser-observation.mjs
  checks only aggregate displayed text, link counts and whether the page changed
  over 11 seconds. It logs no event or odds data.
- No direct-scraping production architecture is recommended without rights
  to republish, reliable authoritative data, suspension and settlement tests.

## 1–3 match public browser sample
Research script scripts/onewin-dom-discovery.mjs compares the public Live-page DOM with BetVima homepage metadata, with no production odds ingestion and no funds movement. Counts of decimal-like values must not be misrepresented as verified odds, and visible page text changes alone do not establish live market price updates. Any candidate match must have a stable team-pair identity, a named market and repeated price observations before declaring proof of update.
