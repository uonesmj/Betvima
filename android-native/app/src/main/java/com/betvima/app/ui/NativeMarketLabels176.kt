package com.betvima.app.ui

/**
 * Market-specific labels. This is deliberately separate from navigation
 * (e.g. "Home" in a market means the home team, not the home screen).
 * Event/team names and numeric lines remain provider supplied.
 */
internal object NativeMarketLabels176 {
    private val marketTerms = mapOf(
        "Home" to Triple("Ev sahibi", "Տանտեր", "صاحب الأرض"),
        "Away" to Triple("Deplasman", "Հյուրեր", "الفريق الضيف"),
        "Draw" to Triple("Beraberlik", "Ոչ-ոքի", "تعادل"),
        "Home win" to Triple("Ev sahibi kazanır", "Տանտերերի հաղթանակ", "فوز صاحب الأرض"),
        "Away win" to Triple("Deplasman kazanır", "Հյուրերի հաղթանակ", "فوز الضيف"),
        "Over" to Triple("Üst", "Ավելի", "أكثر من"),
        "Under" to Triple("Alt", "Պակաս", "أقل من"),
        "Yes" to Triple("Evet", "Այո", "نعم"),
        "No" to Triple("Hayır", "Ոչ", "لا"),
        "Win" to Triple("Galibiyet", "Հաղթանակ", "فوز"),
        "Lose" to Triple("Mağlubiyet", "Պարտություն", "خسارة"),
        "Both teams to score" to Triple("İki takım da gol atar", "Երկու թիմերն էլ գոլ կխփեն", "يسجل كلا الفريقين"),
        "Double chance" to Triple("Çifte şans", "Կրկնակի հնարավորություն", "فرصة مزدوجة"),
        "Handicap" to Triple("Handikap", "Հանդիկապ", "إعاقة")
    )

    private fun localized(lang: Lang, row: Triple<String, String, String>?): String? = when(lang) {
        Lang.TR -> row?.first
        Lang.HY -> row?.second
        Lang.AR -> row?.third
        else -> null
    }

    fun selection(lang: Lang, english: String, persian: String): String {
        if (lang == Lang.AZ) return AzerbaijaniMarket179.selection(english)
        if (lang == Lang.EN || lang == Lang.FA || lang == Lang.DARI)
            return tr(lang, english, persian)
        localized(lang, marketTerms[english])?.let { return it }
        val line = Regex("""^(Over|Under) (\d+(?:\.\d+)?)$""").matchEntire(english)
        if (line != null) {
            val amount = line.groupValues[2]
            return if (line.groupValues[1] == "Over") {
                localized(lang, Triple("Üst $amount", "$amount-ից ավելի", "أكثر من $amount")) ?: english
            } else {
                localized(lang, Triple("Alt $amount", "$amount-ից պակաս", "أقل من $amount")) ?: english
            }
        }
        return tr(lang, english, persian)
    }
}
