package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class WalletBalance217Test {
    private fun wallet(
        balance: String = "10000", version: String = "5", currency: String = "USD"
    ) = Wallet(
        availableMinor = balance, balanceMinor = balance, heldMinor = "0",
        currency = currency, integrity = "ok",
        transactions = listOf(Transaction("tx-1", "deposit", "10000", "2026-10-29")),
        page = 2, hasMore = true, version = version
    )

    private fun snapshot(
        available: String, version: String = "6", currency: String = "USD",
        balance: String = available, held: String = "0"
    ) = WalletBalance217(available, balance, held, currency, version)

    @Test fun nextConfirmedDebitUpdatesHeaderWithoutLosingStatement() {
        val previous = wallet()
        val actual = applyWalletBalance217(previous, snapshot("9750"))!!
        assertEquals("9750", actual.availableMinor)
        assertEquals("6", actual.version)
        assertEquals(previous.transactions, actual.transactions)
        assertEquals(previous.page, actual.page)
        assertEquals(previous.payments, actual.payments)
        assertEquals("ok", actual.integrity)
    }

    @Test fun olderSnapshotCannotRollbackAConfirmedBalance() {
        val previous = wallet("9750", version = "9")
        assertEquals(previous, applyWalletBalance217(previous, snapshot("10000", version = "8")))
        assertEquals(previous, applyWalletBalance217(previous, snapshot("5000", version = "0")))
    }

    @Test fun wrongCurrencyCannotOverwriteWallet() {
        val previous = wallet(currency = "IRR")
        assertEquals(previous, applyWalletBalance217(previous, snapshot("9750",currency = "USD")))
    }

    @Test fun invalidOrInconsistentAmountsAreRejected() {
        val previous = wallet()
        assertEquals(previous, applyWalletBalance217(previous,
            snapshot("9999", balance = "9000", held = "0")))
        assertEquals(previous, applyWalletBalance217(previous,
            snapshot("-10")))
        assertEquals(previous, applyWalletBalance217(previous,
            snapshot("not-a-number")))
    }

    @Test fun firstVerifiedSnapshotPopulatesHeaderBeforeFullStatement() {
        val boot = applyWalletBalance217(null, snapshot("12000", version = "27"))!!
        assertEquals("12000", boot.availableMinor)
        assertEquals("27", boot.version)
        assertEquals("unknown", boot.integrity)
        assertTrue(boot.transactions.isEmpty())
        // The full integrity check is required before financial operations.
        assertNotEquals("ok", boot.integrity)
    }

    @Test fun slowInitialStatementCannotUndoNewerSpinBalance() {
        val header = applyWalletBalance217(null, snapshot("9750", version = "9"))!!
        val staleFull = wallet(balance = "10000", version = "7")
        val merged = mergeWalletFull218(header, staleFull)
        assertEquals("9750", merged.availableMinor)
        assertEquals("9", merged.version)
        assertEquals("ok", merged.integrity)
        assertEquals(staleFull.transactions, merged.transactions)
    }

    @Test fun fullAccountReadAfterBootstrapRestoresAuthoritativeIntegrityAndHistory() {
        val header = applyWalletBalance217(null, snapshot("9750", version = "9"))!!
        val full = wallet(balance = "9500", version = "10")
        val merged = mergeWalletFull218(header, full)
        assertEquals("9500", merged.availableMinor)
        assertEquals("10", merged.version)
        assertEquals("ok", merged.integrity)
        assertEquals(full.transactions, merged.transactions)
    }

    @Test fun sameCurrencyNewerFullReadAlwaysWins() {
        val oldHeader = wallet(balance = "9750", version = "9")
        val updatedFull = wallet(balance = "9600", version = "11")
        assertEquals("9600", mergeWalletFull218(oldHeader, updatedFull).availableMinor)
    }

    @Test fun firstInvalidSnapshotDoesNotInventBalance() {
        assertNull(applyWalletBalance217(null, snapshot("12000", balance = "10000")))
    }

    @Test fun realMoneyCadenceIsBounded() {
        assertEquals(1000L, casinoWalletPollDelay217())
    }
}
