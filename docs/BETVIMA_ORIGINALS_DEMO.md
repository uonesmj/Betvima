# BetVima Originals — first isolated prototype

**Status: source on feature branch only. Not deployed. Demo only.**

This prototype replaces the need for an *external game-results API* for three
new original games while preserving all existing sports betting, real wallet,
SoftAggregator casino and account flows. Its route is `/casino/originals`.

## Implemented

- Crash-style rising multiplier and one-tap cashout (original brand/interface,
  not a copy of third-party game assets or branding).
- European single-zero roulette with red, black, even, odd and zero.
- Three-reel slots with an illustrative visible paytable.
- Mobile-friendly dark UI and English/Persian copy.
- Shared **ephemeral demo credits** reset on reload. No money API, no persistent
  financial state, no blockchain deposits or withdrawals.
- Browser `crypto.getRandomValues` used to avoid `Math.random` for demo outcomes;
  unbiased roulette/reel selection via rejection sampling.
- Unit coverage for paytables, stake bounds and crash properties.

## Critical non-goals of this prototype

This is NOT an approved gambling product and MUST NOT be connected to a real
wallet. Client-side random generation and local state are tamperable by users;
they are for demonstration, not for cash settlement. No certified RTP,
regulated fairness testing, independent seed proof, multi-session audit,
game-operator license, responsible gaming or secure wager workflow is claimed.

## Production architecture before any lawful cash launch

1. Independent server-authoritative game rounds, server-side cryptographic
   randomness / independently audited game math and explicit tested RTP.
2. Round state transitions that are idempotent under retries and crashes,
   authentication, locking, timeout recovery and consistent server timestamping.
3. Transactional balance reservation / settlement through an isolated ledger,
   with reliable financial reconciliation and adverse-event replay tests.
4. Independently approved legal jurisdiction, age/identity verification,
   payment compliance, anti-fraud, responsible gaming limits and certified RNG.
5. Game session and wallet integration into the existing app and website,
   verified with sandbox currencies before real money.

Nothing in this feature branch disables the current casino supplier, lifts
jurisdiction requirements or alters operator financial flags.
