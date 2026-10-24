package com.betvima.app.ui

/** Translated informational articles retain their canonical official links. */
internal object AzerbaijaniFooter179 {
    private val metadata: Map<String, Triple<String, String, String>> = mapOf(
        "terms" to Triple("Qaydalar və Şərtlər", "HESAB • ORANLAR • HESABILMA", "Hesab uyğunluğu, qəbul edilmiş mərclər, dəqiq qeydlər, ödənişlər və öhdəlikləriniz üçün əlçatan bələdçi. Dərc edilmiş vebsayt şərtləri nüfuzlu ictimai istinad olaraq qalır."),
        "privacy" to Triple("Məxfilik və Məlumatların Mühafizəsi", "DATA • TƏHLÜKƏSİZLİK • SİZİN SEÇİMLƏRİNİZ", "Hesab məlumatlarını, maliyyə qeydlərini, təhlükəsizlik yoxlamalarını, xidmət təminatçılarını və şəxsi məlumatlarla bağlı necə kömək istəməyi anlayın."),
        "responsible" to Triple("Məsuliyyətli Oyun", "NƏZARƏT • RAHATLIQ • DƏSTƏK", "Məhdudiyyətlər təyin etmək, zərərli nümunələri tanımaq, oyunu dayandırmaq və kömək tapmaq üçün praktik yollar. Qumar real maliyyə itkisi riski daşıyır."),
        "guide" to Triple("BetVima — Tam Bələdçi", "İDMAN • PÜQMAZ • HESAB", "BetVima təcrübəsini kəşf edin: hesab quraşdırma, idman kitablarının naviqasiyası, əmsalların qəbulu, mərc izləmə, kripto ödənişləri, U-Voucher, HotVoucher və mühüm regional uyğunluq təlimatı ilə dəstək.")
    )
    private val sections: Map<String, Pair<String, String>> = AzerbaijaniFooter179Part1.sections +
        AzerbaijaniFooter179Part2.sections +
        AzerbaijaniFooter179Part3.sections
    fun article(lang: Lang, article: FooterInfoArticle, field: String): String? {
        if (lang != Lang.AZ) return null
        val row = metadata[article.id] ?: return null
        return when (field) {
            "title" -> row.first
            "subtitle" -> row.second
            "summary" -> row.third
            else -> null
        }
    }
    fun section(lang: Lang, section: FooterInfoSection, heading: Boolean): String? {
        if (lang != Lang.AZ) return null
        val row = sections[section.headingEn] ?: return null
        return if (heading) row.first else row.second
    }
    fun hasSection(heading: String): Boolean = heading in sections
}
