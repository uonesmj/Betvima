package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenshotLocales178Test {
    private val bonusTitles = listOf(
        "100% deposit match", "24-hour limit", "Exactly four picks",
        "Full bonus stake", "Win and loss policy"
    )

    private val bonusDescriptions = listOf(
        "Each eligible successful deposit produces a separate matching reward after provider confirmation.",
        "The bonus expires 24 hours after its actual issuance time. Unused amounts do not carry forward.",
        "One accumulator of exactly four selections. Every selection must have odds at least 1.60.",
        "The stake must equal the full bonus balance and use the Bonus Account only. Cash cannot be combined.",
        "A qualifying win credits only the original bonus to the Main Account, not the full accumulator payout. A loss does not credit cash."
    )

    private val faq = listOf(
        "How can I join?",
        "Create an affiliate account and wait for approval. Then sign in to manage campaigns.",
        "Is the 70% rate guaranteed?",
        "The public programme shows a default rate. Your approved account rate and campaign terms take precedence.",
        "When are payouts available?",
        "Settlement is generally weekly. Requests depend on a verified payable balance, minimum amount and approval.",
        "Where do I see my referrals?",
        "After signing in, use the Referrals page for the data your account is allowed to access."
    )

    private val affiliateFields = listOf(
        "Partner username", "Registered affiliate email", "Payout account identifier",
        "Your partner account", "Partner credentials are separate from your normal sportsbook login.",
        "Provide the payout account identifier required by BetVima registration. You can add crypto wallets after sign-in."
    )

    @Test fun screenshotStringsHaveCompleteLocalizedCopyForFourNonEnglishLocales() {
        val keys = bonusTitles + bonusDescriptions + faq + affiliateFields +
            listOf("Live Casino", "Live casino", "FAQ", "Refresh", "TOP Bets", "Top Bets")
        for (language in listOf(Lang.TR, Lang.HY, Lang.AR, Lang.DARI)) {
            for (key in keys) {
                val value = NativeScreenshot178.translate(language, key)
                assertTrue("Missing ${language.name} translation for '$key'", !value.isNullOrBlank())
                assertNotEquals("Untranslated ${language.name} string '$key'", key, value)
            }
        }
    }

    @Test fun matchedScreensNeverRenderTheEnglishSourceAsTheirLocalizedLabel() {
        val keys = bonusTitles + bonusDescriptions + faq + affiliateFields +
            listOf("Live Casino", "Refresh")
        for (language in listOf(Lang.TR, Lang.HY, Lang.AR, Lang.DARI)) {
            for (key in keys) {
                assertNotEquals(key, tr(language, key, "ترجمهٔ فارسی"))
            }
        }
    }

    @Test fun preservesNumbersCurrencyAndBrandNames() {
        for (language in listOf(Lang.TR, Lang.HY, Lang.AR, Lang.DARI)) {
            assertTrue(tr(language, "100% deposit match", "پاداش واریز").contains("100%"))
            assertTrue(tr(language, "24-hour limit", "۲۴ ساعت").contains("24"))
            assertTrue(tr(language, "Is the 70% rate guaranteed?", "۷۰ درصد").contains("70%"))
            assertEquals("33.74 USD", tr(language, "33.74 USD", "۳۳٫۷۴ دلار"))
            assertEquals("BetVima", tr(language, "BetVima", "بت ویما"))
        }
    }

    @Test fun englishAndPersianKeepTheirExistingBehavior() {
        assertEquals("Live Casino", tr(Lang.EN, "Live Casino", "کازینو زنده"))
        assertEquals("کازینو زنده", tr(Lang.FA, "Live Casino", "کازینو زنده"))
        assertEquals("Refresh", tr(Lang.EN, "Refresh", "تازه‌سازی"))
        assertEquals("تازه‌سازی", tr(Lang.FA, "Refresh", "تازه‌سازی"))
        assertEquals(Lang.EN, AppState().lang)
    }

    @Test fun actualTransliterationsDifferByLanguage() {
        assertEquals("Canlı kumarhane", tr(Lang.TR, "Live Casino", "کازینو زنده"))
        assertEquals("Կենդանի կազինո", tr(Lang.HY, "Live Casino", "کازینو زنده"))
        assertEquals("كازينو مباشر", tr(Lang.AR, "Live Casino", "کازینو زنده"))
        assertEquals("Թարմացնել", tr(Lang.HY, "Refresh", "تازه‌سازی"))
        assertEquals("اسم مستخدم الشريك", tr(Lang.AR, "Partner username", "نام کاربری همکار"))
        assertEquals("70%", "Is the 70% rate guaranteed?".substring(7, 10))
    }
}
