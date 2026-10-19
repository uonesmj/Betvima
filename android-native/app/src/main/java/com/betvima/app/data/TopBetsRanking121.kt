package com.betvima.app.data

import java.math.BigDecimal

/**
 * Rank sportsbook cards by the provider's market breadth, not by a fabricated
 * trend, and never conflate display-only bookmaker quotes with locally bettable
 * selections. Bet365 preview outcomes are intentionally "suspended" and carry
 * no actionable BetVima wager IDs.
 */
internal object TopBetsRanking121 {
    private val minimumDecimalScaled = BigDecimal("10000")

    private fun quotedSelections(match: Match): List<Selection> =
        match.markets.flatMap { it.selections }
            .filter { it.oddsScaled.toBigDecimalOrNull()?.let { scaled ->
                scaled > minimumDecimalScaled && scaled <= BigDecimal("1000000000")
            } == true }

    fun ranked(live: List<Match>, upcoming: List<Match>): List<Match> =
        (live + upcoming)
            // Some provider pages can repeat the same event within a fetch.
            .distinctBy { it.id }
            // Top Bets must contain at least one actual quoted outcome.
            // A nonzero "marketsCount" by itself is NOT evidence of an odd.
            .filter { quotedSelections(it).isNotEmpty() }
            .sortedWith(
                compareByDescending<Match> {
                    it.marketsCount.coerceAtLeast(it.markets.count { market ->
                        market.selections.any { selection ->
                            selection.oddsScaled.toBigDecimalOrNull()
                                ?.let { value -> value > minimumDecimalScaled } == true
                        }
                    })
                }.thenByDescending { match ->
                    match.markets.count { market ->
                        market.selections.any { selection ->
                            selection.oddsScaled.toBigDecimalOrNull()
                                ?.let { value -> value > minimumDecimalScaled } == true
                        }
                    }
                }.thenByDescending { match ->
                    quotedSelections(match).map { it.oddsScaled }.distinct().size
                }.thenBy { it.starts }.thenBy { it.id }
            )
}
