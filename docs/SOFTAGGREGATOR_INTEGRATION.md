# SoftAggregator / BetVima — staged seamless-wallet integration

Official contract: https://softaggregator.com/docs.html (**not** docs.aggregator.gg).
This integration is **staging-only by default**. A GitHub commit does not activate real-money casino or deploy any migration.

## API routes

- GET /api/v1/casino/games — paginated provider game catalogue; only when enabled.
- POST /api/v1/casino/launch — authenticated (Supabase cookies or Bearer JWT). Example JSON: `{"gameId":"provider/GameName","demo":true,"device":"mobile","lang":"en"}`. Returns launch URL; don't store or log it.
- GET /api/webhooks/softaggregator — server-to-server provider callback. Required callback URL.

## Private environment variables

| Variable | Meaning |
| --- | --- |
| SOFTAGGREGATOR_ENABLED | Defaults to false; enable catalogue/demo only after secrets are configured |
| SOFTAGGREGATOR_API_LOGIN | Provider API username |
| SOFTAGGREGATOR_API_PASSWORD | **Rotated** API password |
| SOFTAGGREGATOR_SALT_KEY | **Rotated** signing salt |
| SOFTAGGREGATOR_PLAYER_SECRET | Dedicated stable random secret of at least 32 characters |
| SOFTAGGREGATOR_REAL_MONEY_ENABLED | Defaults to false, enable only after verified financial testing and production rollout |

**The original API password and signing salt appeared in a chat screenshot. Rotate them before any deployment.** Store only in server-side secrets, never in GitHub sources or Android.

## Callback safety

Documented provider protocol: signed GET parameters. Check timestamp (±30s), legacy MD5 key, **and** full payload X-Signature HMAC SHA-256. Duplicate keys and missing HMAC fail closed. Amounts and balances are integer USD cents. A callback is processed only when the real-money feature flag is explicitly enabled.

Financial operations use the authoritative `nova.post_wallet_entry` with wallet locks, integer minor units, and the same transaction as an immutable callback receipt. On duplicate `call_id`, replay the original result. If the ID is reused with different details, reject it. Do not require a prior debit for free-spin winnings. Rollbacks are recorded in metadata. Insufficient balance / responsible-gaming limits reject bets. Money held for withdrawal remains unavailable. Failed DB operations never return successful business responses.

USD is a separate wallet. **There is no automatic conversion of IRT/IRR/USDT.** That must be specified, rated, funded and tested as a separate financial workflow. The provider's 2 USD testing credit is *not* a player's USD wallet balance.

## Go-live checklist — not yet completed

1. Rotate compromised API credentials in provider portal.
2. Back up staging PostgreSQL and apply `0208_softaggregator_callback_receipts.sql` there only.
3. Set server-side secrets and `SOFTAGGREGATOR_ENABLED=true`; **keep SOFTAGGREGATOR_REAL_MONEY_ENABLED=false**.
4. Set the staging callback URL inside SoftAggregator portal. Production URL after signoff: `https://betvima.com/api/webhooks/softaggregator`.
5. Confirm supplier's full-payload HMAC canonicalization and 30-second timestamp with actual signed **sandbox** traffic. No legacy signature-only acceptance.
6. Test game catalog, demo launch, balances, debits, credits, rollbacks, duplicate IDs, changed replay amounts, concurrent retry, self exclusion, underage, country restriction, holds, over-limit bets, negative/zero amounts, free-spin win without a debit, DB failure/retry, full ledger reconciliation.
7. The repository contains a Next.js backend and downloadable Android APKs, but no editable Android-native app source. Attach the separate Android repository to build/publish the UI; the app calls these backend endpoints and must not contain provider secrets.
8. After backup, verified staging tests, financial signoff and a properly authorized production release, opt in to real-money callbacks in protected server configuration.

Account funding ($100 prepaid commission credit) is handled directly by the provider; integration never silently initiates payments.
