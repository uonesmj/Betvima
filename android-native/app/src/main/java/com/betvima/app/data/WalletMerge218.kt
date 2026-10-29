package com.betvima.app.data

import java.math.BigInteger

/**
 * Read-only server data is the sole source of header funds.
 * Recover from cold starts without requiring the costly statement endpoint first.
 * A synthetic transaction or optimistic spin deduction is never created.
 */
fun applyWalletSnapshot218(previous: Wallet?, confirmed: WalletBalance217): Wallet? {
    if (previous != null) return applyWalletBalance217(previous, confirmed)
    val emptyServerView = Wallet(
        availableMinor = "0", balanceMinor = "0", heldMinor = "0",
        currency = confirmed.currency, integrity = "unknown",
        transactions = emptyList(), version = "0"
    )
    // Reuse the 217 version/balance validation. A rejected snapshot returns
    // its input object unchanged; never leak that temporary zero as real funds.
    val verified = applyWalletBalance217(emptyServerView, confirmed)
    return if (verified === emptyServerView) null else verified
}

/**
 * Full wallet reads can finish AFTER a newer lightweight balance request.
 * Retain fresh history but never let an older full statement roll back its funds.
 */
fun mergeWalletServer218(previous: Wallet?, server: Wallet): Wallet {
    val merged = mergeWalletRefresh185(previous, server)
    if (previous == null || previous.currency != server.currency) return merged
    val previousVersion = previous.version.toBigIntegerOrNull() ?: BigInteger.ZERO
    val serverVersion = server.version.toBigIntegerOrNull() ?: BigInteger.ZERO
    if (previousVersion <= serverVersion) return merged
    return merged.copy(
        availableMinor = previous.availableMinor,
        balanceMinor = previous.balanceMinor,
        heldMinor = previous.heldMinor,
        version = previous.version,
        integrity = previous.integrity
    )
}

/**
 * Bound follow-up polling after the casino closes; normal non-casino poll
 * cadence remains unchanged outside that short reconciliation window.
 */
fun walletRefreshDelay218(recentCasinoRound: Boolean, recentPayment: Boolean): Long =
    if (recentCasinoRound) 2_000L else walletRefreshDelay185(recentPayment)
