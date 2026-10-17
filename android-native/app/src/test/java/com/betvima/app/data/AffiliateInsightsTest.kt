package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.math.BigDecimal
import java.math.BigInteger
import java.time.LocalDate

class AffiliateInsightsTest {
    private fun row(
        day: String, registrations: Int, turnover: String,
        wins: String, losses: String, active: Int = 0, currency: String = "USD"
    ) = JSONObject()
        .put("day", day).put("currency", currency)
        .put("registrations", registrations).put("activeUsers", active)
        .put("turnoverMinor", turnover)
        .put("userWinsMinor", wins).put("userLossesMinor", losses)
        .put("commissionMinor", "0")

    @Test fun percentAndPAndLUseOnlyRealSettledRows() {
        val response = JSONObject().put("dailyStats", JSONArray()
            .put(row("2026-10-15", 2, "10000", "3000", "5000", 2))
            .put(row("2026-10-16", 1, "10000", "8000", "3000", 1))
            .put(row("2026-10-17", 0, "0", "0", "0"))
        )
        val items = parsePartnerDailyStats(response, "USD")
        assertEquals(BigDecimal("20.00"), items[0].grossMarginPct)
        assertEquals(BigDecimal("-50.00"), items[1].grossMarginPct)
        assertNull(items[2].grossMarginPct)
        assertEquals(BigInteger("-2000"), items[0].playerNetMinor)
        assertEquals(BigInteger("5000"), items[1].playerNetMinor)
        assertEquals(3, partnerRegistrations(items,
            LocalDate.parse("2026-10-15"), LocalDate.parse("2026-10-16")))
        assertEquals(BigInteger("3000"), partnerPlayerNet(items,
            LocalDate.parse("2026-10-15"), LocalDate.parse("2026-10-16")))
        assertEquals(7, partnerWeeklyTrend(items, LocalDate.parse("2026-10-17")).size)
        assertNull(partnerWeeklyTrend(items, LocalDate.parse("2026-10-17"))[0])
        assertEquals(LocalDate.parse("2026-10-17"),
            partnerWeeklyTrend(items, LocalDate.parse("2026-10-17")).last()?.day)
    }

    @Test fun ignoreForeignCurrencyAndRejectMalformedMoneyInsteadOfInventingStats() {
        val response = JSONObject().put("dailyStats", JSONArray()
            .put(row("2026-10-15", 10, "10000", "10", "100", currency="IRR"))
            .put(row("2026-10-15", 3, "10000", "10", "100"))
            .put(row("not-a-day", 8, "1000", "0", "0"))
            .put(row("2026-10-16", 8, "INVALID", "0", "0")))
        val rows = parsePartnerDailyStats(response, "USD")
        assertEquals(1, rows.size)
        assertEquals(3, rows.first().registrations)
        assertEquals("0.90", rows.first().grossMarginPct?.toPlainString())
        assertNull(validatedPartnerTotal(JSONObject(), "playerNetResultMinor"))
        assertEquals(BigInteger.ZERO, validatedPartnerTotal(
            JSONObject().put("playerNetResultMinor", "0"), "playerNetResultMinor"))
    }

    @Test fun duplicateDailyRowsAreAggregatedWithoutDataLoss() {
        val response = JSONObject().put("dailyStats", JSONArray()
            .put(row("2026-10-17T00:00:00.000Z", 1, "10000", "6000", "2000"))
            .put(row("2026-10-17T00:00:00.000Z", 2, "10000", "2000", "9000")))
        val rows = parsePartnerDailyStats(response, "USD")
        assertEquals(1, rows.size)
        assertEquals(3, rows.first().registrations)
        assertEquals(BigInteger("20000"), rows.first().turnoverMinor)
        assertEquals(BigDecimal("15.00"), rows.first().grossMarginPct)
    }
}
