package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class FooterInformationContentTest {
    @Test fun allFourInformationPagesExistWithLongBilingualSections() {
        listOf("terms", "privacy", "responsible", "guide").forEach { key ->
            assertTrue("Missing complete guide: " + key, footerInfoValid(key))
            val article = requireNotNull(footerInfoArticle(key))
            assertTrue(article.summaryFa.isNotBlank())
            assertTrue(article.summaryEn.isNotBlank())
            assertTrue(article.sections.size >= 7)
            assertTrue(article.sections.all { it.bodyEn.length >= 100 && it.bodyFa.length >= 100 })
        }
    }

    @Test fun guideCoversBettingFundingMethodsAndFourRegions() {
        val guide = requireNotNull(footerInfoArticle("guide"))
        val text = guide.sections.joinToString(" ") { it.headingEn + " " + it.bodyEn }
        listOf("single bet", "multiple", "USDT", "TRC-20", "U-Voucher",
            "HotVoucher", "Iran", "Turkey", "Afghanistan", "Tajikistan",
            "withdrawal", "18").forEach { topic ->
            assertTrue("Missing editorial subject: " + topic,
                text.contains(topic, ignoreCase = true))
        }
    }

    @Test fun guidesHaveGroundedOriginalWebsiteDestinations() {
        assertEquals("https://betvima.com/legal/terms",
            footerInfoArticle("terms")?.sourceUrl)
        assertEquals("https://betvima.com/legal/privacy",
            footerInfoArticle("privacy")?.sourceUrl)
        assertEquals("https://betvima.com/legal/responsible-gaming",
            footerInfoArticle("responsible")?.sourceUrl)
        assertEquals("https://betvima.com", footerInfoArticle("guide")?.sourceUrl)
        assertNull(footerInfoArticle("unknown"))
    }
}
