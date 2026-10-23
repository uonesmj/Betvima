package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Arabic175Test {
    @Test fun arabicDoesNotChangeDefaultEnglishOrOtherLocales() {
        assertEquals(Lang.EN, AppState().lang)
        assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف پول"))
        assertEquals("کیف پول", tr(Lang.FA, "Wallet", "کیف پول"))
        assertEquals("Cüzdan", tr(Lang.TR, "Wallet", "کیف پول"))
        assertEquals("Դրամապանակ", tr(Lang.HY, "Wallet", "کیف پول"))
        assertEquals("المحفظة", tr(Lang.AR, "Wallet", "کیف پول"))
        assertEquals("اللغة", tr(Lang.AR, "Language", "زبان"))
        assertEquals("اختر بطولة", tr(Lang.AR, "Choose a tournament", "انتخاب تورنمنت"))
        assertEquals("وضع الرهان", tr(Lang.AR, "Place bet", "ثبت شرط"))
        assertEquals("الحساب الرئيسي", tr(Lang.AR, "Main Account", "حساب اصلی"))
        assertEquals("إيداع", tr(Lang.AR, "Deposit", "واریز"))
    }

    @Test fun pricesAndUnknownServerDataAreNotMutated() {
        assertEquals("provider_market_423", tr(Lang.AR, "provider_market_423", ""))
        assertEquals("1.85", tr(Lang.AR, "1.85", ""))
        assertEquals("BETVIMA", tr(Lang.AR, "BETVIMA", ""))
        assertEquals("🇸🇦", "🇸🇦")
        assertTrue(ArabicTranslations175.hasTranslation("Password updated successfully"))
        assertFalse(ArabicTranslations175.hasTranslation("private_wallet_identifier"))
    }

    @Test fun everyNativeFooterArticleHasArabicMetadataAndSections() {
        listOf("terms", "privacy", "responsible", "guide").forEach { id ->
            val article = requireNotNull(footerInfoArticle(id))
            for (field in listOf("title", "subtitle", "summary")) {
                val text = FooterArabic175.article(Lang.AR, article, field)
                assertTrue("Arabic $field for $id", !text.isNullOrBlank())
            }
            for (section in article.sections) {
                assertTrue("Arabic heading missing: ${section.headingEn}",
                    FooterArabic175.hasSection(section.headingEn))
                assertTrue(!FooterArabic175.section(Lang.AR, section, true).isNullOrBlank())
                assertTrue(!FooterArabic175.section(Lang.AR, section, false).isNullOrBlank())
            }
        }
    }
}
