package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SlipPagingTest {
    @Test fun boundedPagesAdaptToScreenHeight() {
        assertEquals(1, slipPageCapacity(600))
        assertEquals(1, slipPageCapacity(749))
        assertEquals(2, slipPageCapacity(750))
        assertEquals(2, slipPageCapacity(1039))
        assertEquals(3, slipPageCapacity(1040))
    }

    @Test fun fixedViewportNeverCutsOffLastCardOrPager() {
        assertEquals(65, slipPickAreaHeightDp(0, 2))
        assertEquals(86, slipPickAreaHeightDp(1, 2))
        assertEquals(168, slipPickAreaHeightDp(2, 2))
        assertEquals(208, slipPickAreaHeightDp(3, 2))
        assertEquals(126, slipPickAreaHeightDp(2, 1))
        assertEquals(250, slipPickAreaHeightDp(3, 3))
        assertEquals(290, slipPickAreaHeightDp(20, 3))
        assertTrue(slipPickAreaHeightDp(20, 2) < 220)
    }

    @Test fun everyOneOfTwentyPicksIsAccessibleWithoutScrolling() {
        for (capacity in 1..3) {
            val indices = (0..slipMaxPage(20, capacity))
                .flatMap { slipPageWindow(20, capacity, it).toList() }
            assertEquals((0 until 20).toList(), indices)
        }
    }

    @Test fun pageBoundsClampAfterRemovals() {
        assertTrue(slipPageWindow(0, 2, 0).isEmpty())
        assertEquals(listOf(2), slipPageWindow(3, 2, 1).toList())
        assertEquals(listOf(0), slipPageWindow(1, 2, 99).toList())
        assertEquals(listOf(0, 1), slipPageWindow(2, 2, -9).toList())
    }
}
