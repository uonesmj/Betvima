package com.betvima.app.ui

import com.betvima.app.data.Match
import com.betvima.app.data.Team
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MatchNavigation123Test {
    private fun fixture(id: String) = Match(
        id = id, league = "Competition", leagueLogo = null, sport = "football",
        country = "International", starts = "2026-10-19T20:00:00Z",
        live = id.startsWith("betsapi:live:"), bettingAvailable = false,
        minute = null, homeScore = null, awayScore = null,
        teams = listOf(Team("Home", "HOME", null), Team("Away", "AWAY", null)),
        markets = emptyList(), marketsCount = 0
    )

    @Test fun selectedLiveFixtureRemainsAvailableWhenMarketServiceFails() {
        val live = fixture("betsapi:live:1:123456")
        assertEquals(live, selectedMatch123(live.id, null,
            listOf(live), emptyList(), emptyList(), emptyList()))
    }

    @Test fun selectedUpcomingFixtureUsesExactRequestedId() {
        val first = fixture("betsapi:upcoming:1:100")
        val second = fixture("betsapi:upcoming:1:101")
        assertEquals(second, selectedMatch123(second.id, null,
            emptyList(), listOf(first, second), emptyList(), emptyList()))
    }

    @Test fun previouslySelectedFixtureDoesNotOverrideNewTap() {
        val previous = fixture("betsapi:live:1:10")
        val selected = fixture("betsapi:live:1:11")
        assertEquals(selected, selectedMatch123(selected.id, previous,
            listOf(selected), emptyList(), emptyList(), emptyList()))
    }

    @Test fun searchResultsCanOpenDetailsWithoutHomeFixtureList() {
        val search = fixture("betsapi:upcoming:18:900")
        assertEquals(search, selectedMatch123(search.id, null,
            emptyList(), emptyList(), emptyList(), listOf(search)))
    }

    @Test fun unknownFixtureIsNotFabricated() {
        assertNull(selectedMatch123("missing", null,
            emptyList(), emptyList(), emptyList(), emptyList()))
    }
}
