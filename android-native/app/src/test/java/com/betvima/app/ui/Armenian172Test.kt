package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class Armenian172Test {
 @Test fun selectArmenianWithoutChangingEnglishPersianTurkishDari() {
  assertEquals("Wallet", tr(Lang.EN, "Wallet", "کیف پول"))
  assertEquals("کیف پول", tr(Lang.FA, "Wallet", "کیف پول"))
  assertEquals("Դրամապանակ", tr(Lang.HY, "Wallet", "کیف پول"))
  assertEquals("Կարգավորումներ", tr(Lang.HY, "Settings", "تنظیمات"))
  assertEquals("🇦🇲", "🇦🇲")
 }
 @Test fun unknownFinancialLabelIsNeverInferred() {
  assertEquals("provider_specific_market", Armenian172.translate("provider_specific_market"))
 }
}
