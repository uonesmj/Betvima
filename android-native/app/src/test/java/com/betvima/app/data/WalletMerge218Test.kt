package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class WalletMerge218Test {
    private fun full(
        amount: String = "1000", version: String = "10",
        page: Int = 1, currency: String = "USD"
    ) = Wallet(
        availableMinor = amount, balanceMinor = amount,
        heldMinor = "0", currency = currency, integrity = "ok",
        transactions = listOf(Transaction("tx", "deposit", "1000", "2026-10-29")),
        page = page, version = version
    )
    private fun snapshot(
        amount: String = "800", version: String = "11", currency: String = "USD"
    ) = WalletBalance217(
        availableMinor = amount, balanceMinor = amount, heldMinor = "0",
        currency = currency, version = version
    )

    @Test fun coldHeaderCanStartWithOnlyAValidAuthenticatedSnapshot() {
        val result = applyWalletSnapshot218(null, snapshot())
        assertNotNull(result)
        assertEquals("800", result!!.availableMinor)
        assertEquals("11", result.version)
        assertEquals("unknown", result.integrity)
        assertTrue(result.transactions.isEmpty())
    }

    @Test fun coldHeaderNeverFabricatesNegativeOrInconsistentFunds() {
        val mismatch = WalletBalance217("800", "700", "0", "USD", "11")
        assertNull(applyWalletSnapshot218(null, mismatch))
        assertNull(applyWalletSnapshot218(null, snapshot("-800")))
        assertNull(applyWalletSnapshot218(null, snapshot(version = "-1")))
    }

    @Test fun heavyAccountResponseCannotReplaceANewerCasinoBalance() {
        val latest = applyWalletSnapshot218(full(), snapshot())!!
        val merged = mergeWalletServer218(latest, full("1000", version = "10"))
        assertEquals("800", merged.availableMinor)
        assertEquals("11", merged.version)
        assertEquals("ok", merged.integrity)
        assertEquals(listOf("tx"), merged.transactions.map { it.id })
    }

    @Test fun accountStatementAtNewerVersionCanUpdateTheHeader() {
        val latest = applyWalletSnapshot218(full(), snapshot())!!
        val merged = mergeWalletServer218(latest, full("700", version = "12"))
        assertEquals("700", merged.availableMinor)
        assertEquals("12", merged.version)
    }

    @Test fun fullStatementCanUpgradeColdBootstrapIntegrity() {
        val latest = applyWalletSnapshot218(null, snapshot())!!
        val updated = mergeWalletServer218(latest, full("800", version = "11"))
        assertEquals("ok", updated.integrity)
        assertEquals("800", updated.availableMinor)
        assertEquals(1, updated.transactions.size)
    }

    @Test fun recentCasinoFollowupIsTwoSecondsNotTwelve() {
        assertEquals(2_000L, walletRefreshDelay218(true, false))
        assertEquals(5_000L, walletRefreshDelay218(false, true))
        assertEquals(12_000L, walletRefreshDelay218(false, false))
    }

    @Test fun preserveHistoryWhenFullResponseIsOlder() {
        val previous = full("700", "19", page = 3)
        val result = mergeWalletServer218(previous, full("900", "18"))
        assertEquals("700", result.balanceMinor)
        assertEquals(3, result.page)
        assertEquals(previous.transactions, result.transactions)
    }
}
