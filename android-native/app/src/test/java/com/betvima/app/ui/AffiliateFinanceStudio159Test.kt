package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class AffiliateFinanceStudio159Test {
    private val today=LocalDate.parse("2026-10-22")

    @Test fun dateRangeAcceptsOneThrough365DaysExactly() {
        assertTrue(affiliateRange159(today,today,today))
        assertTrue(affiliateRange159(today.minusDays(364),today,today))
        assertFalse(affiliateRange159(today.minusDays(365),today,today))
        assertFalse(affiliateRange159(today.plusDays(1),today.plusDays(1),today))
        assertFalse(affiliateRange159(today,today.minusDays(1),today))
    }

    @Test fun presetRangesStayInclusiveAndNeverExceedOneYear() {
        for (days in listOf(1,7,30,90,180,365)) {
            val from=affiliatePresetStart159(days,today)
            assertEquals(days.toLong()-1,
                java.time.temporal.ChronoUnit.DAYS.between(from,today))
            assertTrue(affiliateRange159(from,today,today))
        }
    }

    @Test fun invalidPresetCannotCreateUnboundedReport() {
        try {
            affiliatePresetStart159(366,today)
            fail("366 days exceeds the selectable range")
        } catch (_: IllegalArgumentException) {}
        try {
            affiliatePresetStart159(0,today)
            fail("Zero day selection is not allowed")
        } catch (_: IllegalArgumentException) {}
    }
}
