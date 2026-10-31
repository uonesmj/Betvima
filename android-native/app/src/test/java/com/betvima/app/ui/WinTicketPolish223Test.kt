package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WinTicketPolish223Test {
    @Test fun fourStaggeredBurstsFadeCleanly() {
        for (i in 0..3) {
            assertEquals(0f, winBurstPhase223(0f, i), .0001f)
            assertEquals(1f, winBurstPhase223(1f, i), .0001f)
            assertTrue(winBurstPhase223(.50f, i) in 0f..1f)
        }
        assertTrue(winBurstPhase223(.3f, 0) > winBurstPhase223(.3f, 3))
    }

    @Test fun professionalBurstHasBoundedIntroAndCalmAmbientCycle() {
        assertEquals(2200, WIN_TICKET_INTRO_MS_207)
        assertEquals(7800, WIN_TICKET_LOOP_MS_207)
    }
}
