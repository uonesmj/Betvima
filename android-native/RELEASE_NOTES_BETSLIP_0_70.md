# BetVima Android 0.70.0 — Bet Slip compact layout

This branch is a reproducible build snapshot of the Android bet-slip changes.

- Preserves the established white, blue and green visual palette.
- Draws a compact 64dp probability ring inside the existing Combined Odds summary.
- Keeps picked markets visible in the scrolling selection list.
- Renders selection indices as 1, 2, 3 without leading zeroes.
- Tapping a selection navigates to its match and expands the exact market.
- Uses a unified header gradient across the drag handle and wallet area.
- Labels the primary main-account CTA with one word.
- If any match-odds request fails, estimates the corresponding leg from the odds already selected; marks the result approximate and does not present unmodelled refund probability as zero.
- Doesn't modify server wager limits, pricing, accepted odds, wallets or settlement. The current placeable slip limit remains 20.
- Unit tests cover three-leg partial snapshots and a twenty-leg estimate.

Release artifact: CI betvima-native-debug-apk. The debug APK is not a signed production release.
