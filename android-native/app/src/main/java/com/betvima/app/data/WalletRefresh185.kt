package com.betvima.app.data

import java.math.BigInteger

/**
 * Keep wallet data server-authoritative while refreshing the first statement page.
 * Preserve older loaded history pages, but never keep their stale summary balances.
 */
fun mergeWalletRefresh185(previous: Wallet?, server: Wallet): Wallet {
    if (previous == null || previous.currency != server.currency) return server
    // Full statement requests can finish after a newer, lightweight wallet row.
    // Never regress the header to the older ledger version while preserving
    // the newly received statement and payment history.
    val previousVersion = previous.version.toBigIntegerOrNull()
    val serverVersion = server.version.toBigIntegerOrNull()
    val stale = previousVersion != null && serverVersion != null &&
        previousVersion >= BigInteger.ZERO && previousVersion > serverVersion
    val safe = if (stale) server.copy(
        availableMinor = previous.availableMinor,
        balanceMinor = previous.balanceMinor,
        heldMinor = previous.heldMinor,
        version = previous.version
    ) else server
    if (previous.page <= 1) return safe
    return safe.copy(
        transactions = (server.transactions + previous.transactions).distinctBy { it.id },
        page = previous.page,
        hasMore = previous.hasMore
    )
}

/** A short burst after a financial request; otherwise limit background API load. */
fun walletRefreshDelay185(recentPaymentRequest: Boolean): Long =
    if (recentPaymentRequest) 5_000L else 12_000L
