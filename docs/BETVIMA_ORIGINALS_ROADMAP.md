# BetVima Originals — independent casino game program

Status: **prototype only; not licensed/certified; no wallet integration; no production rollout approval**.

## First implementation

The feature is additive and off by default behind the server-side
`BETVIMA_ORIGINALS_PREVIEW_ENABLED=true` flag. The page
`/casino/originals` contains two **shared** browser demo engines
(3-reel slots, under/over dice) with six original visual variations.
It uses resettable **non-redeemable demo credits**, not BetVima balances.
No financial API, database table, KYC policy, player registration,
supplier connector or settlement worker is altered.
The current SoftAggregator routes remain independent.

The demo uses a browser cryptographic RNG with unbiased bounded mapping,
but browser-owned games **must never be connected to real money**.
Real-money outcomes must be generated and committed by a trusted server,
with independently audited RNG, certified paytables, immutable rounds,
idempotent ledger transactions, unique operation keys, complete session
recovery, verifiable player-facing histories, anti-fraud and risk controls.

## 500-title catalogue *target*, not 500 completed titles

| Game family | Target titles |
|---|---:|
| Classic and modern slots | 250 |
| Crash and multiplier games | 50 |
| RNG roulette variants | 40 |
| Blackjack variants | 30 |
| Poker/card table variants | 40 |
| Dice and mines variants | 40 |
| Plinko, Keno and quick-play | 50 |
| **Total** | **500** |

The target refers to separately designed experiences. Reusing an engine
and changing only a title/skin does not establish distinct gameplay,
certification, intellectual property, mathematics or quality assurance.
Live-dealer games with actual physical dealers are out of scope.

## Release phases

1. Prototype engines with distinct versioned game configuration/paytables,
   UI play tests and accessibility/mobile performance tests.
2. Establish game mathematics including RTP, volatility, exhaustive
   state-space analysis where feasible and statistical simulations.
3. Define server-owned RNG service with independently verified quality,
   immutable round states (created, bet-reserved, resolved, credited,
   reversed), unique idempotency keys and recovery.
4. Independent security, penetration, RNG and game fairness audits;
   age/identity and jurisdiction policy; operator and any required software
   licences; approved payment and player-protection controls.
5. Only with explicit authorization and a verified database backup,
   stage financial integration in a separate isolated environment.
6. Controlled launch in jurisdictions where the operator and games are
   authorized; monitor RTP, wagering limits, disputes and reconciliation.

No legal authorization follows from developing games internally.
Do not treat any demo payout figures as a guarantee or a certification.
