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

    @Test fun fastBalanceOnlyChangesVerifiedMoneyAndPreservesHistory() {
        val transaction = Transaction("receipt", "bet_debit", "-50", "2026-10-29")
        val previous = wallet("2000", page = 2,
            transactions = listOf(transaction), hasMore = true)
            .copy(heldMinor = "100", integrity = "ok", version = 10)
        val snap = WalletBalanceSnapshot217("1850","1950","100","USD",11)
        val merged = mergeWalletBalanceSnapshot217(previous, snap)
        assertEquals("1850", merged.availableMinor)
        assertEquals("1950", merged.balanceMinor)
        assertEquals("100", merged.heldMinor)
        assertEquals(11, merged.version)
        assertEquals("ok", merged.integrity)
        assertEquals(2, merged.page)
        assertEquals(listOf("receipt"), merged.transactions.map { it.id })
        assertTrue(merged.hasMore)
    }

    @Test fun versionGuardRejectsStaleOrWrongCurrencySnapshots() {
        val current = wallet("1500").copy(version=42)
        assertEquals(current, mergeWalletBalanceSnapshot217(current,
            WalletBalanceSnapshot217("800","800","0","USD",41)))
        assertEquals(current, mergeWalletBalanceSnapshot217(current,
            WalletBalanceSnapshot217("800","800","0","IRR",43)))
    }

    @Test fun versionGuardRejectsStaleFullWalletStatement() {
        val current = wallet("900").copy(version=50)
        val stale = wallet("2000").copy(version=49)
        assertEquals(current, mergeWalletRefresh185(current, stale))
    }

    @Test fun casinoBalancePollIsBoundedToForegroundPlay() {
        assertEquals(1_200L, casinoWalletPollInterval217(true))
        assertEquals(2_500L, casinoWalletPollInterval217(false))
    }

    @Test fun activeWalletPollCadenceIsBounded() {
        assertEquals(5_000L, walletRefreshDelay185(true))
        assertEquals(12_000L, walletRefreshDelay185(false))
    }
}
