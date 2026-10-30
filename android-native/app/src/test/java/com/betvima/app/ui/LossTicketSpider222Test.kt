package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LossTicketSpider222Test {
    @Test fun startsAtLowerLeftAndEndsInsideActualStatusChip() {
        val start = Offset(24f, 730f)
        val badge = Offset(314f, 35f)
        assertEquals(start, lossSpiderPoint222(start, badge, 350f, 770f, 0f))
        assertEquals(badge, lossSpiderPoint222(start, badge, 350f, 770f, 1f))
        assertEquals(start, lossSpiderPoint222(start, badge, 350f, 770f, -2f))
        assertEquals(badge, lossSpiderPoint222(start, badge, 350f, 770f, 2f))
        val midpoint = lossSpiderPoint222(start, badge, 350f, 770f, .5f)
        assertTrue(midpoint.x > start.x && midpoint.x < badge.x)
        assertTrue(midpoint.y < start.y && midpoint.y > badge.y)
    }

    @Test fun completesExactlyOnceRatherThanLooping() {
        assertEquals(460L, LOSS_SPIDER_DELAY_MS_222)
        assertEquals(1900, LOSS_SPIDER_DURATION_MS_222)
        assertEquals(2360L, LOSS_SPIDER_TOTAL_MS_222)
    }
}
