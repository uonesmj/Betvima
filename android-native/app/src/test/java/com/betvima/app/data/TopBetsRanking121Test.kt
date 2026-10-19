package com.betvima.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TopBetsRanking121Test {
    private fun match(
        id: String, marketCount: Int, quotes: List<String>,
        live: Boolean = false, bettable: Boolean = false,
        starts: String = "2026-10-20T19:00:00Z"
    ) = Match(
        id = id, league = "Example league", leagueLogo = null, sport = "football",
        country = "International", starts = starts, live = live,
        bettingAvailable = bettable, minute = null, homeScore = null,
        awayScore = null, teams = listOf(
            Team("Home", "HOME", null), Team("Away", "AWAY", null)
        ),
        markets = if (quotes.isEmpty()) emptyList() else listOf(
            Market("m-$id", "h2h", "Fulltime Result", "suspended",
                quotes.mapIndexed { i, quote ->
                    Selection("preview-$i", "Option $i", quote, "suspended", 0, "STABLE")
                })
        ),
        marketsCount = marketCount
    )

    @Test fun suspendedProviderPricesRemainVisibleInTopBets() {
        val preview = match("preview", 19, listOf("17200", "36000", "45000"))
        assertEquals(listOf("preview"), TopBetsRanking121.ranked(emptyList(), listOf(preview))
            .map { it.id })
        // Ranking does not and must never unlock external bookmaker wagers.
        assertTrue(preview.markets.all { !it.available })
        assertTrue(preview.markets.flatMap { it.selections }.all { !it.available })
    }

    @Test fun sortsByMarketBreadthThenNumberOfDifferentQuotedOdds() {
        val top = match("rich", 70, listOf("19000", "20500"))
        val second = match("second", 14, listOf("11500", "24500", "38000"))
        val third = match("third", 14, listOf("18000", "18000", "35000"))
        val result = TopBetsRanking121.ranked(
            live = listOf(third),
            upcoming = listOf(second, top)
        )
        assertEquals(listOf("rich", "second", "third"), result.map { it.id })
    }

    @Test fun doesNotShowEmptyOrInvalidPricesEvenIfMarketCountIsHuge() {
        val empty = match("empty", 400, emptyList())
        val fake = match("fake", 250, listOf("10000", "0", "garbage"))
        val real = match("real", 3, listOf("13000"))
        assertEquals(listOf("real"), TopBetsRanking121.ranked(
            listOf(empty), listOf(real, fake)).map { it.id })
    }

    @Test fun mergesLiveAndUpcomingWithoutRepeatingTheSameEvent() {
        val event = match("same", 15, listOf("15500"),live = true)
        val other = match("other", 8, listOf("21000"))
        val ranked = TopBetsRanking121.ranked(listOf(event), listOf(event, other))
        assertEquals(listOf("same", "other"), ranked.map { it.id })
    }
}
