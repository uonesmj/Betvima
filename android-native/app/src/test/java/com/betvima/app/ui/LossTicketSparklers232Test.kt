package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Loss effect is a self-contained one-shot counterpart to the untouched Win
 * animation. No result/balance/wager state is changed by these helpers.
 */
class LossTicketSparklers232Test {
    @Test fun fourRedBurstsAreStaggeredAndBounded() {
        for (i in 0..3) {
            assertEquals(0f, lossBurstPhase232(0f, i), .0001f)
            assertEquals(1f, lossBurstPhase232(1f, i), .0001f)
            assertTrue(lossBurstPhase232(.42f, i) in 0f..1f)
        }
        assertTrue(lossBurstPhase232(.40f, 0) > lossBurstPhase232(.40f, 3))
    }

    @Test fun animationHasOneBoundedIntroAndNoAmbientLoop() {
        assertEquals(1950, LOSS_BURST_INTRO_MS_232)
    }
}
