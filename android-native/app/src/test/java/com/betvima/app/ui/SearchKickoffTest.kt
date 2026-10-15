package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZoneId

class SearchKickoffTest {
    @Test fun showsLocalStartTimeWithFullDate() {
        assertEquals("20:15 • 25/10/2026",
            searchKickoff("2026-10-25T16:15:00Z", ZoneId.of("Asia/Dubai")))
    }

    @Test fun safelyDisplaysProviderLocalTimeWhenOffsetMissing() {
        assertEquals("18:45 • 25/10/2026", searchKickoff("2026-10-25T18:45"))
    }

    @Test fun missingStartRemainsUnknown() {
        assertEquals("—", searchKickoff(""))
    }
}
