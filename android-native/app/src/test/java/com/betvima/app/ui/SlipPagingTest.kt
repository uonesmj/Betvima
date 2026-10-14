package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SlipPagingTest {
    @Test fun boundedPagesAdaptToScreenHeight() {
        assertEquals(1, slipPageCapacity(600))
        assertEquals(2, slipPageCapacity(760))
        assertEquals(3, slipPageCapacity(940))
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
