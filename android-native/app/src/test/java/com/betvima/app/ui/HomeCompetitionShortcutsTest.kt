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

    @Test fun containedLeagueCardsKeepArtworkAndTitlesInsideBounds() {
        assertEquals(76, HomeLeagueBadgeLayout.diameterDp)
        assertEquals(106, HomeLeagueBadgeLayout.cardWidthDp)
        assertEquals(144, HomeLeagueBadgeLayout.cardHeightDp)
        assertEquals(92, HomeLeagueBadgeLayout.imageFrameDp)
        assertTrue(HomeLeagueBadgeLayout.imageFrameDp >= HomeLeagueBadgeLayout.diameterDp)
        assertTrue(HomeLeagueBadgeLayout.cardWidthDp > HomeLeagueBadgeLayout.diameterDp)
        assertTrue(HomeLeagueBadgeLayout.cardHeightDp >
            HomeLeagueBadgeLayout.imageFrameDp + 4)
    }

    @Test fun allSixteenBadgesUseTheSameNonClippingAtlasCrop() {
        assertEquals(512, HomeLeagueBadgeLayout.sourceTilePx)
        assertEquals(4, HomeLeagueBadgeLayout.cropInsetPx)
        assertEquals(504, HomeLeagueBadgeLayout.cropSizePx)
        assertEquals(HomeLeagueBadgeLayout.sourceTilePx,
            HomeLeagueBadgeLayout.cropSizePx + 2 * HomeLeagueBadgeLayout.cropInsetPx)
        for (index in 0..15) {
            assertTrue(HomeLeagueBadgeLayout.cropSizeFor(index) > 0)
            assertTrue(HomeLeagueBadgeLayout.cropInsetFor(index) >= 0)
        }
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
