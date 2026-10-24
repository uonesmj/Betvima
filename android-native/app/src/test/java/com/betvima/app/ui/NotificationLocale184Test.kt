package com.betvima.app.ui

import com.betvima.app.data.UserNotification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationLocale184Test {
    private fun welcome() = UserNotification(
        id = "stable-server-uuid",
        eventKey = "promo.welcome_bonus",
        title = "به بت‌ویما خوش آمدید! بونوس ۱۰۰٪ هر واریز",
        body = "برای هر واریز واجد شرایط، بونوس معادل دریافت کنید. اعتبار: ۲۴ ساعت. یک شرط ترکیبی با ۴ انتخاب و ضریب ۱٫۶۰ از حساب بونوس.",
        createdAt = "2026-10-24T12:00:00Z",
        readAt = null,
        audience = "general",
        ctaLabel = "مشاهده بونوس",
        ctaHref = "/bonuses"
    )

    @Test fun promotionalCopyTracksAllSelectedLanguagesWithoutChangingServerRecord() {
        val source = welcome()
        assertTrue(isWelcomeDepositBonus184(source))
        for (language in Lang.entries) {
            val display = notificationDisplayCopy184(source, language)
            assertTrue("Missing title for $language", display.title.isNotBlank())
            assertTrue("Missing body for $language", display.body.isNotBlank())
            assertTrue("Missing CTA for $language", !display.cta.isNullOrBlank())
            if (language !in listOf(Lang.FA, Lang.DARI)) {
                assertNotEquals(source.title, display.title)
                assertNotEquals(source.body, display.body)
            }
            assertEquals("stable-server-uuid", source.id)
            assertEquals("/bonuses", source.ctaHref)
            assertEquals(null, source.readAt)
            assertTrue(notificationMatchesCategory(source, NotificationCategory.GENERAL))
        }
        assertTrue(notificationDisplayCopy184(source, Lang.RU).title.contains("Добро"))
        assertTrue(notificationDisplayCopy184(source, Lang.EN).body.contains("24 hours"))
        assertTrue(notificationDisplayCopy184(source, Lang.TR).body.contains("1,60"))
    }

    @Test fun explicitServerTranslationsTakePriorityOverBuiltInTemplates() {
        val source = welcome().copy(
            localizedTitles = mapOf("ru" to "Персональный заголовок", "tr" to "Özel başlık"),
            localizedBodies = mapOf("ru" to "Сообщение именно для этого пользователя"),
            localizedCtaLabels = mapOf("ru" to "Открыть")
        )
        val ru = notificationDisplayCopy184(source, Lang.RU)
        assertEquals("Персональный заголовок", ru.title)
        assertEquals("Сообщение именно для этого пользователя", ru.body)
        assertEquals("Открыть", ru.cta)
        assertEquals("Özel başlık", notificationDisplayCopy184(source, Lang.TR).title)
    }

    @Test fun adminAndSupportContentIsNeverReplacedWithFabricatedPromotion() {
        val source = welcome().copy(
            eventKey = "support.reply",
            title = "پیام جدید پشتیبانی",
            body = "Please send the receipt for this particular case.",
            ctaHref = "/support"
        )
        assertFalse(isWelcomeDepositBonus184(source))
        val rendered = notificationDisplayCopy184(source, Lang.RU)
        assertEquals(source.body, rendered.body)
        assertEquals(source.title, rendered.title)
        assertEquals("/support", source.ctaHref)
    }

    @Test fun fallbackForUnknownNoticesDoesNotCorruptMoneyOrNames() {
        val source = welcome().copy(
            eventKey = "wallet.adjustment",
            title = "Private account event",
            body = "Amount 33.74 USD; transaction id 67e31c7b",
            ctaHref = "/wallet"
        )
        assertFalse(isWelcomeDepositBonus184(source))
        assertEquals(source.body, notificationDisplayCopy184(source, Lang.AR).body)
        assertEquals(source.body, notificationDisplayCopy184(source, Lang.HY).body)
    }

    @Test fun perLocaleTagsCoverAllExistingLanguages() {
        assertEquals("en", notificationLanguageTag184(Lang.EN))
        assertEquals("fa", notificationLanguageTag184(Lang.FA))
        assertEquals("tr", notificationLanguageTag184(Lang.TR))
        assertEquals("prs", notificationLanguageTag184(Lang.DARI))
        assertEquals("hy", notificationLanguageTag184(Lang.HY))
        assertEquals("ar", notificationLanguageTag184(Lang.AR))
        assertEquals("az", notificationLanguageTag184(Lang.AZ))
        assertEquals("ru", notificationLanguageTag184(Lang.RU))
    }
}
