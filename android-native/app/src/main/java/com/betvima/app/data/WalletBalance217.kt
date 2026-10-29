package com.betvima.app.data

import java.math.BigInteger

/** Lightweight authenticated wallet snapshot; not a bet or provider event. */
data class WalletBalance217(
    val availableMinor: String,
    val balanceMinor: String,
    val heldMinor: String,
    val currency: String,
    val version: String
)

/**
 * Only the server's own row can replace a balance; never infer it from Spin.
 * Preserve complete statement, payments and integrity while updating the header.
 * Reject older/cross-currency responses to avoid flicker when polls overlap.
 */
fun applyWalletBalance217(previous: Wallet?, confirmed: WalletBalance217): Wallet? {
    if (previous == null || confirmed.currency != previous.currency) return previous
    val oldVersion = previous.version.toBigIntegerOrNull() ?: return previous
    val newVersion = confirmed.version.toBigIntegerOrNull() ?: return previous
    if (newVersion < oldVersion || newVersion < BigInteger.ZERO) return previous
    val available = confirmed.availableMinor.toBigIntegerOrNull() ?: return previous
    val balance = confirmed.balanceMinor.toBigIntegerOrNull() ?: return previous
    val held = confirmed.heldMinor.toBigIntegerOrNull() ?: return previous
    if (available < BigInteger.ZERO || held < BigInteger.ZERO || balance < BigInteger.ZERO ||
        available != (balance - held).max(BigInteger.ZERO)) return previous
    return previous.copy(
        availableMinor = confirmed.availableMinor,
        balanceMinor = confirmed.balanceMinor,
        heldMinor = confirmed.heldMinor,
        version = confirmed.version
    )
}

/** Poll the verified lightweight endpoint in active casino games; never flood it. */
fun casinoWalletPollDelay217(): Long = 1_000L
