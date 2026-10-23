package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeLocalization176Test {
    @Test fun englishStaysDefaultAndExistingPersianUnchanged() {
        assertEquals(Lang.EN, AppState().lang)
        assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف پول"))
        assertEquals("کیف پول", tr(Lang.FA, "Wallet", "کیف پول"))
        assertEquals("BetVima", tr(Lang.AR, "BetVima", "بت‌ویما"))
        assertEquals("2.75", tr(Lang.TR, "2.75", "۲٫۷۵"))
    }

    @Test fun arabicTurkishArmenianHaveActualNativeStrings() {
        assertEquals("المحفظة", tr(Lang.AR, "Wallet", "کیف پول"))
        assertEquals("Cüzdan", tr(Lang.TR, "Wallet", "کیف پول"))
        assertEquals("Դրամապանակ", tr(Lang.HY, "Wallet", "کیف پول"))
        assertEquals("Oranları kabul et ve bahis yap",
            tr(Lang.TR, "Accept odds & place", "پذیرش ضریب و شرط"))
        assertEquals("Ընդունել գործակիցները և կատարել խաղադրույք",
            tr(Lang.HY, "Accept odds & place", "پذیرش ضریب و شرط"))
        assertEquals("اقبل الاحتمالات وضع الرهان",
            tr(Lang.AR, "Accept odds & place", "پذیرش ضریب و شرط"))
        assertEquals("Kuponu temizle", tr(Lang.TR, "Clear slip", "پاک کردن فرم"))
        assertEquals("Մաքրել կտրոնը", tr(Lang.HY, "Clear slip", "پاک کردن فرم"))
        assertEquals("مسح القسيمة", tr(Lang.AR, "Clear slip", "پاک کردن فرم"))
    }

    @Test fun activeLanguageResolvesNonDictionarySportsAndFinancialTypes() {
        assertEquals("Hentbol", NativeLocalizedNouns176.sport(Lang.TR, "handball", "Handball"))
        assertEquals("Հանդբոլ", NativeLocalizedNouns176.sport(Lang.HY, "handball", "Handball"))
        assertEquals("كرة اليد", NativeLocalizedNouns176.sport(Lang.AR, "handball", "Handball"))
        assertEquals("Bahis iadesi", NativeLocalizedNouns176.transaction(Lang.TR, "bet_refund"))
        assertEquals("Խաղադրույքի գումարի վերադարձ",
            NativeLocalizedNouns176.transaction(Lang.HY, "bet_refund"))
        assertEquals("استرداد مبلغ الرهان",
            NativeLocalizedNouns176.transaction(Lang.AR, "bet_refund"))
    }

    @Test fun numbersAndServerErrorCodesRemainUnmodified() {
        assertEquals("Canlı · 14", tr(Lang.TR, "Live · 14", "زنده · ۱۴"))
        assertEquals("Ուղիղ · 14", tr(Lang.HY, "Live · 14", "زنده · ۱۴"))
        assertEquals("مباشر · 14", tr(Lang.AR, "Live · 14", "زنده · ۱۴"))
        assertEquals("9 gün", tr(Lang.TR, "9 days", "۹ روز"))
        assertEquals("9 օր", tr(Lang.HY, "9 days", "۹ روز"))
        assertEquals("9 يومًا", tr(Lang.AR, "9 days", "۹ روز"))
        val msg = "Upload access denied (HTTP 403). Sign in again or contact support."
        val translated = tr(Lang.AR, msg, msg)
        assertTrue(translated.contains("403"))
        assertNotEquals(msg, translated)
        assertEquals("8.25", tr(Lang.AR, "8.25", "۸٫۲۵"))
    }
}
