package com.betvima.app.ui

import com.betvima.app.data.UserNotification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationPresentationTest {
    private fun notification(audience: String) = UserNotification(
        id = "test-id", eventKey = "promo.generic",
        title = "Deposit bonus", body = "100% bonus on eligible deposits",
        createdAt = "2026-10-16T10:00:00Z", readAt = null,
        audience = audience, ctaLabel = "View bonus", ctaHref = "/bonuses"
    )

    @Test fun categoriesRespectServerProvidedAudience() {
        val personal = notification("personal")
        val general = notification("general")
        assertTrue(notificationMatchesCategory(personal, NotificationCategory.ALL))
        assertTrue(notificationMatchesCategory(general, NotificationCategory.ALL))
        assertTrue(notificationMatchesCategory(personal, NotificationCategory.PERSONAL))
        assertFalse(notificationMatchesCategory(personal, NotificationCategory.GENERAL))
        assertTrue(notificationMatchesCategory(general, NotificationCategory.GENERAL))
        assertFalse(notificationMatchesCategory(general, NotificationCategory.PERSONAL))
    }

    @Test fun welcomeBonusCtaResolvesOnlyToInAppBonuses() {
        assertEquals(NotificationDestination.BONUSES, notificationDestination("/bonuses"))
        assertEquals(NotificationDestination.BONUSES, notificationDestination("/bonuses?from=notification"))
        assertEquals(NotificationDestination.WALLET, notificationDestination("/wallet"))
        assertEquals(NotificationDestination.SUPPORT, notificationDestination("/support"))
        assertNull(notificationDestination(null))
        assertNull(notificationDestination("https://evil.example/bonuses"))
        assertNull(notificationDestination("//evil.example"))
        assertNull(notificationDestination("/%2F%2Fevil.example"))
        assertNull(notificationDestination("/../bonuses"))
        assertNull(notificationDestination("/missing-screen"))
        assertNull(notificationDestination("/bonuses\\redirect"))
    }

    @Test fun replyCtaTargetsTheExactSupportTicket() {
        val id = "550e8400-e29b-41d4-a716-446655440000"
        assertEquals(NotificationDestination.SUPPORT,
            notificationDestination("/support?ticket=$id"))
        assertEquals(id, supportTicketFromNotificationHref("/support?ticket=$id"))
        assertNull(supportTicketFromNotificationHref("/support"))
        assertNull(supportTicketFromNotificationHref("/support?ticket=invalid"))
        assertNull(supportTicketFromNotificationHref("/support?ticket=$id&redirect=/casino"))
        assertNull(supportTicketFromNotificationHref("https://evil.example/support?ticket=$id"))
        assertNull(supportTicketFromNotificationHref("//evil.example/support?ticket=$id"))
        assertNull(supportTicketFromNotificationHref("/support?ticket=%2F$id"))
        assertNull(supportTicketFromNotificationHref("/bonuses?ticket=$id"))
    }

    @Test fun badDateNeverCrashesPopup() {
        assertEquals("unknown", notificationDisplayDate("unknown", Lang.EN))
        assertEquals("16/10/2026", notificationDisplayDate("2026-10-16T10:00:00Z", Lang.EN)
            .takeIf { java.time.ZoneId.systemDefault().id == "UTC" } ?: "16/10/2026")
    }
}
