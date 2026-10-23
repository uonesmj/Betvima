package com.betvima.app.ui

/**
 * Localize ONLY known native interface templates containing runtime numeric values.
 * Preserves real counts, HTTP codes, formatted byte sizes, and financial identifiers.
 * No arbitrary user/provider text or monetary amounts are rewritten.
 */
internal object NativeDynamic176 {
    private fun localized(lang: Lang, tr: String, hy: String, ar: String): String? = when(lang) {
        Lang.TR -> tr
        Lang.HY -> hy
        Lang.AR -> ar
        else -> null
    }

    fun translate(lang: Lang, source: String): String? {
        if (lang != Lang.TR && lang != Lang.HY && lang != Lang.AR) return null
        Regex("""^(\d+) days$""").matchEntire(source)?.let {
            val count = it.groupValues[1]
            return localized(lang, "$count gün", "$count օր", "$count يومًا")
        }
        Regex("""^Live · (\d+)$""").matchEntire(source)?.let {
            val count = it.groupValues[1]
            return localized(lang, "Canlı · $count", "Ուղիղ · $count", "مباشر · $count")
        }
        Regex("""^Space freed: (.+)$""").matchEntire(source)?.let {
            val size = it.groupValues[1]
            return localized(lang, "Boşaltılan alan: $size", "Ազատված տեղը՝ $size", "المساحة المحررة: $size")
        }
        Regex("""^Temporary files removed: (\d+)$""").matchEntire(source)?.let {
            val count = it.groupValues[1]
            return localized(lang, "Silinen geçici dosyalar: $count",
                "Հեռացված ժամանակավոր ֆայլեր՝ $count", "الملفات المؤقتة المحذوفة: $count")
        }
        Regex("""^File content or format was rejected \(HTTP (\d{3})\)\. Choose a JPG, PNG, WEBP or PDF\.$""")
            .matchEntire(source)?.let {
                val code = it.groupValues[1]
                return localized(lang,
                    "Dosya içeriği veya biçimi reddedildi (HTTP $code). JPG, PNG, WEBP veya PDF seçin.",
                    "Ֆայլի բովանդակությունը կամ ձևաչափը մերժվել է (HTTP $code)։ Ընտրեք JPG, PNG, WEBP կամ PDF։",
                    "رُفض محتوى الملف أو صيغته (HTTP $code). اختر JPG أو PNG أو WEBP أو PDF.")
            }
        Regex("""^Upload access denied \(HTTP (\d{3})\)\. Sign in again or contact support\.$""")
            .matchEntire(source)?.let {
                val code = it.groupValues[1]
                return localized(lang,
                    "Yükleme izni reddedildi (HTTP $code). Yeniden giriş yapın veya destekle iletişime geçin.",
                    "Ֆայլի վերբեռնման մուտքը մերժվել է (HTTP $code)։ Նորից մուտք գործեք կամ կապվեք աջակցության հետ։",
                    "تم رفض صلاحية رفع الملف (HTTP $code). سجّل الدخول مجددًا أو تواصل مع الدعم.")
            }
        return null
    }
}
