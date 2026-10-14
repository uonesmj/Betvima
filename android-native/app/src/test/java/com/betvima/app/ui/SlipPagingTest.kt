package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Regression coverage for growing the slip to five cards, then scrolling. */
class SlipPagingTest {
    @Test fun firstFivePicksGrowViewportExactly() {
        assertEquals(5, SLIP_VISIBLE_PICK_LIMIT)
        assertEquals(65, slipPickAreaHeightDp(0))
        assertEquals(72, slipPickAreaHeightDp(1))
        assertEquals(139, slipPickAreaHeightDp(2))
        assertEquals(206, slipPickAreaHeightDp(3))
        assertEquals(273, slipPickAreaHeightDp(4))
        assertEquals(340, slipPickAreaHeightDp(5))
    }

    @Test fun sixOrTwentyPicksNeverGrowPastFiveVisibleCards() {
        assertEquals(slipPickAreaHeightDp(5), slipPickAreaHeightDp(6))
        assertEquals(slipPickAreaHeightDp(5), slipPickAreaHeightDp(20))
        assertFalse(slipRequiresScroll(5, 340))
        assertTrue(slipRequiresScroll(6, 340))
        assertTrue(slipRequiresScroll(20, 340))
    }

    @Test fun smallDevicesCanStillReachAllPicksWithoutClipping() {
        assertTrue(slipRequiresScroll(5, 290))
        assertTrue(slipRequiresScroll(1, 55))
        assertFalse(slipRequiresScroll(1, 72))
        assertFalse(slipRequiresScroll(4, 273))
    }
}
