package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Height regression tests for full three-line cards and five visible picks. */
class SlipPagingTest {
    @Test fun allThreeLinesHaveEnoughMinimumHeight() {
        // Match (14sp) + selection (18sp) + market (15sp), two gaps
        // and vertical padding. Never return to the clipped 62dp cards.
        assertTrue(SLIP_CARD_HEIGHT_DP >= 14 + 18 + 15 + 8 + 18)
        assertEquals(86, SLIP_CARD_HEIGHT_DP)
    }

    @Test fun firstFivePicksGrowViewportToCompleteCards() {
        assertEquals(5, SLIP_VISIBLE_PICK_LIMIT)
        assertEquals(65, slipPickAreaHeightDp(0))
        assertEquals(96, slipPickAreaHeightDp(1))
        assertEquals(188, slipPickAreaHeightDp(2))
        assertEquals(280, slipPickAreaHeightDp(3))
        assertEquals(372, slipPickAreaHeightDp(4))
        assertEquals(464, slipPickAreaHeightDp(5))
    }

    @Test fun sixOrTwentyPicksNeverGrowPastFiveVisibleCards() {
        assertEquals(slipPickAreaHeightDp(5), slipPickAreaHeightDp(6))
        assertEquals(slipPickAreaHeightDp(5), slipPickAreaHeightDp(20))
        assertFalse(slipRequiresScroll(5, 464))
        assertTrue(slipRequiresScroll(6, 464))
        assertTrue(slipRequiresScroll(20, 464))
    }

    @Test fun smallScreensAndImeStillAllowOverflowAccess() {
        assertTrue(slipRequiresScroll(5, 300))
        assertTrue(slipRequiresScroll(1, 55))
        assertFalse(slipRequiresScroll(1, 96))
        assertFalse(slipRequiresScroll(4, 372))
        assertTrue(slipRequiresScroll(4, 273))
    }
}
