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
    @Test fun irrWalletShowsReturnAndProfitInWholeRialsNotDollars() {
        val result = previewSlipWinnings("10000", listOf(pick("40000")), "IRR")!!
        assertEquals("10000", result.stakeUsd)
        assertEquals("40000", result.returnUsd)
        assertEquals("30000", result.profitUsd)
        assertEquals("40,000 IRR", formatSlipOutcome(result.returnUsd, "IRR", false))
        assertEquals("30,000 IRR", formatSlipOutcome(result.profitUsd, "IRR", false))
        assertFalse(formatSlipOutcome(result.returnUsd, "IRR", false)!!.contains("$"))
    }

    @Test fun legacyTomanWalletConvertsDisplayOnlyAndDoesNotChangePayoutUnits() {
        val result = previewSlipWinnings("10000", listOf(pick("40000")), "IRT")!!
        assertEquals("40000", result.returnUsd) // 40,000 toman in wallet ledger
        assertEquals("400,000 IRR", formatSlipOutcome(result.returnUsd, "IRT", false))
        assertEquals("300,000 IRR", formatSlipOutcome(result.profitUsd, "IRT", false))
    }

    @Test fun fiatRoundsAtWholeRialAndUsdRetainsCents() {
        val fiat = previewSlipWinnings("101", listOf(pick("12345")), "IRR")!!
        assertEquals("125", fiat.returnUsd)
        assertEquals("24", fiat.profitUsd)
        assertEquals("125 IRR", formatSlipOutcome(fiat.returnUsd, "IRR", false))
        val usd = previewSlipWinnings("1.00", listOf(pick("40000")), "USD")!!
        assertEquals("$4.00", formatSlipOutcome(usd.returnUsd, "USD", false))
        assertEquals("$3.00", formatSlipOutcome(usd.profitUsd, "USD", false))
        assertNull(previewSlipWinnings("100.25", listOf(pick("40000")), "IRR"))
        assertNull(previewSlipWinnings("100", listOf(pick("40000")), "EUR"))
        assertNull(formatSlipOutcome("40000", "DOGE", false))
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
