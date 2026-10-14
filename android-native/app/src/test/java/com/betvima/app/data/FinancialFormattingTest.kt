package com.betvima.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FinancialFormattingTest {
    @Test fun fixedPointOddsAreNotTreatedAsDecimalOdds() {
        assertEquals("1.93", odds("19300"))
        assertEquals("2.00", odds("20000"))
        assertEquals("1.01", odds("10100"))
    }
    @Test fun usdMinorUnitsAreCents() {
        assertEquals("12.34 USD", money("1234", "USD"))
        assertEquals("0.20 USD", money("20", "USD"))
        assertEquals("2000 IRR", money("2000", "IRR"))
    }
    @Test fun doNotTreatPotentialPayoutAsSettledMoney() {
        val pending = Bet("1", "placed", "SINGLE", "1000", "2300", "USD", 1)
        assertFalse(pending.isSettled)
        assertEquals(null, pending.settledPayoutMinor)
        val won = pending.copy(status = "won", settledPayoutMinor = "2300", netResultMinor = "1300")
        assertTrue(won.isSettled)
        assertEquals("13.00 USD", money(won.netResultMinor!!, won.currency))
        val lost = pending.copy(status = "lost", settledPayoutMinor = "0", netResultMinor = "-1000")
        assertTrue(lost.isSettled)
        assertEquals("-10.00 USD", money(lost.netResultMinor!!, lost.currency))
    }
    @Test fun ledgerPaginationNeverChangesMoneyFormat() {
        val old = Wallet("12345", "12500", "155", "USD", "ok",
            listOf(Transaction("a", "credit", "100", "2026-10-14")), page = 1, hasMore = true)
        val next = old.copy(transactions = old.transactions +
            Transaction("b", "debit", "-200", "2026-10-13"), page = 2, hasMore = false)
        assertEquals("123.45 USD", money(next.availableMinor, next.currency))
        assertEquals(2, next.transactions.size)
        assertFalse(next.hasMore)
    }
    @Test fun suspendedMarketsCannotAppearAvailable() {
        val market = Market("m", "h2h", "Result", "suspended", emptyList())
        val selection = Selection("s", "Home", "18000", "suspended", 1, "STABLE")
        assertFalse(market.available)
        assertFalse(selection.available)
        assertTrue(market.copy(status = "open").available)
    }
}
