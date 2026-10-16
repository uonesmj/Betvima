package com.betvima.app.ui

import com.betvima.app.data.Match
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveCatalogueCounts88Test {
    private fun fixture(
        id: String, sport: String, league: String = "League A",
        country: String = "INT",
    ) = Match(
        id = id, league = league, leagueLogo = null, sport = sport,
        country = country, starts = "2026-10-17T12:00:00Z",
        live = true, bettingAvailable = false, minute = 27,
        homeScore = 1, awayScore = 0,
        teams = emptyList(), markets = emptyList(), marketsCount = 0,
    )

    @Test fun totalCounterMatchesAllRenderedLeagueFixturesWhenExpanded() {
        val live = listOf(
            fixture("f1", "football"), fixture("f2", "football"),
            fixture("b1", "baseball"), fixture("b2", "baseball"),
            fixture("m1", "mma"),
        )
        val groups = live.groupBy { catalogueGroupKey88(it, true) }
        assertEquals(5, live.size)
        assertEquals(5, visibleFixtureCount88(groups, emptyList()))
        val collapsedBaseball = listOf(catalogueGroupKey88(live[2], true))
        assertEquals(3, visibleFixtureCount88(groups, collapsedBaseball))
        assertEquals(0, visibleFixtureCount88(groups, groups.keys))
        assertEquals(5, visibleFixtureCount88(groups, emptyList()))
    }

    @Test fun sportCountsAreFromExactlyTheLoadedFixtures() {
        val fixtures = listOf(
            fixture("f1", "football"), fixture("b1", "baseball"),
            fixture("m1", "mma"), fixture("m2", "mma"),
            fixture("c1", "cricket"),
        )
        val totals = liveSportTotals88(fixtures)
        assertEquals(fixtures.size, totals.values.sum())
        assertEquals(2, totals["mma"])
        assertEquals(1, totals["baseball"])
        assertEquals(0, totals["tennis"] ?: 0)
        assertEquals(2, liveSportMatches88(fixtures, "mma").size)
        assertEquals(5, liveSportMatches88(fixtures, "top").size)
        assertEquals(5, liveSportMatches88(fixtures, "all").size)
        assertEquals(0, liveSportMatches88(fixtures, "boxing").size)
    }

    @Test fun groupingNeverMergesSeparateSportsWithSameLeagueNameAndCountry() {
        val two = listOf(
            fixture("s1", "football", "Premier", "GB"),
            fixture("s2", "basketball", "Premier", "GB"),
        )
        assertEquals(2, two.groupBy { catalogueGroupKey88(it, true) }.size)
        // Upcoming groups retain old keys, so tournament selectors remain valid.
        assertEquals(1, two.groupBy { catalogueGroupKey88(it, false) }.size)
    }

    @Test fun categoriesCoverSupportedSportsWithoutInventingFixtures() {
        for (sport in listOf("football", "baseball", "cricket", "mma", "boxing",
            "handball", "american-football", "table-tennis", "hockey", "other")) {
            assertTrue(liveSportKeys88.contains(sport))
        }
        assertFalse(liveSportKeys88.contains("fake-sport"))
    }
}
