# CFCoin Android v0.2 — independent red exchange UI

**Native Android:** Kotlin, Jetpack Compose, app ID com.cfcoin.exchange, Android 8.0+.

Branch: cfcoin/binance-red-v0.2 (isolated from BetVima main and its live financial services).

## UI
- Original CFCoin identity; dark charcoal + bright red design; no Binance brand assets.
- Persistent four bottom tabs: Home / Markets / Trade / Wallet.
- Global header: logo, hidden/visible *zero* balance, notifications, support, search.
- Home: summary balance, add funds (preview only), quick actions, market cards.
- Market: functional favorites, winners, losers, full price list, search.
- Trade: spot/futures/margin/convert tabs, sample candlestick chart and order book, limit/market/stop-limit form, futures margin/leverage UI, dummy TP/SL.
- Assets: overview, spot, futures, funding account tabs; zero balances, quick actions and empty transaction history.
- All interactions strictly UI-only: no live feed, no authentication, no real orders, deposits, withdrawals, wallet keys, trading or brokerage logic.

Market prices, order-book levels and candle chart are **hard-coded example data**, not current rates. Futures mode is strictly a visual mockup.

## Build
Open cfcoin/android in Android Studio (Java 17, Android SDK 35) or use:

    gradle --no-daemon testDebugUnitTest assembleDebug

The Android debug APK is built and stored by a GitHub Actions workflow scoped to this branch only. Its generated file is \`cfcoin/releases/CFCoin-v0.2-debug.apk\`.

## Operational isolation
Do not reuse BetVima's financial database, API credentials or wallet balances. A distinct Supabase project and independent back-end ledger would be needed before any real account testing. Regulatory approval, custody integration, security audit and controlled testing are required for any real-money functionality.
