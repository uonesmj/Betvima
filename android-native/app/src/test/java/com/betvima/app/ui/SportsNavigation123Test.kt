package com.betvima.app.ui

import com.betvima.app.data.Match
import com.betvima.app.data.Team
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SportsNavigation123Test {
    private fun fixture(id: String) = Match(
        id = id, league = "Verified fixture", leagueLogo = null,
        sport = "football", country = "International",
        starts = "2026-10-19T19:00:00Z",
        live = true, bettingAvailable = false,
        minute = 35, homeScore = 1, awayScore = 0,
        teams = listOf(Team("Home","HOME",null),Team("Away","AWAY",null)),
        markets = emptyList(), marketsCount = 18
    )

    @Test fun tapOpensVerifiedFixtureImmediatelyBeforeMarketResponse() {
        val source = fixture("betsapi:live:1:12410")
        val result = beginMatchNavigation123(AppState(live=listOf(source)), source.id)
        assertEquals(source.id, result.detail?.id)
        assertTrue(result.detailLoading)
        assertNull(result.detailError)
    }

    @Test fun transientMarketFailureKeepsOpenedMatchAndDoesNotReturnHome() {
        val source = fixture("betsapi:upcoming:1:18406")
        val opened = beginMatchNavigation123(AppState(upcoming=listOf(source)), source.id)
        val failed = failedMatchNavigation123(opened, "Markets unavailable")
        assertFalse(failed.detailLoading)
        assertNotNull(failed.detail)
        assertEquals(source.id, failed.detail?.id)
        assertEquals("Markets unavailable",failed.detailError)
    }

    @Test fun searchResultCanOpenDespiteMissingCachedMarketDetails() {
        val search = fixture("betsapi:live:1:55829")
        val opened = beginMatchNavigation123(AppState(searchLive=listOf(search)),search.id)
        assertEquals(search.id,opened.detail?.id)
    }

    @Test fun missingFixtureNeverDisplaysUnrelatedPreviousMatch() {
        val first = fixture("betsapi:live:1:1")
        val state = AppState(detail=first)
        val opened = beginMatchNavigation123(state,"betsapi:upcoming:1:2")
        assertNull(opened.detail)
    }
}
