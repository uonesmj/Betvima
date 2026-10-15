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

    @Test fun enlargedCircularBadgesHaveSafeFullBleedSourceCrop() {
        assertEquals(80, HomeLeagueBadgeLayout.diameterDp)
        assertEquals(88, HomeLeagueBadgeLayout.cardWidthDp)
        assertTrue(HomeLeagueBadgeLayout.diameterDp * 4 >= 64 * 5)
        assertTrue(HomeLeagueBadgeLayout.cardWidthDp * 4 >= 70 * 5)
        assertEquals(512, HomeLeagueBadgeLayout.sourceTilePx)
        assertEquals(4, HomeLeagueBadgeLayout.cropInsetPx)
        assertEquals(
            HomeLeagueBadgeLayout.sourceTilePx,
            HomeLeagueBadgeLayout.cropSizePx +
                (2 * HomeLeagueBadgeLayout.cropInsetPx)
        )
        assertTrue(HomeLeagueBadgeLayout.cropSizePx > 0)
    }

    @Test fun opticalCroppingIsCorrectedWithoutChangingCircleDimensions() {
        assertEquals(20, HomeLeagueBadgeLayout.cropInsetFor(2))
        assertEquals(20, HomeLeagueBadgeLayout.cropInsetFor(4))
        assertEquals(4, HomeLeagueBadgeLayout.cropInsetFor(0))
        assertEquals(4, HomeLeagueBadgeLayout.cropInsetFor(15))
        assertEquals(
            HomeLeagueBadgeLayout.sourceTilePx,
            HomeLeagueBadgeLayout.cropSizeFor(2) +
                HomeLeagueBadgeLayout.cropInsetFor(2) * 2
        )
        assertTrue(HomeLeagueBadgeLayout.cropSizeFor(2) > 0)
        assertEquals(80, HomeLeagueBadgeLayout.diameterDp)
    }

    @Test fun carouselRevealIsBoundedAndFadesOnlyNearEdges() {
        val center = competitionRibbonReveal(
            itemCenterPx = 500f, viewportStartPx = 0f,
            viewportEndPx = 1000f, itemSizePx = 90f
        )
        assertEquals(1f, center.scale, .0001f)
        assertEquals(1f, center.alpha, .0001f)
        assertEquals(0f, center.translationDp, .0001f)

        val entering = competitionRibbonReveal(
            itemCenterPx = 0f, viewportStartPx = 0f,
            viewportEndPx = 1000f, itemSizePx = 90f
        )
        assertTrue(entering.scale in .93f..1f)
        assertTrue(entering.alpha in .80f..1f)
        assertTrue(entering.translationDp > 0f)

        val leaving = competitionRibbonReveal(
            itemCenterPx = 1000f, viewportStartPx = 0f,
            viewportEndPx = 1000f, itemSizePx = 90f
        )
        assertTrue(leaving.translationDp < 0f)
        val invalid = competitionRibbonReveal(0f, 0f, 100f, 0f)
        assertEquals(1f, invalid.scale, .0001f)
    }

    @Test fun marketsOpensRealTopBetsInsteadOfFabricatedFixtures() {
        val markets = homeCompetitionShortcuts.first { it.key == "markets" }
        assertTrue(markets.goToMarkets)
        assertTrue(markets.leagueAliases.isEmpty())
        assertFalse(homeCompetitionShortcuts.filterNot { it.goToMarkets }
            .any { it.leagueAliases.isEmpty() })
    }
}
