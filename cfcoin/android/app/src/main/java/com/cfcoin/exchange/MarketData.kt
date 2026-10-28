package com.cfcoin.exchange

/**
 * Fixed illustrative numbers for UI development only.
 * DO NOT treat these prices as market data or place real orders.
 */
data class MarketCoin(
    val ticker: String,
    val fullName: String,
    val priceUsdt: String,
    val change24h: Double,
    val sparkline: List<Float>
)

enum class MarketFilter { FAVORITES, GAINERS, LOSERS, ALL }

val SAMPLE_MARKETS = listOf(
    MarketCoin("BTC", "Bitcoin", "98,450.20", 2.84, listOf(2f, 2.5f, 2.2f, 3.6f, 3.2f, 4.4f, 4.1f, 5.2f)),
    MarketCoin("ETH", "Ethereum", "3,224.80", 1.42, listOf(1f, 1.6f, 1.4f, 2.5f, 2.0f, 2.7f, 3.1f, 3.4f)),
    MarketCoin("SOL", "Solana", "188.35", 6.73, listOf(1f, 2.1f, 1.7f, 2.7f, 2.5f, 4.4f, 4.0f, 5.4f)),
    MarketCoin("XRP", "XRP", "2.1840", -1.85, listOf(5f, 4.5f, 4.7f, 3.7f, 4f, 2.7f, 2.9f, 2f)),
    MarketCoin("BNB", "BNB", "624.70", 0.96, listOf(2f, 2.2f, 2.0f, 3.3f, 2.8f, 3.5f, 3.1f, 3.7f)),
    MarketCoin("DOGE", "Dogecoin", "0.2384", -3.32, listOf(5f, 4.2f, 4.7f, 3.6f, 3.9f, 3.0f, 2.5f, 1.8f)),
    MarketCoin("ADA", "Cardano", "0.7840", 4.18, listOf(1f, 1.7f, 1.5f, 2.3f, 2.1f, 3.4f, 3.8f, 4.7f)),
    MarketCoin("TRX", "TRON", "0.2531", -0.57, listOf(4f, 4.1f, 3.8f, 3.9f, 3.4f, 3.7f, 3.2f, 3.1f))
)

fun filterMarkets(
    markets: List<MarketCoin>,
    filter: MarketFilter,
    favorites: Set<String>,
    query: String = ""
): List<MarketCoin> {
    val searched = markets.filter {
        it.ticker.contains(query.trim(), ignoreCase = true) ||
            it.fullName.contains(query.trim(), ignoreCase = true) ||
            (it.ticker + "/USDT").contains(query.trim(), ignoreCase = true)
    }
    return when (filter) {
        MarketFilter.FAVORITES -> searched.filter { it.ticker in favorites }
        MarketFilter.GAINERS -> searched.filter { it.change24h > 0 }.sortedByDescending { it.change24h }
        MarketFilter.LOSERS -> searched.filter { it.change24h < 0 }.sortedBy { it.change24h }
        MarketFilter.ALL -> searched
    }
}
