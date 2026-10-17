# BetVima Casino — Source-Only Export

This export contains **only casino-specific source files**, not the full BetVima sportsbook or the complete native Android application.

## Snapshot and provenance

- Website/backend source: `uonesmj/Betvima` `main` @ `845fe566c4cfc2b2e4dbcb837f8fe2e566f65858`.
- Android casino source: `uonesmj/Betvima` `fix/android-107-support-rejected-upload-diagnostics-20261017` @ `c83b7f99bd206a7df9cf2415bed435cfe0b4f28d`.
- Files exported: **103** (91 web/backend, 12 Android).
- Original paths and Git blob content are preserved verbatim. See `CASINO_EXPORT_MANIFEST.tsv`.

## Included

- Web casino lobby, game catalogue, featured content and game launch APIs.
- SoftAggregator SDK, real-money wallet callbacks, currency settlement, reconciliation and eligibility checks.
- Casino KYC and operator review code, database migrations, Cloudflare workers and operational scripts.
- Casino-specific test suites, workflows and deployment/readiness documents.
- Native Android casino lobby, featured carousel, UI components, search, parsing/model code and tests.

## Shared dependencies deliberately excluded

This is a **source extraction**, not an installable standalone app. The original applications use shared (non-casino-only) code. Those mixed-purpose files are intentionally not copied into a casino-only package.

Website shared integration points include `src/components/home/home-reference.tsx`, `src/components/layout/page-shell.tsx`, `src/server/db.ts`, `src/server/http/guard.ts`, `src/server/http/request.ts`, `src/lib/errors.ts`, `src/lib/ports/db.ts`, `src/components/layout/providers.tsx`, and the root Next.js configuration/package manifests.

Android shared integration points include `android-native/app/src/main/java/com/betvima/app/data/ApiClient.kt`, `android-native/app/src/main/java/com/betvima/app/ui/AppViewModel.kt`, `android-native/app/src/main/java/com/betvima/app/ui/BetvimaApp.kt`, `android-native/app/src/main/java/com/betvima/app/ui/Pages.kt`, `android-native/app/src/main/java/com/betvima/app/ui/Features.kt`, common Compose UI/theme components, Android manifest and Gradle configuration.

## Security and scope

- No .env, provider secrets, private configuration files, users' KYC documents or runtime databases are bundled.
- Some backend features require external SoftAggregator access, KYC compliance decisions and funded wallets to work in production.
- Creating this archive does not delete or change the live `main` branch or deploy anything.
