package com.betvima.app.data

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Locale

/**
 * Display-only estimate. All amounts are in the selected wallet's unit:
 * cents for USD, whole rials for IRR, and whole tomans for legacy IRT.
 * This never changes bet placement, balances, or settlement.
 */
data class SlipWinnings(
    val stakeUsd: String,
    val combinedOdds: String,
    val returnUsd: String,
    val profitUsd: String
)

/** Use the currency's native precision; never round a rial preview to cents. */
fun previewSlipWinnings(
    stakeInput: String, picks: List<Pick>, currency: String = "USD"
): SlipWinnings? = runCatching {
    require(currency in setOf("USD", "IRR", "IRT"))
    require(picks.size in 1..20)
    val scale = if (currency == "USD") 2 else 0
    require(stakeInput.matches(if (scale == 2)
        Regex("[0-9]{1,10}(\\.[0-9]{1,2})?") else Regex("[0-9]{1,18}")))
    val stake = BigDecimal(stakeInput).setScale(scale, RoundingMode.UNNECESSARY)
    require(stake > BigDecimal.ZERO)
    val combined = picks.fold(BigDecimal.ONE) { total, pick ->
        val scaled = pick.oddsScaled.toLongOrNull()
        require(scaled != null && scaled > 10_000L && scaled <= 999_999_999_999L)
        total.multiply(BigDecimal.valueOf(scaled).movePointLeft(4))
    }
    val payout = stake.multiply(combined).setScale(scale, RoundingMode.HALF_UP)
    val profit = payout.subtract(stake)
    SlipWinnings(
        stakeUsd = stake.toPlainString(),
        combinedOdds = combined.setScale(2, RoundingMode.HALF_UP).toPlainString(),
        returnUsd = payout.toPlainString(),
        profitUsd = profit.toPlainString()
    )
}.getOrNull()

/** The slip deliberately shows fiat outcomes in IRR, even for legacy IRT wallets. */
fun formatSlipOutcome(amount: String, currency: String, persian: Boolean): String? =
    runCatching {
        val locale = if (persian) Locale.forLanguageTag("fa-IR") else Locale.US
        val value = BigDecimal(amount)
        when (currency) {
            "USD" -> {
                val formatted = NumberFormat.getNumberInstance(locale).apply {
                    minimumFractionDigits = 2
                    maximumFractionDigits = 2
                    isGroupingUsed = true
                }.format(value.setScale(2, RoundingMode.HALF_UP))
                "$" + formatted
            }
            "IRR", "IRT" -> {
                val rials = value.multiply(
                    if (currency == "IRT") BigDecimal.TEN else BigDecimal.ONE
                ).setScale(0, RoundingMode.HALF_UP).toBigIntegerExact()
                val formatted = NumberFormat.getIntegerInstance(locale).format(rials)
                formatted + (if (persian) " ریال" else " IRR")
            }
            else -> error("Unsupported bet slip currency")
        }
    }.getOrNull()
