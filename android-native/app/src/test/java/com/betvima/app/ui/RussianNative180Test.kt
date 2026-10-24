package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RussianNative180Test {
    @Test fun englishIsStillDefaultAndOtherLanguagesUntouched() {
        assertEquals(Lang.EN, AppState().lang)
        assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف پول"))
        assertEquals("کیف پول", tr(Lang.FA, "Wallet", "کیف پول"))
        assertEquals("BetVima", tr(Lang.RU, "BetVima", "بت‌ویما"))
    }

    @Test fun russianCoreScreensHaveNativeCopy() {
        val cases = mapOf(
            "Language" to "Язык",
            "Home" to "Главная",
            "Wallet" to "Кошелёк",
            "My Bets" to "Мои ставки",
            "Sports" to "Спорт",
            "Casino" to "Казино",
            "Support" to "Поддержка",
            "Settings" to "Настройки",
            "Register" to "Зарегистрироваться",
            "Live Casino" to "Казино с живыми дилерами",
            "Bet slip" to "Купон ставок",
            "Place bet" to "Сделать ставку",
            "Refresh" to "Обновить",
            "Affiliate" to "Партнёрская программа",
            "FAQ" to "Частые вопросы"
        )
        for ((en, ru) in cases) assertEquals(en,ru,tr(Lang.RU,en,"فارسی"))
    }

    @Test fun russianIncludesAllSourceKeysAndBonusAffiliateExplanations() {
        assertTrue(RussianTranslations180.terms.size >= 1500)
        val items = listOf(
            "100% deposit match", "24-hour limit", "Exactly four picks",
            "Full bonus stake", "Win and loss policy",
            "Each eligible successful deposit produces a separate matching reward after provider confirmation.",
            "The bonus expires 24 hours after its actual issuance time. Unused amounts do not carry forward.",
            "One accumulator of exactly four selections. Every selection must have odds at least 1.60.",
            "The stake must equal the full bonus balance and use the Bonus Account only. Cash cannot be combined.",
            "A qualifying win credits only the original bonus to the Main Account, not the full accumulator payout. A loss does not credit cash.",
            "How can I join?", "Create an affiliate account and wait for approval. Then sign in to manage campaigns.",
            "Is the 70% rate guaranteed?", "When are payouts available?",
            "Where do I see my referrals?", "Partner username", "Registered affiliate email",
            "Payout account identifier"
        )
        for (text in items) {
            val value = tr(Lang.RU,text,"فارسی")
            assertNotEquals("Not translated: ${text}",text,value)
            assertTrue(value.isNotBlank())
        }
    }

    @Test fun footerHasRussianMetadataAndAll42Sections() {
        var sections = 0
        for (id in listOf("terms", "privacy", "responsible", "guide")) {
            val article = footerInfoArticle(id)!!
            for (field in listOf("title", "subtitle", "summary"))
                assertTrue("Missing footer ${id}.${field}",
                    !RussianFooter180.article(Lang.RU,article,field).isNullOrBlank())
            for (section in article.sections) {
                assertTrue("Missing heading: ${section.headingEn}",
                    !RussianFooter180.section(Lang.RU,section,true).isNullOrBlank())
                assertTrue("Missing body: ${section.headingEn}",
                    !RussianFooter180.section(Lang.RU,section,false).isNullOrBlank())
                sections++
            }
        }
        assertEquals(42,sections)
    }

    @Test fun russianMarketContextAndDynamicNumbers() {
        assertEquals("Главная",tr(Lang.RU,"Home","خانه"))
        assertEquals("Хозяева",RussianMarket180.selection("Home"))
        assertEquals("Гости",RussianMarket180.selection("Away"))
        assertEquals("Больше 2.5",RussianMarket180.selection("Over 2.5"))
        assertEquals("Меньше 2.5",RussianMarket180.selection("Under 2.5"))
        assertEquals("В эфире · 19",tr(Lang.RU,"Live · 19","زنده · ۱۹"))
        assertEquals("8 дн.",tr(Lang.RU,"8 days","۸ روز"))
        val serverCode="Upload access denied (HTTP 403). Sign in again or contact support."
        assertTrue(tr(Lang.RU,serverCode,serverCode).contains("403"))
        assertEquals("33.74 USD",tr(Lang.RU,"33.74 USD","۳۳٫۷۴ دلار"))
    }

    @Test fun russianCasinoFailureMessagesAreNotEnglish() {
        val messages=listOf(
            "This game has no available demo session right now. No real-money game was started. Try the confirmed Aviator demo.",
            "Please sign in again to start this demo.",
            "The provider rejected this title's demo. No wallet funds were charged. Try another game; this request never switches to real-money play.",
            "This title is no longer in the provider catalogue. Refresh the game list.",
            "Too many requests. Please retry in a moment.",
            "The game provider is temporarily unavailable. Retry later; no real-money wager was submitted.",
            "This verified demo failed to launch. It may be a temporary connection or provider error. Please retry and report the error code if it persists.",
            "This demo launch failed. This title might not support demo, or the provider may be temporarily unavailable. Real-money play is disabled. Try the verified Aviator demo to compare."
        )
        for (en in messages) {
            assertTrue("Missing Russian casino error: ${en}",!RussianQuality180.translate(en).isNullOrBlank())
            assertNotEquals(en,RussianQuality180.translate(en))
        }
    }
}
