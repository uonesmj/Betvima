package com.betvima.app.ui

import com.betvima.app.data.Bet
import org.junit.Assert.assertEquals
import org.junit.Test

/** Financial badges must use only server settlement fields, never live scores. */
class BetTrackingLabelsTest {
    private fun bet(status: String, net: String? = null) = Bet(
        id="test", status=status, type="SINGLE", stakeMinor="2000",
        payoutMinor="3800", currency="USD", legs=1, netResultMinor=net
    )

    @Test fun openBetsDoNotBecomeWinners() {
        assertEquals("Open", ticketResult(bet("accepted", "9999"), Lang.EN))
    }
    @Test fun settleOutcomeUsesNetResult() {
        assertEquals("Won", ticketResult(bet("settled","1800"), Lang.EN))
        assertEquals("Lost", ticketResult(bet("settled","-2000"), Lang.EN))
        assertEquals("Stake returned",ticketResult(bet("settled","0"),Lang.EN))
    }
    @Test fun voidAndRefundAreExplicit() {
        assertEquals("Refund / void", ticketResult(bet("void"),Lang.EN))
        assertEquals("Refund / void", ticketResult(bet("refunded"),Lang.EN))
    }
    @Test fun matchStatusIsIndependentFromBetGrade() {
        assertEquals("LIVE", matchPhase("in_play",Lang.EN))
        assertEquals("PRE-MATCH",matchPhase("scheduled",Lang.EN))
        assertEquals("FINISHED",matchPhase("finished",Lang.EN))
        assertEquals("Unknown phase",matchPhase("",Lang.EN))
    }
}
