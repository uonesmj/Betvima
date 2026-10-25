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
