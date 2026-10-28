package com.cfcoin.exchange

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarketDataTest {
    @Test fun favoritesShowOnlySelectedAssets() {
        assertEquals(listOf("BTC"), filterMarkets(SAMPLE_MARKETS, MarketFilter.FAVORITES, setOf("BTC")).map { it.ticker })
    }
    @Test fun gainersSortDescending() {
        val result = filterMarkets(SAMPLE_MARKETS, MarketFilter.GAINERS, emptySet())
        assertEquals("SOL", result.first().ticker)
        assertTrue(result.all { it.change24h > 0 })
    }
    @Test fun losersSortAscending() {
        val result = filterMarkets(SAMPLE_MARKETS, MarketFilter.LOSERS, emptySet())
        assertEquals("DOGE", result.first().ticker)
        assertTrue(result.all { it.change24h < 0 })
    }
    @Test fun searchIgnoresCase() {
        assertEquals(listOf("ETH"), filterMarkets(SAMPLE_MARKETS, MarketFilter.ALL, emptySet(), "eth").map { it.ticker })
    }
}
