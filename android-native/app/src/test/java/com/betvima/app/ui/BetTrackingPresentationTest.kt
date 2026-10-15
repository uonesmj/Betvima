package com.betvima.app.ui

import com.betvima.app.data.Bet
import com.betvima.app.data.BetLegDetail
import org.junit.Assert.*
import org.junit.Test

class BetTrackingPresentationTest {
    private fun leg(match: String = "soccer_usa_mls:459f43c4903354a424f70a7c61376082b297a6ac-9eaf-4a7a-b2af-bb39d92b60e3") =
        BetLegDetail(matchLabel = match, marketLabel = "Asian Handicap",
            selectionLabel = "Real Salt Lake", oddsScaled = "18500",
            status = "PENDING", league = "MLS", result = "")

    @Test fun providerIdentifiersNeverBecomePublicMatchTitles() {
        assertFalse(validPublicMatchLabel(leg().matchLabel))
        assertFalse(validPublicMatchLabel("459f43c4-9033-54a4-24f7-0a7c61376082"))
        assertEquals("Match details unavailable", fixtureTitle(leg(), null, Lang.EN))
        assertEquals("نام مسابقه در دسترس نیست", fixtureTitle(leg(), null, Lang.FA))
    }

    @Test fun historicalBetIncludesOfficialTeamsEvenWhenProviderMatchLabelIsOpaque() {
        val serverBetLeg = leg().copy(
            homeTeamName = "Real Salt Lake",
            awayTeamName = "LA Galaxy",
            homeTeamLogoUrl = "https://example.org/logo-home.png"
        )
        assertEquals("Real Salt Lake — LA Galaxy",
            fixtureTitle(serverBetLeg, null, Lang.EN))
    }

    @Test fun readableMatchNamesSurvive() {
        val selected = leg("Real Salt Lake — LA Galaxy")
        assertTrue(validPublicMatchLabel(selected.matchLabel))
        assertEquals(selected.matchLabel, fixtureTitle(selected, null, Lang.EN))
    }

    @Test fun onlyConfirmedFinancialResultMayDeclareWinOrLoss() {
        fun bet(status: String, result: String?) = Bet(
            id = "sample", status = status, type = "SINGLE", stakeMinor = "160",
            payoutMinor = "296", currency = "USD", legs = 1,
            netResultMinor = result
        )
        assertEquals("Open", ticketResult(bet("accepted", null), Lang.EN))
        assertEquals("Won", ticketResult(bet("settled", "136"), Lang.EN))
        assertEquals("Lost", ticketResult(bet("settled", "-160"), Lang.EN))
        assertEquals("Settled", ticketResult(bet("settled", null), Lang.EN))
        assertEquals("Stake returned", ticketResult(bet("settled", "0"), Lang.EN))
    }

    @Test fun receiptDoesNotLabelOpenTicketWon() {
        assertEquals("Open", receiptStatus("accepted", "136", Lang.EN))
        assertEquals("Won", receiptStatus("settled", "136", Lang.EN))
        assertEquals("Lost", receiptStatus("settled", "-100", Lang.EN))
        assertEquals("Settled", receiptStatus("settled", null, Lang.EN))
    }
}
