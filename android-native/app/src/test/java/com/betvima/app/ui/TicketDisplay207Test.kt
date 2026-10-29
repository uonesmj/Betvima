package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class TicketDisplay207Test {
    @Test fun providerMetadataAndUnknownFeedStatusesStayHidden() {
        assertFalse(publicBetLegStatus207("provider"))
        assertFalse(publicBetLegStatus207("PROVIDER"))
        assertFalse(publicBetLegStatus207("feed_unknown_status"))
        assertFalse(publicBetLegStatus207(""))
    }

    @Test fun officialOutcomesRemainVisible() {
        listOf("WON", "LOST", "VOID", "PENDING", "SETTLED", "HALF_WON")
            .forEach { assertTrue(it, publicBetLegStatus207(it)) }
    }

    @Test fun winAnimationIncludesContinuousMotionAndLongOpening() {
        assertTrue(WIN_TICKET_LOOP_MS_207 > 4000)
        assertTrue(WIN_TICKET_INTRO_MS_207 > 1000)
    }
}
