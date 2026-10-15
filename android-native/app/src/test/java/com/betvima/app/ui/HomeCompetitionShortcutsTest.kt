package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

/** Protect the exact approved Home artwork order and real-event navigation. */
class HomeCompetitionShortcutsTest {
    @Test fun approvedFiveBadgesLeadTheRibbon() {
        assertEquals(
            listOf("WNBA", "UFC Fight Night", "WTA Wuhan",
                "Markets", "NBA Pre-season"),
            homeCompetitionShortcuts.take(5).map { it.title }
        )
        assertEquals(16, homeCompetitionShortcuts.size)
        assertEquals((0..15).toList(), homeCompetitionShortcuts.map { it.picture })
        assertEquals(16, homeCompetitionShortcuts.map { it.key }.distinct().size)
        assertEquals("Europa League", homeCompetitionShortcuts.last().title)
    }

    @Test fun providerLeagueMatchingNeverConflatesPreseasonWithNormalNBA() {
        val preseason = homeCompetitionShortcuts.first { it.key == "nba-preseason" }
        assertTrue(leagueMatchesShortcut("USA NBA Preseason", preseason))
        assertTrue(leagueMatchesShortcut("NBA PRE-SEASON", preseason))
        assertFalse(leagueMatchesShortcut("NBA", preseason))
        assertFalse(leagueMatchesShortcut("NBA Replays", preseason))
    }

    @Test fun legitimateNamedLeaguesCanBeLocated() {
        val wta = homeCompetitionShortcuts.first { it.key == "wta-wuhan" }
        assertTrue(leagueMatchesShortcut("WTA 1000 Wuhan", wta))
        assertFalse(leagueMatchesShortcut("ATP Shanghai", wta))
        val europa = homeCompetitionShortcuts.first { it.key == "europa" }
        assertTrue(leagueMatchesShortcut("UEFA Europa League", europa))
        assertFalse(leagueMatchesShortcut("UEFA Europa Conference League", europa))
    }

    @Test fun marketsOpensRealTopBetsInsteadOfFabricatedFixtures() {
        val markets = homeCompetitionShortcuts.first { it.key == "markets" }
        assertTrue(markets.goToMarkets)
        assertTrue(markets.leagueAliases.isEmpty())
        assertFalse(homeCompetitionShortcuts.filterNot { it.goToMarkets }
            .any { it.leagueAliases.isEmpty() })
    }
}
