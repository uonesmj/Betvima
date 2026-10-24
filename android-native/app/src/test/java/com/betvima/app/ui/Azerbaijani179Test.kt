package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Azerbaijani179Test {
    @Test fun englishRemainsDefaultAndUnmodified() {
        assertEquals(Lang.EN, AppState().lang)
        assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف پول"))
        assertEquals("کیف پول", tr(Lang.FA, "Wallet", "کیف پول"))
        assertEquals("BetVima", tr(Lang.AZ, "BetVima", "بت ویما"))
    }

    @Test fun azerbaijaniMajorModulesAreTranslated() {
        val expected = mapOf(
            "Language" to "Dil",
            "Home" to "Ana səhifə",
            "Wallet" to "Pul kisəsi",
            "My Bets" to "Mərclərim",
            "Sports" to "İdman",
            "Casino" to "Kazino",
            "Register" to "Qeydiyyatdan keç",
            "Support" to "Dəstək",
            "Settings" to "Parametrlər",
            "Affiliate" to "Tərəfdaşlıq",
            "Live Casino" to "Canlı kazino",
            "Place bet" to "Mərc et",
            "Bet slip" to "Mərc kuponu",
            "Refresh" to "Yenilə",
            "FAQ" to "Tez-tez verilən suallar"
        )
        for ((source, translation) in expected)
            assertEquals(source, translation, tr(Lang.AZ, source, "فارسـی"))
    }

    @Test fun allPreviousTurkishDictionaryLabelsHaveAzerbaijaniMappings() {
        // The extraction script includes every previous Turkish, Arabic, Armenian,
        // bonus and affiliate source key, including runtime-composed UI components.
        assertTrue(AzerbaijaniTranslations179.terms.size >= 1200)
        val keys = listOf(
            "100% deposit match", "24-hour limit", "Exactly four picks",
            "Full bonus stake", "Win and loss policy", "How can I join?",
            "Is the 70% rate guaranteed?", "When are payouts available?",
            "Where do I see my referrals?", "Partner username",
            "Registered affiliate email", "Payout account identifier"
        )
        for (key in keys)
            assertTrue("Not translated: $key",
                AzerbaijaniQuality179.translate(key) != null ||
                AzerbaijaniTranslations179.hasTranslation(key))
    }

    @Test fun footerMetadataAndAll42ContentSectionsTranslated() {
        val ids = listOf("terms", "privacy", "responsible", "guide")
        var total = 0
        for (id in ids) {
            val article = footerInfoArticle(id)!!
            assertTrue(!AzerbaijaniFooter179.article(Lang.AZ, article, "title").isNullOrBlank())
            assertTrue(!AzerbaijaniFooter179.article(Lang.AZ, article, "subtitle").isNullOrBlank())
            assertTrue(!AzerbaijaniFooter179.article(Lang.AZ, article, "summary").isNullOrBlank())
            for (section in article.sections) {
                assertTrue("Heading absent: ${section.headingEn}",
                    !AzerbaijaniFooter179.section(Lang.AZ, section, true).isNullOrBlank())
                assertTrue("Content absent: ${section.headingEn}",
                    !AzerbaijaniFooter179.section(Lang.AZ, section, false).isNullOrBlank())
                total++
            }
        }
        assertEquals(42, total)
    }

    @Test fun contextualMarketsAndDynamicValuesKeepCorrectMeaning() {
        assertEquals("Ana səhifə", tr(Lang.AZ, "Home", "خانه"))
        assertEquals("Ev sahibi", AzerbaijaniMarket179.selection("Home"))
        assertEquals("Qonaq", AzerbaijaniMarket179.selection("Away"))
        assertEquals("Üst 2.5", AzerbaijaniMarket179.selection("Over 2.5"))
        assertEquals("Alt 2.5", AzerbaijaniMarket179.selection("Under 2.5"))
        assertEquals("Canlı · 19", tr(Lang.AZ, "Live · 19", "زنده · ۱۹"))
        assertEquals("8 gün", tr(Lang.AZ, "8 days", "۸ روز"))
        assertTrue(tr(Lang.AZ,
            "Upload access denied (HTTP 403). Sign in again or contact support.",
            "خطا").contains("403"))
        assertEquals("33.74 USD", tr(Lang.AZ, "33.74 USD", "۳۳٫۷۴ دلار"))
    }
}
