package com.betvima.app.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

/** The history UI must show the exact selection accepted at placement. */
class MyBetsSelectionFilterTest {
    private val api = ApiClient()

    private fun leg(): JSONObject = JSONObject()
        .put("matchLabel", "soccer_mls:provider-opaque-key")
        .put("marketLabel", "Total Goals - Over/Under")
        .put("selectionLabel", "Over 2.5")
        .put("status", "PENDING")
        .put("grade", JSONObject.NULL)
        .put("oddsAtPlacementScaled", "18700")
        .put("acceptedOddsScaled", "19300")
        .put("match", JSONObject()
            .put("leagueName", "MLS")
            .put("homeTeamName", "Real Salt Lake")
            .put("awayTeamName", "San Jose Earthquakes")
            .put("status", "in_play")
            .put("homeScore", 0)
            .put("awayScore", 0))

    @Test fun usesExactServerMarketAndSelectionAndAcceptedPrice() {
        val selection = api.parseBetLeg(leg())
        assertEquals("Over 2.5", selection.selectionLabel)
        assertEquals("Total Goals - Over/Under", selection.marketLabel)
        assertEquals("19300", selection.oddsScaled)
        assertEquals("Real Salt Lake", selection.homeTeamName)
        assertEquals("San Jose Earthquakes", selection.awayTeamName)
        assertEquals(0, selection.homeScore)
        assertEquals("PENDING", selection.status)
        assertEquals("", selection.result)
    }

    @Test fun fallsBackToPlacementOddsWhenAcceptedPriceMissingOrNull() {
        assertEquals("18700", api.parseBetLeg(leg().put("acceptedOddsScaled", JSONObject.NULL)).oddsScaled)
        val noAcceptedPrice = leg().apply { remove("acceptedOddsScaled") }
        assertEquals("18700", api.parseBetLeg(noAcceptedPrice).oddsScaled)
        assertEquals("18700", api.parseBetLeg(leg().put("acceptedOddsScaled", "0")).oddsScaled)
    }

    @Test fun popupFiltersUseServerQueryAndKeepAllDimensions() {
        val query = BetHistoryQuery(status = "open", type = "multiple",
            search = "Over 2.5", days = 7)
        val url = betHistoryPath(query, 2, LocalDate.parse("2026-10-15"))
        assertTrue(url.contains("page=2"))
        assertTrue(url.contains("type=MULTIPLE"))
        assertTrue(url.contains("status="))
        assertTrue(url.contains("q=Over+2.5"))
        assertTrue(url.contains("from=2026-10-08"))
        assertTrue(url.contains("pending%2Caccepted%2Cpartially_settled"))
        assertFalse(url.contains("status=settled%2C"))
        assertEquals("all", query.copy(status = "all").status)
        assertEquals(0, query.copy(days = 0).days)
    }
}
