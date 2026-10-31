package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LossTicketSpider222Test {
    @Test fun followsCardRimBeforeEnteringRealLostBadge() {
        val start = Offset(40f, 730f)
        val badge = Offset(314f, 35f)
        val w = 350f
        val h = 770f
        assertEquals(start, lossSpiderPoint222(start, badge, w, h, 0f))
        assertEquals(badge, lossSpiderPoint222(start, badge, w, h, 1f))
        assertEquals(start, lossSpiderPoint222(start, badge, w, h, -1f))
        assertEquals(badge, lossSpiderPoint222(start, badge, w, h, 3f))

        val climb = lossSpiderPoint222(start, badge, w, h, .40f)
        assertEquals("Spider stays on the left card rim while climbing",
            start.x, climb.x, .01f)
        assertTrue(climb.y < start.y)
        assertTrue(climb.y > badge.y)

        val header = lossSpiderPoint222(start, badge, w, h, .88f)
        assertTrue("Spider is on the header, not airborne on a diagonal",
            kotlin.math.abs(header.y - badge.y) < .05f)
        assertTrue(header.x > start.x && header.x < badge.x)
    }

    @Test fun theAnimationIsOneTraversalAndNeverAnInfiniteLoop() {
        assertEquals(520L, LOSS_SPIDER_DELAY_MS_222)
        assertEquals(3600, LOSS_SPIDER_DURATION_MS_222)
        assertEquals(4120L, LOSS_SPIDER_TOTAL_MS_222)
    }
}
