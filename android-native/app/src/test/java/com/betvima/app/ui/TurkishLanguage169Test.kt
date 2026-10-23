package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class TurkishLanguage169Test {
    @Test fun nativeLanguageStringsSwitchBySelectedLocale() {
        assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف‌پول"))
        assertEquals("کیف‌پول", tr(Lang.FA, "Wallet", "کیف‌پول"))
        assertEquals("Cüzdan", tr(Lang.TR, "Wallet", "کیف‌پول"))
        assertEquals("Dil", tr(Lang.TR, "Language", "زبان"))
        assertEquals("Turnuva seç", tr(Lang.TR, "Choose a tournament", "انتخاب تورنمنت"))
    }
    @Test fun unknownTurkishServerTermsAreNeverFabricated() {
        assertEquals("unknown_dynamic_market", TurkishTranslations169.translate("unknown_dynamic_market"))
    }
}
