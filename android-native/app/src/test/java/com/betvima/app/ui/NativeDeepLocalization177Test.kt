package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeDeepLocalization177Test {
    @Test fun englishHomeNavigationIsNotOverwrittenByHomeTeamTranslation() {
        assertEquals("Home", tr(Lang.EN, "Home", "خانه"))
        assertEquals("Ana sayfa", tr(Lang.TR, "Home", "خانه"))
        assertEquals("Գլխավոր", tr(Lang.HY, "Home", "خانه"))
        assertEquals("الرئيسية", tr(Lang.AR, "Home", "خانه"))
        assertEquals("Ev sahibi", trLive177(Lang.TR, "Home", "میزبان"))
        assertEquals("Տերեր", trLive177(Lang.HY, "Home", "میزبان"))
        assertEquals("المضيف", trLive177(Lang.AR, "Home", "میزبان"))
    }

    @Test fun liveStatsAndEventsHaveNativeTranslations() {
        assertEquals("GOL!", trLive177(Lang.TR, "GOAL!", "گل!"))
        assertEquals("ԳՈԼ!", trLive177(Lang.HY, "GOAL!", "گل!"))
        assertEquals("هدف!", trLive177(Lang.AR, "GOAL!", "گل!"))
        assertEquals("Korner", trLive177(Lang.TR, "Corner", "کرنر"))
        assertEquals("Անկյունային", trLive177(Lang.HY, "Corner", "کرنر"))
        assertEquals("ركنية", trLive177(Lang.AR, "Corner", "کرنر"))
        assertEquals("Իրադարձություններ", trLive177(Lang.HY, "Events", "رویدادها"))
        assertEquals("الإحصاءات", trLive177(Lang.AR, "Stats", "آمار"))
        assertEquals("Canlı maç akışı", trLive177(Lang.TR, "Live match flow", "جریان زنده مسابقه"))
        assertEquals("Live match flow", trLive177(Lang.EN, "Live match flow", "جریان زنده مسابقه"))
    }

    @Test fun marketTranslationPreservesSelectionIdentityAndNumbers() {
        assertEquals("Ev sahibi", NativeMarketLabels176.selection(Lang.TR, "Home", "میزبان"))
        assertEquals("صاحب الأرض", NativeMarketLabels176.selection(Lang.AR, "Home", "میزبان"))
        assertEquals("Üst 2.5", NativeMarketLabels176.selection(Lang.TR, "Over 2.5", "بیشتر از ۲.۵"))
        assertEquals("أكثر من 2.5", NativeMarketLabels176.selection(Lang.AR, "Over 2.5", "بیشتر از ۲.۵"))
        assertEquals("2.35", trLive177(Lang.AR, "2.35", "۲٫۳۵"))
    }

    @Test fun brandAndDefaultEnglishRemainUnaffected() {
        assertEquals(Lang.EN, AppState().lang)
        assertEquals("BetVima", trLive177(Lang.TR, "BetVima", "بت‌ویما"))
        assertEquals("امروز", trLive177(Lang.FA, "Today", "امروز"))
        assertTrue(trLive177(Lang.AR, "Waiting for verified live match statistics.", "آمار معتبر مسابقه هنوز دریافت نشده.").contains("إحصاءات"))
    }
}
