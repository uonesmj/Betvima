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
    val newVersion = confirmed.version.toBigIntegerOrNull() ?: return previous
    val available = confirmed.availableMinor.toBigIntegerOrNull() ?: return previous
    val balance = confirmed.balanceMinor.toBigIntegerOrNull() ?: return previous
    val held = confirmed.heldMinor.toBigIntegerOrNull() ?: return previous
    if (newVersion < BigInteger.ZERO || confirmed.currency !in setOf("USD", "IRR", "IRT") ||
        available < BigInteger.ZERO || held < BigInteger.ZERO || balance < BigInteger.ZERO ||
        available != (balance - held).max(BigInteger.ZERO)) return previous
    if (previous == null) {
        // Fix v217 initialisation race: a VERIFIED server snapshot can populate
        // the header before slower statement/payment queries finish. This is
        // display-only; the integrity gate stays unknown until a full wallet read.
        return Wallet(confirmed.availableMinor, confirmed.balanceMinor, confirmed.heldMinor,
            confirmed.currency, "unknown", emptyList(), version = confirmed.version)
    }
    if (confirmed.currency != previous.currency) return previous
    val oldVersion = previous.version.toBigIntegerOrNull() ?: return previous
    if (newVersion < oldVersion) return previous
    return previous.copy(
        availableMinor = confirmed.availableMinor,
        balanceMinor = confirmed.balanceMinor,
        heldMinor = confirmed.heldMinor,
        version = confirmed.version
    )
}

/** A full statement must not roll the verified header back to an older row. */
fun mergeWalletFull218(previous: Wallet?, server: Wallet): Wallet {
    val merged = mergeWalletRefresh185(previous, server)
    if (previous == null || previous.currency != server.currency) return merged
    val previousVersion = previous.version.toBigIntegerOrNull() ?: return merged
    val serverVersion = server.version.toBigIntegerOrNull() ?: return merged
    if (previousVersion <= serverVersion) return merged
    return merged.copy(
        availableMinor = previous.availableMinor,
        balanceMinor = previous.balanceMinor,
        heldMinor = previous.heldMinor,
        version = previous.version
    )
}

/** Poll the verified lightweight endpoint in active casino games; never flood it. */
fun casinoWalletPollDelay217(): Long = 1_000L
