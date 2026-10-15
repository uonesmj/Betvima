# SoftAggregator / BetVima — staged seamless-wallet integration

Official contract: https://softaggregator.com/docs.html (**not** docs.aggregator.gg).
This integration is **staging-only by default**. A GitHub commit does not activate real-money casino or deploy any migration.

## API routes

- GET /api/v1/casino/games — paginated provider game catalogue; only when enabled.
- POST /api/v1/casino/launch — authenticated (Supabase cookies or Bearer JWT). Example JSON: `{"gameId":"provider/GameName","demo":true,"device":"mobile","lang":"en"}`. Returns launch URL; don't store or log it.
- GET /api/webhooks/softaggregator — server-to-server provider callback. Required callback URL.

## Cloudflare client identity

SoftAggregator support confirmed on 2026-10-15 that the default `Python-urllib/3.12`
User-Agent is blocked by their Cloudflare edge with HTTP 403 / error 1010. Their
verified allowed signature is `User-Agent: BetVima/1.0`. The server-side API
client and read-only diagnostic always send that exact header; the Android app
never calls the vendor endpoint directly. Credentials must remain server-only.
This change does not enable wallet callbacks, override the rollout gates, or
remove the need to test a real catalog and game launch from the VPS.

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

## Provider-confirmed catalogue/demo status — 2026-10-15

BetVima's VPS successfully requested `getCurrencies` and `getGameList`
using `User-Agent: BetVima/1.0`: HTTP 200, API error 0, USD enabled, and
**4,940** catalogue items returned. All **4,940** reported
`play_for_fun_supported: false`; `getGameDemo` with one non-supported
slots title returned API `error: 1`. SoftAggregator support subsequently
confirmed the catalogue flag is **not reliable** and explicitly confirmed
Aviator (`id_hash: x887bde40b16350c`) launches as a USD demo. The backend
therefore allows a demo attempt for a game present in the licensed catalogue,
without relying on the flag. It marks Aviator as a known demo-supported title;
the Android UI can offer "Try demo" for others with graceful handling of
unsupported titles. Never route a demo attempt through `getGame` or mutate a
wallet. Use a separately isolated, verified test-wallet environment for
supplier-supported money-flow tests. The supplier's $2 *operator prepaid
credit* is not an individual player wallet balance.

When demo is provisioned, SoftAggregator documents `getGameDemo` using the
**same** `user_username`/`user_password` inputs as `getGame` after
`createPlayer`. These API methods run only server-side. Real-money mode
remains disabled while current credentials are exposed and the wallet migration
and reconciliation tests have not been completed.

## Verified launch response shape — 2026-10-15

The BetVima VPS verified `createPlayer` and `getGameDemo` for the
supplier-confirmed Aviator game `x887bde40b16350c`. Both calls returned
HTTP 200 and supplier `error: 0`. The launch URL was not a top-level string:
the supplier returned `response: { gameurl: "https://..." }` with a valid
HTTPS hostname. The first standalone test incorrectly reported FAILED because
it checked only a top-level string, **not** because Aviator failed to launch.

The backend now extracts a verified HTTPS `gameurl` from the response object,
while tolerating a legacy direct-string response. It never logs launch URLs,
rejects URL credentials / non-HTTPS values, and returns the URL only to the
authenticated app user. The opt-in diagnostic uses the same response shape and
requires a pre-existing provider test player when testing a demo; its default
catalogue/currencies checks remain non-mutating.

This confirms *supplier API launch URL creation*, not yet that the game was
rendered in an Android WebView. Production remains gated by owner-approved
deployment and protected secrets. The unapplied `0208` receipt migration is
archived outside the active migration directory for **demo-only** publication;
its eventual financial activation requires a separately reviewed DB migration,
verified backup, callback-signature agreement and complete ledger tests. `SOFTAGGREGATOR_REAL_MONEY_ENABLED` remains false.

## Demo-only web publication readiness

The active web revision `620352e3a4ea3dfe3154eee151804a94c2dabd86`
has the same existing `supabase/migrations` SQL files as this demo-only
candidate. The only extra database migration in the earlier casino branch,
`0208_softaggregator_callback_receipts.sql`, has **not** been applied to
production. Its original SQL is preserved verbatim under
`docs/pending-financial-migrations/`, outside the production migration runner.
This is a web-only release that does not run, register or require any new
migration. The callback financial gate `SOFTAGGREGATOR_REAL_MONEY_ENABLED`
**must remain false**. Activating that gate is prohibited without independently
approved migration, verified provider HMAC callback format, isolated wallet
reconciliation tests and credential rotation. Never inject fictitious credits
into production wallets.

