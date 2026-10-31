package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LossTicketSpider222Test {
    @Test fun everyVariantStartsAtDifferentSideOrHeight() {
        val starts = (0 until LOSS_SPIDER_ROUTE_COUNT_224).map {
            lossSpiderStart224(it, 350f, 770f)
        }
        assertEquals(6, starts.distinct().size)
        assertTrue(starts[0].x < 350f / 2f)
        assertTrue(starts[1].x > 350f / 2f)
        assertEquals(starts[0], lossSpiderStart224(6, 350f, 770f))
        for (n in 0 until 6) {
            assertFalse("Consecutive opening must vary entry",
                starts[n] == starts[(n + 1) % 6])
        }
    }

    @Test fun crawlsUpSideAndAcrossHeaderNotDiagonally() {
        val badge = Offset(288f, 35f)
        for (route in 0 until 6) {
            val start = lossSpiderStart224(route, 350f, 770f)
            val end = lossSpiderBadgeEntry224(badge, route, 1f)
            assertEquals(start, lossSpiderPoint222(start, end, 350f, 770f, 0f))
            assertEquals(end, lossSpiderPoint222(start, end, 350f, 770f, 1f))
            val climb = lossSpiderPoint222(start, end, 350f, 770f, .25f)
            assertEquals("Spider remains on ticket edge at start",
                start.x, climb.x, .01f)
            assertTrue(climb.y < start.y)
            val last = lossSpiderPoint222(start, end, 350f, 770f, .98f)
            assertEquals("Final approach follows header surface",
                end.y, last.y, .35f)
        }
    }

    @Test fun measuredLostBadgeHasVariedButContainedLandingPoints() {
        val badge = Offset(290f, 38f)
        val entries = (0 until 6).map { lossSpiderBadgeEntry224(badge, it, 1f) }
        assertEquals(6, entries.distinct().size)
        for (point in entries) {
            assertTrue(kotlin.math.abs(point.x - badge.x) <= 5f)
            assertTrue(kotlin.math.abs(point.y - badge.y) <= 3f)
        }
    }

    @Test fun playsExactlyOncePerExpansion() {
        assertEquals(6, LOSS_SPIDER_ROUTE_COUNT_224)
        assertEquals(420L, LOSS_SPIDER_DELAY_MS_222)
        assertEquals(3400, LOSS_SPIDER_DURATION_MS_222)
        assertEquals(3820L, LOSS_SPIDER_TOTAL_MS_222)
    }
}
