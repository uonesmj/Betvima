package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class LossTicketSpider222Test {
    @Test fun allEntrancesStartInsideMiddleOfCardAndVaryOnEachOpen() {
        val starts = (0 until LOSS_SPIDER_ROUTE_COUNT_224).map {
            lossSpiderStart224(it, 350f, 770f)
        }
        assertEquals(6, starts.distinct().size)
        for (start in starts) {
            assertTrue("Starts in the central region, not at a card edge",
                start.x in 105f..225f)
            assertTrue("Starts in the middle/lower body of ticket",
                start.y in 385f..630f)
        }
        assertEquals(starts[0], lossSpiderStart224(6, 350f, 770f))
    }

    @Test fun eachRouteTakesCurvedNonLinearPathIntoTheActualLostChip() {
        val badge = Offset(288f, 35f)
        for (route in 0 until 6) {
            val start = lossSpiderStart224(route, 350f, 770f)
            val end = lossSpiderBadgeEntry224(badge, route, 1f)
            assertEquals(start, lossSpiderPoint222(start, end, 350f, 770f, 0f))
            assertEquals(end, lossSpiderPoint222(start, end, 350f, 770f, 1f))
            val mid = lossSpiderPoint222(start, end, 350f, 770f, .5f)
            val linearX = (start.x + end.x) / 2f
            assertTrue("The route must bend, not fly in a straight line",
                abs(mid.x - linearX) > 4f)
            assertTrue("The spider advances toward Lost as the route progresses",
                mid.y < start.y && mid.y > end.y)
            assertNotEquals("Arrival point changes by route",
                start, end)
        }
    }

    @Test fun photoArrivalPointsStayInsideMeasuredLostChip() {
        val target = Offset(294f, 36f)
        val points = (0 until 6).map { lossSpiderBadgeEntry224(target, it, 1f) }
        assertEquals(6, points.distinct().size)
        for (p in points) {
            assertTrue(abs(p.x - target.x) <= 3.01f)
            assertTrue(abs(p.y - target.y) <= 2.01f)
        }
    }

    @Test fun safeRouteCounterAndSinglePlayTime() {
        assertEquals(6, LOSS_SPIDER_ROUTE_COUNT_224)
        assertEquals(340L, LOSS_SPIDER_DELAY_MS_222)
        assertEquals(3200, LOSS_SPIDER_DURATION_MS_222)
        assertEquals(3540L, LOSS_SPIDER_TOTAL_MS_222)
        assertTrue(lossSpiderEntryIndex225(1, Int.MIN_VALUE) in 0..5)
        assertTrue(lossSpiderEntryIndex225(1, Int.MAX_VALUE) in 0..5)
        assertNotEquals(lossSpiderEntryIndex225(1, 417),
            lossSpiderEntryIndex225(2, 417))
    }
}
