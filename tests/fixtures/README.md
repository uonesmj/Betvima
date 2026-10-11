# Test fixtures

Fixtures are **inputs**, never answers: they describe what a provider, an operator or a customer
would send, so unit tests can exercise parsing, validation, grading and risk logic without a live
third party. They contain no fake customers, no fake balances and no "expected profit" numbers —
anything financial is asserted as exact integer minor units inside the test that uses the fixture.

| File | Contents |
| --- | --- |
| `providers.ts` | Provider-shaped payloads: sports match feed, odds bundle, result snapshot, webhook envelope, anomalous odds tick |
| `markets.ts` | Catalog fixtures: market/selection shapes for the market-rule and grading tests |
| `index.ts` | Barrel export |

Rules for adding fixtures:

1. Shape must match the external contract (`src/lib/ports/providers.ts`) exactly, so an adapter
   change breaks the test instead of silently drifting.
2. Never encode business expectations (payouts, commissions, decisions) — those belong to the test
   assertion, computed from the specs.
3. Prefer one canonical example plus edge cases (zero score, void market, missing provider id,
   stale timestamp) over large synthetic datasets.
