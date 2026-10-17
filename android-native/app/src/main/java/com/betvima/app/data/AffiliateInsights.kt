package com.betvima.app.data

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Reporting-only projection of the affiliate's authoritative daily ledger.
 * Do not conflate player profit/loss with affiliate commission or paid balance.
 */
data class PartnerDailyStat(
    val day: LocalDate,
    val registrations: Int,
    val activeUsers: Int,
    val turnoverMinor: BigInteger,
    val playerWinsMinor: BigInteger,
    val playerLossesMinor: BigInteger,
    val commissionMinor: BigInteger
) {
    /** Positive = player profit; negative = player loss. */
    val playerNetMinor: BigInteger get() = playerWinsMinor - playerLossesMinor

    /**
     * Affiliate-side gross margin as a percentage of settled turnover.
     * Null means no measurable turnover, NOT a zero-percent day.
     */
    val grossMarginPct: BigDecimal?
        get() = if (turnoverMinor > BigInteger.ZERO)
            BigDecimal(playerLossesMinor - playerWinsMinor)
                .multiply(BigDecimal("100"))
                .divide(BigDecimal(turnoverMinor), 2, RoundingMode.HALF_UP)
        else null
}

fun parsePartnerDailyStats(response: JSONObject, currency: String): List<PartnerDailyStat> {
    val rows = response.optJSONArray("dailyStats") ?: return emptyList()
    val raw = (0 until rows.length()).mapNotNull { index ->
        val obj = rows.optJSONObject(index) ?: return@mapNotNull null
        if (obj.optString("currency", currency) != currency) return@mapNotNull null
        runCatching {
            val rawDay = obj.optString("day")
            val date = runCatching { LocalDate.parse(rawDay.take(10)) }
                .getOrElse {
                    // PostgreSQL date values can be serialized with JS Date.toString().
                    // Treat them as calendar dates rather than dropping real rows.
                    val pieces = Regex("^[A-Za-z]{3} ([A-Za-z]{3} +[0-9]{1,2} +[0-9]{4})")
                        .find(rawDay)?.groupValues?.get(1)
                        ?: throw IllegalArgumentException("Unrecognized affiliate date")
                    LocalDate.parse(pieces.replace(Regex(" +"), " "),
                        DateTimeFormatter.ofPattern("MMM d yyyy", Locale.US))
                }
            fun minor(name: String) = BigInteger(obj.optString(name, "0"))
            PartnerDailyStat(
                date, obj.optInt("registrations", 0),
                obj.optInt("activeUsers", 0),
                minor("turnoverMinor"), minor("userWinsMinor"),
                minor("userLossesMinor"), minor("commissionMinor")
            )
        }.getOrNull()
    }
    // Snapshot rows are normally one per day, but never silently discard
    // multiple provider rows for the same affiliate day.
    return raw.groupBy { it.day }.toSortedMap().map { (day, values) ->
        PartnerDailyStat(
            day = day,
            registrations = values.sumOf { it.registrations },
            activeUsers = values.sumOf { it.activeUsers },
            turnoverMinor = values.fold(BigInteger.ZERO) { a, v -> a + v.turnoverMinor },
            playerWinsMinor = values.fold(BigInteger.ZERO) { a, v -> a + v.playerWinsMinor },
            playerLossesMinor = values.fold(BigInteger.ZERO) { a, v -> a + v.playerLossesMinor },
            commissionMinor = values.fold(BigInteger.ZERO) { a, v -> a + v.commissionMinor }
        )
    }
}

fun partnerRegistrations(rows: List<PartnerDailyStat>, start: LocalDate, end: LocalDate): Int =
    rows.filter { !it.day.isBefore(start) && !it.day.isAfter(end) }
        .sumOf { it.registrations }

fun partnerPlayerNet(rows: List<PartnerDailyStat>, start: LocalDate, end: LocalDate): BigInteger =
    rows.filter { !it.day.isBefore(start) && !it.day.isAfter(end) }
        .fold(BigInteger.ZERO) { amount, row -> amount + row.playerNetMinor }

fun partnerWeeklyTrend(rows: List<PartnerDailyStat>, today: LocalDate): List<PartnerDailyStat?> =
    (6L downTo 0L).map { offset ->
        val date = today.minusDays(offset)
        rows.firstOrNull { it.day == date }
    }

fun validatedPartnerTotal(stats: JSONObject?, key: String): BigInteger? =
    stats?.optString(key)?.takeIf { it.matches(Regex("-?[0-9]{1,30}")) }
        ?.let { runCatching { BigInteger(it) }.getOrNull() }
