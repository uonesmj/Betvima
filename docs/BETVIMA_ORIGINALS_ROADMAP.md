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

## Royal Vault: first complete interactive demo

- URL, behind the same server-only preview flag: `/casino/originals/royal-vault`.
- Custom authored vector art: `public/originals/royal-vault-hero.svg`; branded responsive reels and custom controls.
- 5 reels × 3 rows, 8 independent equiprobable symbols, 5 fixed lines (top, center, bottom, V and reverse V).
- 2, 3, 4, 5 consecutive matching symbols starting from the left award 2×, 32×, 100×, 350× *per-line stake*, respectively. Every wager is divided into five line stakes.
- The exact per-line/theoretical RTP is **91.259765625%** (derived analytically and checked over all 8^5 possible one-line outcomes). This is a demo result, not an audited/certified real-money RTP.
- Royal Vault is a fully **interactive demo**: unbiased browser crypto random sample, sequential animated reel stops, five-payline wins, bet selector, large spin button, maximum bet, up-to-10-spin autoplay with stop, turbo animation, opt-in synthesized audio, rules/paytable, session statistics, nonredeemable credits and reset.
- All its data lives in React state, not the authenticated financial backend. Refresh resets credits. Existing top navigation can show the signed-in user's **read-only** real wallet balance, but Royal Vault never uses or updates that amount.
- No fake USD cash wins, supplier game launches, server wallet calls or real wagering hooks. Original provider casino catalogue is unchanged.
- One wallet integration gate per approved environment must later atomically **reserve/debit and settle/credit** funds with idempotency, immutable round history, authoritative server RNG, loss/age/geo/KYC restrictions, regulated RNG and game fairness verification, dispute recovery and reconciliation. Mere UI support or this independent demo must never enable cash wagering.

### Preview activation

Only on a safe preview environment, set `BETVIMA_ORIGINALS_PREVIEW_ENABLED=true` and deploy the reviewed server build. If missing or false, both `/casino/originals` and `/casino/originals/royal-vault` respond with 404. No migration, wallet setting or live provider flag must be changed.

## Safe wallet milestone (2026-10-21)

The Royal Vault page now includes a separate authenticated **read-only**
wallet panel. It requests the existing `GET /api/v1/wallet` endpoint using
same-origin session credentials, validates the `{ok:true,data:{wallet,integrity}}`
response envelope, requires `integrity:ok`, rejects unsupported currencies,
unexpected currencies, malformed/negative amounts, and formats integer minor
units accurately for USD and IRR. It clears stale amounts when verification
fails or the session changes and polls while visible.

**This is NOT wagering integration.** Spins still use resettable local `CR`
credits, and no endpoint on the Royal Vault page can post a wallet debit or
credit. There is no independently certified production Royal Vault game
engine, dedicated round persistence table, evaluated server-controlled random
seed, real-money settlement/rollback testing, or independently confirmed
operator jurisdiction/age/KYC release clearance.

Pre-launch: create a *separate isolated staging DB*, version the mathematical
rules, implement authenticated/authorized idempotent debit and settlement
in one durable transaction, design recovery after disconnect/timeout, audit
all failure and concurrency branches, and verify an independent test report,
legal authorization, wallet limits and a restorable full backup. Never
reinterpret a read-only wallet snapshot as permission to stake funds.

The only production SQL executed during this milestone was a **read-only**
aggregate check: 92 wallets, 0 balance-to-posted-ledger mismatches; no
balances or customer identifiers were returned to the assistant.

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
