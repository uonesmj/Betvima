
# BetVima Native Admin 1.1.2 (Android)

Fully native Android app written in Java. No WebView, web app or HTML renderer.
Package: `com.betvima.admin`, independent of the customer betting APK.

## Features
Native right-side hamburger drawer, role-verified email/password login, mandatory
Supabase TOTP AAL2, Android Keystore encrypted session, daily/weekly/monthly
sportsbook reports, members, individual finances, bets, deposits, withdrawal
review (NOT payout execution), casino statistics, support conversations and
replies, manual non-wagerable fixtures, affiliates, admin notification list,
operations status and audit listing.

## Live backend
The app consumes secure JSON APIs under `https://betvima.com/api/v1/admin/`
and a public config at `/api/v1/mobile/config`. It does NOT open a website.
Existing endpoints work without deployment of any additional screen. The new
casino, per-user finance and manual-fixture endpoints require deploying this
PR to the backend first. A draft fixture cannot be used for a real-money bet
until a separately verified priced-market integration is implemented.

## CI / APK
The GitHub Actions workflow builds and uploads a DEBUG installable APK as
`BetVima-Native-Admin-v1.1.2-APK`. The eventual release requires an owner
controlled keystore in GitHub secrets, penetration testing and production
approval. The debug APK is for a restricted administrator test device only.

## Server-side troubleshooting
The API origin can be changed natively on the login screen, navigation drawer,
or error screen. Supply only an HTTPS hostname controlled by BetVima that runs
`/api/v1/mobile/config`; the app verifies that it points to the same Supabase
project before discarding old tokens and switching. DNS, TLS, reachability, and
HTTP API deployment are separate checks. A dead domain cannot be repaired
within the client, and no certificate verification bypass is supported.
