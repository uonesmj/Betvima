package com.betvima.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.json.JSONObject
import org.junit.Test

class FinancialFormattingTest {
    @Test fun historyFiltersUseServerPaginationAndStableContract() {
        val today = java.time.LocalDate.parse("2026-10-14")
        assertEquals(
            "/api/v1/bets?pageSize=30&page=1&sortBy=placed_at&sortDirection=desc",
            betHistoryPath(BetHistoryQuery(), 1, today)
        )
        assertEquals(
            "/api/v1/bets?pageSize=30&page=2&sortBy=placed_at&sortDirection=desc" +
                "&status=pending%2Caccepted%2Cpartially_settled%2Cmanual_review" +
                "&type=MULTIPLE&q=ABC+123&from=2026-09-14",
            betHistoryPath(BetHistoryQuery(
                status = "open", type = "multiple", search = " ABC 123 ", days = 30),
                2, today)
        )
        assertTrue(betHistoryPath(BetHistoryQuery(status = "settled"), 1, today)
            .contains("cashed_out"))
        assertTrue(runCatching { betHistoryPath(BetHistoryQuery(status = "unknown"), 1) }
            .isFailure)
        assertTrue(runCatching { betHistoryPath(BetHistoryQuery(), 0) }.isFailure)
        assertTrue(runCatching { betHistoryPath(BetHistoryQuery(days = 3), 1) }.isFailure)
    }

    @Test fun nativeSearchEncodesTeamAndLeagueNames() {
        assertEquals("/api/v1/matches?live=true&page=1&pageSize=50&q=Real+Madrid",
            searchQueryPath(" Real Madrid ", true))
        assertEquals("/api/v1/matches?live=false&page=1&pageSize=50&q=Premier+League",
            searchQueryPath("Premier League", false))
        assertTrue(runCatching { searchQueryPath(" ", true) }.isFailure)
        assertTrue(runCatching { searchQueryPath("a".repeat(81), false) }.isFailure)
    }
    @Test fun topSportQueriesDoNotSendInventedSportId() {
        assertEquals("/api/v1/matches?live=false&page=1&pageSize=50", upcomingQueryPath("all"))
        assertEquals("/api/v1/matches?live=false&page=1&pageSize=50&sport=football",
            upcomingQueryPath("football"))
        assertEquals("/api/v1/matches?live=false&page=1&pageSize=50&sport=esports",
            upcomingQueryPath("esports"))
    }
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
        val pending = Bet("1", "accepted", "SINGLE", "1000", "2300", "USD", 1)
        assertFalse(pending.isSettled)
        assertEquals(null, pending.settledPayoutMinor)
        val won = pending.copy(status = "settled", settledPayoutMinor = "2300", netResultMinor = "1300")
        assertTrue(won.isSettled)
        assertEquals("13.00 USD", money(won.netResultMinor!!, won.currency))
        val lost = pending.copy(status = "settled", settledPayoutMinor = "0", netResultMinor = "-1000")
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
    @Test fun quoteUsesMarketRevisionNotSelectionOddsRevision() {
        val market = parseMarket(JSONObject("""
            {
              "id": "market-1", "key": "h2h", "nameEn": "Match Result",
              "nameFa": "نتیجه مسابقه", "status": "open", "version": 4,
              "selections": [
                {"id": "selection-1", "nameEn": "Home",
                 "nameFa": "میزبان", "status": "open",
                 "oddsScaled": "19500", "oddsVersion": 12}
              ]
            }
        """.trimIndent()))
        assertEquals(4, market.version)
        assertEquals(12, market.selections.single().version)
        assertTrue(market.selections.single().available)
        assertEquals("میزبان", market.selections.single().label(true))
        // List cards intentionally omit market.version; an invented zero must not be sent.
        val summary = parseMarket(JSONObject("""
            {"id":"market-2","key":"totals","nameEn":"Totals",
             "status":"open","selections":[]}
        """.trimIndent()))
        assertEquals(null, summary.version)
    }
    @Test fun canonicalServerBetStatusLifecycle() {
        val base = Bet("1", "pending", "MULTIPLE", "800", "2200", "USD", 2)
        for (status in listOf("pending", "accepted", "partially_settled", "manual_review")) {
            assertFalse(base.copy(status = status).isSettled)
        }
        for (status in listOf("settled", "void", "refunded", "cancelled", "cashed_out", "rejected")) {
            assertTrue(base.copy(status = status).isSettled)
        }
    }
    @Test fun localizationFallsBackToAuthoritativeEnglishWhenPersianIsMissing() {
        val market = Market("m", "h2h", "Match result", "open", emptyList(),
            nameFa = "نتیجه مسابقه")
        val selection = Selection("s", "Home win", "19500", "open", 1, "STABLE", nameFa = "برد میزبان")
        assertEquals("نتیجه مسابقه", market.label(true))
        assertEquals("Match result", market.label(false))
        assertEquals("برد میزبان", selection.label(true))
        assertEquals("Home win", selection.label(false))
        assertEquals("Home win", selection.copy(nameFa = "").label(true))
    }
    @Test fun suspendedMarketsCannotAppearAvailable() {
        val market = Market("m", "h2h", "Result", "suspended", emptyList())
        val selection = Selection("s", "Home", "18000", "suspended", 1, "STABLE")
        assertFalse(market.available)
        assertFalse(selection.available)
        assertTrue(market.copy(status = "open").available)
        assertTrue(selection.copy(status = "open").available)
        assertTrue(selection.copy(status = "active").available)
        assertFalse(selection.copy(status = "closed").available)
        assertFalse(selection.copy(status = "open", oddsScaled = "0").available)
        assertFalse(selection.copy(status = "open", oddsScaled = "garbled").available)
        assertFalse(selection.copy(status = "open", oddsScaled = "10000").available)
    }
}
