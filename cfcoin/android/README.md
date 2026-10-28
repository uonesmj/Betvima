# CFCoin Android (v0.1)

A completely **independent** native Android prototype under \`cfcoin/android\` on branch \`cfcoin/android-v0.1\`. It does not change BetVima web, workers, Supabase, wallets, or production deploys.

## Implemented
- Native Kotlin + Jetpack Compose, Persian (RTL), black theme with emerald accent.
- Fixed bottom navigation: خانه، بازار، معاملات، کیف پول.
- Global header: CFCoin, balance 0.00 USDT, notifications, support, search.
- Home and Market: favorite, gainers, losers, price list filters, working favorites and search.
- Trading: selection from market, illustrative chart, order-type and buy/sell UI. Order placement intentionally unavailable.
- Wallet: zero balance and illustrative empty asset list. Deposits and withdrawals intentionally unavailable.
- Notifications and support bottom sheets.
- App ID: \`com.cfcoin.exchange\`, v0.1.0, min Android 8.0.

**No real user, exchange account, real-time market API, funds, trading, backend credentials, or Supabase connection in this build. Prices are static sample values and labelled as such.** This is a UI prototype only. Do not install it as a production financial app.

## Build

Open \`cfcoin/android\` in Android Studio, use Java 17, Android SDK Platform 35 and Gradle 8.11.1:

\`\`\`bash
gradle testDebugUnitTest assembleDebug
\`\`\`

Output: \`app/build/outputs/apk/debug/app-debug.apk\`

The branch-scoped GitHub Actions workflow \`.github/workflows/cfcoin-android.yml\` also builds and uploads the test APK (CFCoin-v0.1-debug) as a run artifact. It does not deploy any website or access Supabase.

## Production safeguards
Use a separate Supabase project and app signing identity, audited ledgers and custody, regulated payment services, server-side risk limits, complete KYC/AML, and legally permitted trading products before any money movement. Nothing in this prototype authorizes or executes trading.
