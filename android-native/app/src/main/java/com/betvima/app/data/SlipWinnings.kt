package com.betvima.app.data

import java.math.BigDecimal
import java.math.RoundingMode

/** Display-only quote preview. The backend's official quote remains authoritative. */
data class SlipWinnings(
    val stakeUsd: String,
    val combinedOdds: String,
    val returnUsd: String,
    val profitUsd: String
)

/**
 * Exact decimal multiplication of scaled decimal odds (10000 == 1.0000).
 * Rounds only ONCE at the end to USD cents, matching sportsbook payout maths.
 * Profit excludes the returned stake; return includes it.
 */
fun previewSlipWinnings(
    stakeInput: String, picks: List<Pick>, currency: String = "USD"
): SlipWinnings? = runCatching {
    require(picks.size in 1..20)
    require(currency in setOf("USD", "IRR", "IRT"))
    val digits = if (currency == "USD") 2 else 0
    require(stakeInput.matches(if (digits == 0) Regex("[0-9]{1,14}")
        else Regex("[0-9]{1,10}(\\.[0-9]{1,2})?")))
    val stake = BigDecimal(stakeInput).setScale(digits, RoundingMode.UNNECESSARY)
    require(stake > BigDecimal.ZERO)
    val combined = picks.fold(BigDecimal.ONE) { total, pick ->
        val scaled = pick.oddsScaled.toLongOrNull()
        require(scaled != null && scaled > 10_000L && scaled <= 999_999_999_999L)
        total.multiply(BigDecimal.valueOf(scaled).movePointLeft(4))
    }
    val payout = stake.multiply(combined).setScale(digits, RoundingMode.HALF_UP)
    val profit = payout.subtract(stake).setScale(digits, RoundingMode.HALF_UP)
    SlipWinnings(
        stakeUsd = stake.toPlainString(),
        combinedOdds = combined.setScale(2, RoundingMode.HALF_UP).toPlainString(),
        returnUsd = payout.toPlainString(),
        profitUsd = profit.toPlainString()
    )
}.getOrNull()