The production rollout requires an authorized owner-initiated GitHub Actions
workflow dispatch on `main` with `approve_production=true`. That controller
takes a verified full DB backup and performs health checks/rollback. Do not
use a direct SSH git pull or restart to bypass this control. The API login,
password and stable player identity secret are injected solely into the
private **web** process environment, never into source, preview, APK or CI
secrets. `SOFTAGGREGATOR_ENABLED=true` permits catalogue and supported demos
only; wallet mutations remain disabled.

## Callback safety

Documented provider protocol: signed GET parameters. Check timestamp (±30s), legacy MD5 key, **and** full payload X-Signature HMAC SHA-256. Duplicate keys and missing HMAC fail closed. Amounts and balances are integer USD cents. A callback is processed only when the real-money feature flag is explicitly enabled.

Financial operations use the authoritative `nova.post_wallet_entry` with wallet locks, integer minor units, and the same transaction as an immutable callback receipt. On duplicate `call_id`, replay the original result. If the ID is reused with different details, reject it. Do not require a prior debit for free-spin winnings. Rollbacks are recorded in metadata. Insufficient balance / responsible-gaming limits reject bets. Money held for withdrawal remains unavailable. Failed DB operations never return successful business responses.

USD is a separate wallet. **There is no automatic conversion of IRT/IRR/USDT.** That must be specified, rated, funded and tested as a separate financial workflow. The provider's 2 USD testing credit is *not* a player's USD wallet balance.


## Safe activation when key rotation is deferred

Registering the callback URL in the operator portal does **not** change the server's
`SOFTAGGREGATOR_ENABLED` switch or install the operator secrets. The partner API
cannot be called until the server receives the credentials through a protected
secret store or its private runtime environment. **Never** copy keys into repository
files, GitHub Actions output, API responses, Android resources or web assets.

For a catalogue/demo-only rollout, an authorized VPS operator can set the
server-side `SOFTAGGREGATOR_API_LOGIN` and `SOFTAGGREGATOR_API_PASSWORD` and
`SOFTAGGREGATOR_ENABLED=true`, while explicitly keeping
`SOFTAGGREGATOR_REAL_MONEY_ENABLED=false`. The catalogue and test game launching
can then operate without crediting/debiting player wallets.

After private configuration, run `npm run casino:diagnose` on the server. It
makes only `getCurrencies` and `getGameList` requests and reports counts and
category breakdowns, never credentials or launch URLs. To test one demo launch without exposing its URL, explicitly set
`SOFTAGGREGATOR_PROBE_GAME_ID=x887bde40b16350c` (or another licensed game)
with `SOFTAGGREGATOR_PROBE_USER` and `SOFTAGGREGATOR_PROBE_PASSWORD` for an
**already-created** supplier test player in the private server environment.
The provider's `play_for_fun_supported` flag is not a reliable indicator.

A successful dry-run is not a live-money release: the production workflow is
explicitly owner-dispatched on `main`, and any new migrations must first be
registered and independently validated. The preview intentionally has no
partner keys, payment credentials or production database access.

**Security condition for enabling real-money callbacks:** the provider API
password and callback salt shown in a prior chat screenshot must be rotated,
their replacements installed privately, the callback source/network
trust verified, database receipts migration applied with an audited backup,
and real provider signed callback+ledger reconciliation tests passed.
Do not declare real-money complete until then.

## Go-live checklist — not yet completed

1. Rotate compromised API credentials in provider portal.
2. Back up isolated staging PostgreSQL and apply `docs/pending-financial-migrations/0208_softaggregator_callback_receipts.sql` there only. Promote the file back into `supabase/migrations` only as a separately reviewed, previously-applied financial migration.
3. Set server-side secrets and `SOFTAGGREGATOR_ENABLED=true`; **keep SOFTAGGREGATOR_REAL_MONEY_ENABLED=false**.
4. Set the staging callback URL inside SoftAggregator portal. Production URL after signoff: `https://betvima.com/api/webhooks/softaggregator`.
5. Confirm supplier's full-payload HMAC canonicalization and 30-second timestamp with actual signed **sandbox** traffic. No legacy signature-only acceptance.
6. Test game catalog, demo launch, balances, debits, credits, rollbacks, duplicate IDs, changed replay amounts, concurrent retry, self exclusion, underage, country restriction, holds, over-limit bets, negative/zero amounts, free-spin win without a debit, DB failure/retry, full ledger reconciliation.
7. Android Compose source lives on the `feature/native-android-compose` branch. Its version 0.59.0 casino lobby calls the backend endpoints and does not store provider keys. Verify a newly built APK on a real device before release.
8. After backup, verified staging tests, financial signoff and a properly authorized production release, opt in to real-money callbacks in protected server configuration.

Account funding ($100 prepaid commission credit) is handled directly by the provider; integration never silently initiates payments.
