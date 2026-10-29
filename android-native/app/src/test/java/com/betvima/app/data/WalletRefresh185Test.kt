package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class WalletRefresh185Test {
    private fun wallet(balance: String, page: Int = 1, currency: String = "USD",
        transactions: List<Transaction> = emptyList(), hasMore: Boolean = false
    ) = Wallet(
        availableMinor = balance, balanceMinor = balance,
        heldMinor = "0", currency = currency, integrity = "ok",
        transactions = transactions, page = page, hasMore = hasMore
    )

    @Test fun refreshDisplaysOnlyTheLatestServerConfirmedBalance() {
        val first = wallet("1000")
        val fresh = wallet("3500")
        val merged = mergeWalletRefresh185(first, fresh)
        assertEquals("3500", merged.availableMinor)
        assertEquals("3500", merged.balanceMinor)
        assertEquals(1, merged.page)
    }

    @Test fun freshStatementDoesNotErasePreviouslyLoadedTransactionHistory() {
        val earlier = Transaction("earlier", "deposit", "1000", "2026-10-20")
        val latest = Transaction("new", "deposit", "2500", "2026-10-25")
        val old = wallet("1000", page = 2, transactions = listOf(earlier), hasMore = true)
        val updated = wallet("3500", page = 1, transactions = listOf(latest, earlier))
        val merged = mergeWalletRefresh185(old, updated)
        assertEquals("3500", merged.availableMinor)
        assertEquals(listOf("new", "earlier"), merged.transactions.map { it.id })
        assertEquals(2, merged.page)
        assertTrue(merged.hasMore)
    }

    @Test fun differentCurrencyDiscardOldStatementInsteadOfMixingFunds() {
        val old = wallet("200000", page = 3, currency = "IRR",
            transactions = listOf(Transaction("old", "deposit", "200000", "2026-10-24")))
        val fresh = wallet("1000", currency = "USD")
        assertEquals(fresh, mergeWalletRefresh185(old, fresh))
    }

    @Test fun slowStatementCannotUndoNewerCasinoDebit() {
        val confirmed = wallet("9829").copy(version = "12")
        val slowStatement = wallet("9849", transactions =
            listOf(Transaction("new", "spin", "-20", "2026-10-29"))).copy(version = "11")
        val merged = mergeWalletRefresh185(confirmed, slowStatement)
        assertEquals("9829", merged.availableMinor)
        assertEquals("9829", merged.balanceMinor)
        assertEquals("12", merged.version)
        assertEquals("new", merged.transactions.single().id)
    }

    @Test fun laterVersionReplacesCasinoSnapshotCorrectly() {
        val confirmed = wallet("9829").copy(version = "12")
        val updated = wallet("9851").copy(version = "13")
        val merged = mergeWalletRefresh185(confirmed, updated)
        assertEquals("9851", merged.availableMinor)
        assertEquals("13", merged.version)
    }

    @Test fun wrongCurrencyDoesNotCarryStaleCasinoBalance() {
        val previous = wallet("9829", currency = "USD").copy(version = "12")
        val server = wallet("400000", currency = "IRR").copy(version = "4")
        assertEquals(server, mergeWalletRefresh185(previous, server))
    }

    @Test fun activeWalletPollCadenceIsBounded() {
        assertEquals(5_000L, walletRefreshDelay185(true))
        assertEquals(12_000L, walletRefreshDelay185(false))
    }
}
