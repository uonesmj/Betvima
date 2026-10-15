package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

/** Guard customer-facing weekly cashback copy against imaginary entitlements. */
class VipCashbackBandsTest {
    @Test fun exactlyFivePublishedBandsWithRealWebsiteThresholds() {
        assertEquals(listOf("bronze", "silver", "gold", "platinum", "diamond"),
            vipCashbackBands.map { it.id })
        assertEquals(listOf(2000, 4000, 6000, 9000, 15000),
            vipCashbackBands.map { it.weeklyDepositUsd })
        assertEquals(listOf(3, 5, 6, 8, 11),
            vipCashbackBands.map { it.lossCashbackPercent })
    }

    @Test fun exampleUsesEligibleLossesNotDeposits() {
        assertEquals(listOf(30, 50, 60, 80, 110),
            vipCashbackBands.map { vipIllustrativeCashback(1000, it) })
        assertEquals(0, vipIllustrativeCashback(0, vipCashbackBands.last()))
        assertEquals(55, vipIllustrativeCashback(500, vipCashbackBands.last()))
    }

    @Test fun tiersAreStrictlyAscendingAndRatesAreBounded() {
        assertTrue(vipCashbackBands.zipWithNext()
            .all { (a, b) -> a.weeklyDepositUsd < b.weeklyDepositUsd })
        assertTrue(vipCashbackBands.zipWithNext()
            .all { (a, b) -> a.lossCashbackPercent < b.lossCashbackPercent })
        assertEquals(5, vipCashbackBands.map { it.id }.distinct().size)
        assertTrue(vipCashbackBands.all { it.lossCashbackPercent in 1..11 })
    }
}
