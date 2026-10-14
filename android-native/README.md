# BetVima — Native Android

Native Android app, built with **Kotlin / Jetpack Compose** (no PWA and no site WebView). The module is standalone and consumes the existing `/api/v1` service. It does **not** edit the web release pipeline, database schema, ledger or payout workers.

## Local build

Open `android-native/` in Android Studio (JDK 17, Android SDK 35) and sync Gradle, then build the `app` configuration. CI uses Gradle 8.10.2 and uploads a debug APK. This repository does not yet include a Gradle wrapper; Android Studio manages the Gradle distribution via its import configuration.

## Scope and protections

- Native home, live & prematch lists, league sections, match/market detail, slip preview, filterable and paginated bet history with account-authorized per-leg receipts, paginated wallet statement, rewards, VIP explainer, authenticated in-app notifications with read acknowledgements, profile/auth.
- Persian-first right-to-left interface with persistent language selection and localized market labels. Wallet, bet and bonus requests run independently so a transient endpoint outage does not erase confirmed data. Stale sports-switch responses are discarded and live network polling does not overlap. Invalid prices are never selectable. Quote requests use the **market revision** only when returned by the server (never a selection's odds revision or fabricated zero).
- Native home uses real upcoming market data for its Top Bets ranking, and keeps Esports off Home while retaining it in the dedicated sports ribbon. The API sport key for ice hockey is `hockey`, as defined by the backend.
- Requests use HTTPS to BetVima API with server-issued data. Empty / degraded catalogue is shown honestly; no fake fixtures, odds or wallet balances.
- Supabase password sign-in uses the project's public anonymous client key obtained from `/api/v1/mobile/config`. The session JWT is verified **server-side** for account requests and stored encrypted with Android Keystore. Registration goes through the existing web registration flow with Turnstile until a dedicated mobile onboarding process is reviewed.
- All *real-money wager submission* is disabled in the native build and the mobile bootstrap. **Do not enable** without verified age checks, jurisdiction/geolocation enforcement on the server, approved gambling licence, controls for responsible gambling, anti-abuse review and Play certification. UI selections and quotes are not proof of authorization.
- Do not put provider or service-role secrets into the APK. Never compute final odds or financial balances client-side.
- Privacy: no tracking SDK, no runtime location permission, no plaintext HTTP, no Android backups for auth storage. Access tokens are not logged.

## Google Play release prerequisites

Google requires adult-only rating, per-jurisdiction gaming licences and app approval, underage and unauthorized geography prevention, free download, and a responsible-gambling disclosure. This app is **not yet approved or ready for real-money release**. See https://support.google.com/googleplay/android-developer/answer/9877032.

## Debug APK updates

CI runners produce debug APKs signed by their own ephemeral debug keystore. A newer CI APK may be rejected as an *update* over an older test installation because the certificates differ; back up local-only test data and uninstall the old debug app before installing the new artifact. No production signing key is committed to this public repository. A stable app-signing key should be created and retained in a protected signing service or GitHub encrypted secrets before a proper release.

Production web deployment is separately gated and is not triggered or implied by this Android PR.
