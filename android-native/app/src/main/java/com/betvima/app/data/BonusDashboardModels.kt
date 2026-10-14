package com.betvima.app.data

import org.json.JSONObject
import java.time.Instant

data class BonusPromotion(
    val code: String, val active: Boolean, val percentageBps: Int,
    val minDepositMinor: String?, val maxBonusMinor: String?
)

data class BonusReward(
    val id: String, val title: String, val description: String,
    val status: String, val currency: String,
    val amountMinor: String, val remainingMinor: String,
    val grantedAt: String, val expiresAt: String,
    val usedAt: String, val betId: String?, val depositId: String
) {
    val isActive: Boolean get() = status in listOf("active", "locked")
}

data class BonusCurrencySummary(
    val total: Int, val active: Int, val locked: Int, val won: Int,
    val lost: Int, val expired: Int, val cancelled: Int,
    val activeAmountMinor: String, val lockedAmountMinor: String
)

data class BonusCurrencyPage(
    val currency: String, val promotion: BonusPromotion?,
    val summary: BonusCurrencySummary,
    val items: List<BonusReward>, val page: Int,
    val total: Int, val hasMore: Boolean
)

fun parseBonusCurrencyPage(data: JSONObject, currency: String, page: Int): BonusCurrencyPage {
    val p = data.optJSONObject("promotion")
    val campaign = p?.let {
        BonusPromotion(
            code = it.str("code"), active = it.optBoolean("isActive", false),
            percentageBps = it.optInt("percentageBps", 0),
            minDepositMinor = it.str("minDepositMinor").takeIf(String::isNotBlank),
            maxBonusMinor = it.str("maxBonusMinor").takeIf(String::isNotBlank)
        )
    }
    val s = data.optJSONObject("summary") ?: JSONObject()
    return BonusCurrencyPage(
        currency = currency, promotion = campaign,
        summary = BonusCurrencySummary(
            total = s.optInt("total", 0), active = s.optInt("active", 0),
            locked = s.optInt("locked", 0), won = s.optInt("won", 0),
            lost = s.optInt("lost", 0), expired = s.optInt("expired", 0),
            cancelled = s.optInt("cancelled", 0),
            activeAmountMinor = s.str("activeAmountMinor", "0"),
            lockedAmountMinor = s.str("lockedAmountMinor", "0")
        ),
        items = data.arr("items").objects().map {
            BonusReward(
                id = it.str("id"),
                title = it.str("title", "Deposit bonus"),
                description = it.str("description"), status = it.str("status"),
                currency = it.str("currency", currency),
                amountMinor = it.str("amountMinor", "0"),
                remainingMinor = it.str("remainingAmountMinor", "0"),
                grantedAt = it.str("grantedAt"), expiresAt = it.str("expiresAt"),
                usedAt = it.str("usedAt"), betId = it.str("betId").takeIf(String::isNotBlank),
                depositId = it.str("depositPaymentTransactionId")
            )
        }, page = data.optInt("page", page), total = data.optInt("total", 0),
        hasMore = data.optBoolean("hasMore", false)
    )
}

/** Never infer bonus expiration from client creation time; use server-issued expiresAt. */
fun bonusMillisecondsLeft(expiresAt: String, nowMillis: Long): Long =
    runCatching { (Instant.parse(expiresAt).toEpochMilli() - nowMillis).coerceAtLeast(0) }
        .getOrDefault(0L)

fun bonusClockLabel(ms: Long): String {
    val seconds = ms.coerceAtLeast(0L) / 1000L
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return "%02d:%02d:%02d".format(java.util.Locale.US, h, m, s)
}

/** UI-only educational check; the authenticated SQL RPC is always authoritative. */
fun bonusLegsLookEligible(oddsScaled: List<Long>, stakeMinor: String, grant: BonusReward): Boolean =
    grant.status == "active" &&
        oddsScaled.size == 4 &&
        oddsScaled.all { it >= 16_000L } &&
        stakeMinor == grant.remainingMinor &&
        bonusMillisecondsLeft(grant.expiresAt, System.currentTimeMillis()) > 0
