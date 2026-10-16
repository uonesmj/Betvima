package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class SlipProbabilityTest {
    private fun pick(id: String, market: String = "h2h", selection: String = "home") =
        Pick(id, market, selection, "Alpha vs Beta", "Match winner", "Alpha",
            "22000", 1, false)
    private fun outcome(id: String, code: String, odds: String) =
        SlipOddsSelection(id, code, code, odds, "open")
    private fun game(id: String = "m1", live: Boolean = false) = SlipOddsMatch(
        id, if (live) "live" else "scheduled", if (live) 35 else null,
        listOf(
            SlipOddsMarket("h2h", "h2h", "open", "", live, listOf(
                outcome("home", "HOME", "22000"), outcome("draw", "DRAW", "34000"),
                outcome("away", "AWAY", "32000")
            )),
            SlipOddsMarket("dnb", "draw_no_bet", "open", "", live, listOf(
                outcome("dnb-home", "HOME", "14500"),
                outcome("dnb-away", "AWAY", "26000")
            ))
        )
    )

    @Test fun bookmakerMarginRemovedAndNoPushForThreeWay() {
        val result = estimateSlipOutcome(listOf(pick("m1")), mapOf("m1" to game()))!!
        assertEquals(0.0, result.refund, 0.000000001)
        assertEquals(1.0, result.win + result.lose, 0.000000001)
        val rounded = slipOutcomePercents(result)
        assertEquals(100, rounded.win + rounded.lose + rounded.refund)
    }

    @Test fun drawNoBetUsesThreeWayDrawProbability() {
        val result = estimateSlipOutcome(
            listOf(pick("m1", "dnb", "dnb-home")), mapOf("m1" to game()))!!
        assertTrue(result.refund > 0.0)
        assertEquals(1.0, result.win + result.lose + result.refund, 0.000000001)
    }

    @Test fun multipleReturnsStakeOnlyIfEveryLegRefunds() {
        val games = mapOf("m1" to game(), "m2" to game("m2", true))
        val allDnb = estimateSlipOutcome(listOf(
            pick("m1", "dnb", "dnb-home"),
            pick("m2", "dnb", "dnb-away")
        ), games)!!
        val mixed = estimateSlipOutcome(listOf(
            pick("m1", "dnb", "dnb-home"), pick("m2")
        ), games)!!
        assertTrue(allDnb.refund > 0.0)
        assertEquals(0.0, mixed.refund, 0.000000001)
        assertTrue(mixed.live)
        assertEquals(1.0, mixed.win + mixed.lose + mixed.refund, 0.000000001)
    }

    @Test fun unavailableMarketNeverProducesInventedPercentages() {
        assertNull(estimateSlipOutcome(listOf(pick("m1")), emptyMap()))
        val suspended = game()
        val blocked = suspended.copy(markets = listOf(
            suspended.markets[0].copy(status = "suspended")
        ))
        assertNull(estimateSlipOutcome(listOf(pick("m1")), mapOf("m1" to blocked)))
        assertNull(estimateSlipOutcome(listOf(pick("m1")),
            mapOf("m1" to game().copy(status = "finished"))))
    }

    @Test fun updatesWhenLiveOddsChange() {
        val before = game("m1", true)
        val afterMarket = before.markets[0].copy(selections = listOf(
            outcome("home", "HOME", "15000"), outcome("draw", "DRAW", "42000"),
            outcome("away", "AWAY", "65000")
        ))
        val after = before.copy(markets = listOf(afterMarket, before.markets[1]))
        val older = estimateSlipOutcome(listOf(pick("m1")), mapOf("m1" to before))!!
        val newer = estimateSlipOutcome(listOf(pick("m1")), mapOf("m1" to after))!!
        assertTrue(newer.live)
        assertTrue(newer.win > older.win)
    }

    @Test fun integerHandicapsWithoutRefundModelFailClosed() {
        val source = game()
        val asian = SlipOddsMarket("asian", "spreads", "open", "2.0", false, listOf(
            outcome("a", "HOME", "19000"), outcome("b", "AWAY", "19000")
        ))
        assertNull(estimateSlipOutcome(listOf(pick("m1", "asian", "a")),
            mapOf("m1" to source.copy(markets = listOf(asian)))))
    }

    @Test fun percentRoundingHasNoOnePercentGap() {
        assertEquals(
            SlipOutcomePercent(34, 33, 33),
            slipOutcomePercents(SlipOutcome(1.0 / 3, 1.0 / 3, 1.0 / 3, false))
        )
    }
}
