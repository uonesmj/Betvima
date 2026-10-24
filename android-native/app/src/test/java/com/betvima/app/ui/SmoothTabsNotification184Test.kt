package com.betvima.app.ui

import com.betvima.app.data.NotificationLocalizedCopy184
import com.betvima.app.data.UserNotification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmoothTabsNotification184Test {
    private val example = UserNotification(
        id = "fixed-id",
        eventKey = "promo.generic",
        title = "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ هر واریز",
        body = "برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار: ۲۴ ساعت. استفاده: یک شرط ترکیبی با دقیقاً ۴ انتخاب و ضریب حداقل ۱٫۶۰. قوانین و محدودیت‌ها را بخوانید.",
        createdAt = "2026-10-24T10:00:00Z",
        readAt = null,
        audience = "general",
        ctaLabel = "مشاهده بونوس",
        ctaHref = "/bonuses"
    )

    @Test fun tabsKeepStableIdsAndSwipeBoundaries() {
        val options = listOf(
            SmoothTab184("all", "All"),
            SmoothTab184("open", "Open"),
            SmoothTab184("settled", "Finished")
        )
        assertEquals(0, smoothTabIndex184(options, "all"))
        assertEquals(1, smoothTabIndex184(options, "open"))
        assertEquals(2, smoothTabIndex184(options, "settled"))
        assertEquals(2, nextSmoothTab184(1, 2, -50f))
        assertEquals(0, nextSmoothTab184(1, 2, 50f))
        assertEquals(0, nextSmoothTab184(0, 2, 50f))
        assertEquals(2, nextSmoothTab184(2, 2, -50f))
        assertEquals("all", options[0].value)
        assertEquals("settled", options[2].value)
    }

    @Test fun recognizesOnlyTheExactWelcomeBonusMessageClass() {
        assertTrue(isWelcomeDepositBonus184(example))
        assertFalse(isWelcomeDepositBonus184(example.copy(ctaHref = "/wallet")))
        assertFalse(isWelcomeDepositBonus184(example.copy(
            title = "Admin: personal support update")))
        assertFalse(isWelcomeDepositBonus184(example.copy(
            body = "A special message, no promise about bonus eligibility.")))
    }

    @Test fun samePersistedNotificationSwitchesToEveryAvailableLanguage() {
        val titles = linkedSetOf<String>()
        for (language in Lang.entries) {
            val displayed = displayNotification184(example, language)
            assertTrue("Blank title in $language", displayed.title.isNotBlank())
            assertTrue("Blank body in $language", displayed.body.isNotBlank())
            assertTrue("Blank CTA in $language", !displayed.ctaLabel.isNullOrBlank())
            titles.add(displayed.title)
        }
        assertEquals(Lang.entries.size, titles.size)
        assertTrue(displayNotification184(example, Lang.EN).title.contains("Welcome"))
        assertTrue(displayNotification184(example, Lang.FA).title.contains("خوش"))
        assertTrue(displayNotification184(example, Lang.RU).title.contains("Добро"))
        assertTrue(displayNotification184(example, Lang.AR).title.contains("مرحب"))
        assertTrue(displayNotification184(example, Lang.HY).title.contains("Բարի"))
        assertEquals("Обновить", tr(Lang.RU, "Refresh", "تازه‌سازی"))
    }

    @Test fun serverSuppliedTranslationOverridesKnownWelcomeAndPreservesReadState() {
        val original = example.copy(
            readAt = "2026-10-24T10:12:00Z",
            translations = mapOf(
                "en" to NotificationLocalizedCopy184(
                    title = "Server title",
                    body = "Server body",
                    ctaLabel = "Server CTA")
            )
        )
        val displayed = displayNotification184(original, Lang.EN)
        assertEquals("Server title", displayed.title)
        assertEquals("Server body", displayed.body)
        assertEquals("Server CTA", displayed.ctaLabel)
        assertEquals("fixed-id", original.id)
        assertEquals("2026-10-24T10:12:00Z", original.readAt)
        assertEquals("promo.generic", original.eventKey)
    }

    @Test fun customPersonalMessagesStayUnchangedWithoutAuthorizedTranslation() {
        val personal = example.copy(
            eventKey = "support.reply",
            title = "Reply from administrator",
            body = "Your transfer reference is TX-98765. Please do not share the code.",
            ctaHref = "/support",
            ctaLabel = "Reply in support"
        )
        for (language in Lang.entries) {
            val copy = displayNotification184(personal, language)
            assertEquals(personal.title, copy.title)
            assertEquals(personal.body, copy.body)
            assertEquals(personal.ctaLabel, copy.ctaLabel)
        }
    }
}
