package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class SlipWinningsTest {
    private fun pick(oddsScaled: String) = Pick(
        "m", "market", "sel", "Alpha – Beta", "Match result", "Alpha",
        oddsScaled, 1, false
    )
    @Test fun oneDollarAt193() {
        val result = previewSlipWinnings("1.00", listOf(pick("19300")))!!
        assertEquals("1.93", result.returnUsd)
        assertEquals("0.93", result.profitUsd)
        assertEquals("1.93", result.combinedOdds)
    }
    @Test fun mixedLegsRoundOnlyAtEnd() {
        val result = previewSlipWinnings("1", listOf(pick("19300"), pick("24500")))!!
        assertEquals("4.73", result.returnUsd)
        assertEquals("3.73", result.profitUsd)
        assertEquals("4.73", result.combinedOdds)
    }
    @Test fun centsAreNotFloats() {
        val result = previewSlipWinnings("0.20", listOf(pick("12345")))!!
        assertEquals("0.25", result.returnUsd)
        assertEquals("0.05", result.profitUsd)
    }
    @Test fun invalidPricesAndStakesShowNoEstimates() {
        assertNull(previewSlipWinnings("0", listOf(pick("19300"))))
        assertNull(previewSlipWinnings("-1", listOf(pick("19300"))))
        assertNull(previewSlipWinnings("1.123", listOf(pick("19300"))))
        assertNull(previewSlipWinnings("1", emptyList()))
        assertNull(previewSlipWinnings("1", listOf(pick("0"))))
        assertNull(previewSlipWinnings("1", listOf(pick("10000"))))
    }
}
