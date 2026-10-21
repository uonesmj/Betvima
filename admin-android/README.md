# BetVima Admin Android v1.0.0

An independent installable Android app using the existing HTTPS backend at
https://betvima.com/admin/mobile. Package name: com.betvima.admin.

- Same Supabase email/password + Turnstile login and mandatory TOTP as the web admin
- Mobile reports, customers, bets, payments, casino, support and manual fixtures
- Protected existing admin endpoints, without embedded API secrets
- Existing Android player app and sportsbook layout remain unchanged
- Native WebView shell, with file chooser, persistent cookies, TLS failure handling
- Manual events are read-only until separately priced and wager-enabled

APK: GitHub Actions / BetVima Admin Android APK / successful run /
BetVima-Admin-v1.0.0-APK artifact / app-debug.apk.

This is an owner testing/debug APK. Release signing is intentionally not committed.
Production web deployment is separately gated and required before the app route
is available on the public domain.
