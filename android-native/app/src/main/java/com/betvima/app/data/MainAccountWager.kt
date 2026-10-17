package com.betvima.app.data

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.time.Instant

data class MainOddsChange(
    val selectionId: String,
    val beforeScaled: String,
    val afterScaled: String
)

data class MainBetReview(
    val quoteToken: String,
    val expiresAt: String,
    val stakeMinor: String,
    val currency: String,
    val potentialPayoutMinor: String,
    val picks: List<Pick>,
    val changes: List<MainOddsChange>,
    val generation: Int
)

/** USD is in cents; IRR/IRT use integral wallet minor units. */
fun mainBetStakeMinor(text: String, currency: String): String {
    require(currency in setOf("USD", "IRR", "IRT"))
    val decimals = if (currency == "USD") 2 else 0
    val amount = BigDecimal(text.trim()).movePointRight(decimals)
        .setScale(0, RoundingMode.UNNECESSARY).toBigIntegerExact()
    require(amount.signum() > 0 && amount.toString().length <= 19)
    return amount.toString()
}

fun parseMainBetReview(
    quote: JSONObject,
    stakeMinor: String,
    currency: String,
    picks: List<Pick>,
    generation: Int,
    nowMillis: Long = System.currentTimeMillis(),
): MainBetReview {
    val token = quote.optString("quoteToken")
    val expiry = quote.optString("expiresAt")
    require(token.length >= 10)
    require(Instant.parse(expiry).toEpochMilli() > nowMillis + 1000L)
    require(quote.optString("stakeMinor") == stakeMinor)
    require(quote.optString("currency") == currency)
    val payout = quote.optString("potentialPayoutMinor")
    require(payout.matches(Regex("[0-9]{1,19}")))
    val changes = quote.optJSONArray("oddsChanges")
    val parsedChanges = (0 until (changes?.length() ?: 0)).map { i ->
        val change = requireNotNull(changes?.optJSONObject(i))
        MainOddsChange(
            selectionId = change.optString("selectionId"),
            beforeScaled = change.optString("previousOddsScaled"),
            afterScaled = change.optString("currentOddsScaled"),
        )
    }
    val ids = picks.map { it.selectionId }.toSet()
    require(parsedChanges.all { it.selectionId in ids &&
        it.beforeScaled.matches(Regex("[0-9]{1,12}")) &&
        it.afterScaled.matches(Regex("[0-9]{1,12}")) })
    require(parsedChanges.map { it.selectionId }.distinct().size == parsedChanges.size)
    // Do not label a bare odds multiplier as an official monetary return. A
    // signed quote is authoritative only when its stake, changed prices and
    // minor-unit payout agree with the same once-rounded backend formula.
    val currentPrices = parsedChanges.associate { it.selectionId to it.afterScaled }
    val prices = picks.map { (currentPrices[it.selectionId] ?: it.oddsScaled).toBigInteger() }
    require(prices.all { it in BigInteger("10100")..BigInteger("10000000") })
    val denominator = BigInteger("10000").pow(prices.size)
    val numerator = prices.fold(stakeMinor.toBigInteger()) { total, price ->
        total.multiply(price)
    }
    val calculatedPayout = numerator.add(denominator.divide(BigInteger.TWO)).divide(denominator)
    require(payout.toBigInteger() == calculatedPayout) {
        "Server quote payout does not match stake and authoritative odds"
    }
    return MainBetReview(token, expiry, stakeMinor, currency, payout,
        picks.toList(), parsedChanges, generation)
}

fun canConfirmMainBet(
    review: MainBetReview?,
    picks: List<Pick>,
    stakeMinor: String?,
    currency: String,
    generation: Int,
    nowMillis: Long = System.currentTimeMillis(),
    acceptedQuoteToken: String? = null,
): Boolean = review != null &&
    (review.changes.isEmpty() || review.quoteToken == acceptedQuoteToken) &&
    review.generation == generation &&
    review.picks == picks &&
    review.stakeMinor == stakeMinor &&
    review.currency == currency &&
    runCatching { Instant.parse(review.expiresAt).toEpochMilli() > nowMillis + 1000 }.getOrDefault(false)


/** One stable request id per signed quote. Retrying the same intent cannot debit twice. */
fun mainBetRequestId(quoteToken: String): String {
    require(quoteToken.length >= 10)
    return java.util.UUID.nameUUIDFromBytes(
        ("betvima-main:" + quoteToken).toByteArray(Charsets.UTF_8)
    ).toString()
}


/** Only the exact unexpired, unchanged signed quote can be accepted. */
fun canAcceptChangedMainOdds(
    review: MainBetReview?,
    picks: List<Pick>,
    stakeMinor: String?,
    currency: String,
    generation: Int,
    nowMillis: Long = System.currentTimeMillis(),
): Boolean = review != null && review.changes.isNotEmpty() &&
    canConfirmMainBet(review, picks, stakeMinor, currency, generation,
        nowMillis, acceptedQuoteToken = review.quoteToken)

fun mainOddsDirection(change: MainOddsChange): String {
    val before = change.beforeScaled.toBigInteger()
    val after = change.afterScaled.toBigInteger()
    return when { after > before -> "UP"; after < before -> "DOWN"; else -> "SAME" }
}
