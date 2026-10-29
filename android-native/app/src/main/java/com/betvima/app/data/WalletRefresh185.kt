package com.betvima.app.data

/**
 * Keep wallet data server-authoritative while refreshing the first statement page.
 * Preserve older loaded history pages, but never keep their stale summary balances.
 */
fun mergeWalletRefresh185(previous: Wallet?, server: Wallet): Wallet {
    if (previous == null || previous.currency != server.currency || previous.page <= 1) return server
    return server.copy(
        transactions = (server.transactions + previous.transactions).distinctBy { it.id },
        page = previous.page,
        hasMore = previous.hasMore
    )
}

/** A short burst after a financial request; otherwise limit background API load. */
fun walletRefreshDelay185(recentPaymentRequest: Boolean): Long =
    if (recentPaymentRequest) 5_000L else 12_000L

/** Atomic wallet row published by /api/v1/wallet/balance; not a casino bet event. */
data class WalletBalanceSnapshot217(
    val availableMinor: String,
    val balanceMinor: String,
    val heldMinor: String,
    val currency: String,
    val version: Long
)

/**
 * Refresh only the authoritative amount. Preserve transaction pages and
 * integrity state; never accept a stale wallet revision or other currency.
 */
fun mergeWalletBalanceSnapshot217(
    previous: Wallet,
    snapshot: WalletBalanceSnapshot217
): Wallet {
    if (previous.currency != snapshot.currency) return previous
    if (previous.version > 0L && snapshot.version < previous.version) return previous
    return previous.copy(
        availableMinor = snapshot.availableMinor,
        balanceMinor = snapshot.balanceMinor,
        heldMinor = snapshot.heldMinor,
        version = snapshot.version
    )
}

/** Faster only while an eligible, foreground real-money game is open. */
fun casinoWalletPollInterval217(active: Boolean): Long =
    if (active) 1_200L else 2_500L
