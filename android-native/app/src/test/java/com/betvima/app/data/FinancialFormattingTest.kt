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
    @Test fun suspendedMarketsCannotAppearAvailable() {
        val market = Market("m", "h2h", "Result", "suspended", emptyList())
        val selection = Selection("s", "Home", "18000", "suspended", 1, "STABLE")
        assertFalse(market.available)
        assertFalse(selection.available)
        assertTrue(market.copy(status = "open").available)
    }
}
