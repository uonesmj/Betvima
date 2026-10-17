package com.betvima.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class NotificationExpiry108Test {
    private val now = Instant.parse("2026-10-17T12:00:00Z").toEpochMilli()

    @Test fun newerNotificationsRemainAvailableInBell() {
        assertTrue(notificationStillVisible("2026-10-16T12:00:00.001Z", now))
        assertTrue(notificationStillVisible("2026-10-17T11:59:59Z", now))
    }

    @Test fun exact24HoursAndOlderNoticesAreExpired() {
        assertFalse(notificationStillVisible("2026-10-16T12:00:00Z", now))
        assertFalse(notificationStillVisible("2026-10-16T11:59:59Z", now))
        assertFalse(notificationStillVisible("2026-10-01T00:00:00Z", now))
    }

    @Test fun malformedTimestampsNeverLeakStaleNotices() {
        assertFalse(notificationStillVisible("", now))
        assertFalse(notificationStillVisible("not-a-date", now))
    }
}
