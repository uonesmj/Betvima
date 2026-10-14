package com.betvima.app.data

import org.json.JSONObject
import java.time.Instant

data class BonusOddsMovement(
    val selectionId: String,
    val previousScaled: String,
    val currentScaled: String,
    val version: Int
)
data class BonusPlacementQuote(
    val quoteToken: String,
    val expiresAt: String,
    val currency: String,
    val stakeMinor: String,
    val combinedOddsScaled: String,
    val movements: List<BonusOddsMovement>
)

fun parseBonusPlacementQuote(quote: JSONObject, currency: String): BonusPlacementQuote {
    val token = quote.str("quoteToken")
    require(token.length >= 10) { "Quote token missing" }
    val expiry = quote.str("expiresAt")
    require(runCatching { Instant.parse(expiry) }.isSuccess) { "Quote expiry missing" }
    return BonusPlacementQuote(
        quoteToken = token,
        expiresAt = expiry,
        currency = currency,
        stakeMinor = quote.str("stakeMinor"),
        combinedOddsScaled = quote.str("combinedOddsScaled", "0"),
        movements = quote.arr("oddsChanges").objects().map {
            BonusOddsMovement(
                selectionId = it.str("selectionId"),
                previousScaled = it.str("previousOddsScaled"),
                currentScaled = it.str("currentOddsScaled"),
                version = it.optInt("currentOddsVersion", -1)
            )
        }
    )
}

/** Informational client-side check. Only the production SQL function authorizes a wager. */
fun validateBonusSlip(
    picks: List<Pick>, grant: BonusReward?, currency: String, nowMillis: Long
): String? {
    if (grant == null) return "select_bonus"
    if (grant.status != "active") return "bonus_not_active"
    if (grant.currency != currency) return "currency_mismatch"
    if (grant.remainingMinor.toLongOrNull() == null ||
        grant.remainingMinor.toLong() <= 0) return "bonus_empty"
    if (bonusMillisecondsLeft(grant.expiresAt, nowMillis) <= 0) return "bonus_expired"
    if (picks.size != 4 || picks.map { it.matchId }.distinct().size != 4 ||
        picks.map { it.selectionId }.distinct().size != 4) return "exact_four"
    if (picks.any { (it.oddsScaled.toLongOrNull() ?: 0L) < 16_000L }) return "min_odds"
    return null
}
fun validateBonusQuote(
    quote: BonusPlacementQuote, picks: List<Pick>, grant: BonusReward, nowMillis: Long
): String? {
    val basic = validateBonusSlip(picks, grant, quote.currency, nowMillis)
    if (basic != null) return basic
    if (quote.stakeMinor != grant.remainingMinor) return "stake_changed"
    if (bonusMillisecondsLeft(quote.expiresAt, nowMillis) <= 0) return "quote_expired"
    if (quote.movements.any { m ->
        picks.none { it.selectionId == m.selectionId } ||
            (m.currentScaled.toLongOrNull() ?: 0L) < 16_000L ||
            m.version < 0
    }) return "min_odds_or_invalid_change"
    return null
}
fun bonusSlipIdentity(picks: List<Pick>, grant: BonusReward): String =
    (listOf(grant.id,grant.currency,grant.remainingMinor) + picks.map {
        it.matchId + "|" + it.marketId + "|" + it.selectionId +
            "|" + it.oddsScaled + "|" + (it.version ?: -1)
    }).joinToString(";")
