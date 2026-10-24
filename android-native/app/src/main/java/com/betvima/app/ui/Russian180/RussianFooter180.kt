package com.betvima.app.ui

/** Translated informational articles retain their canonical official links. */
internal object RussianFooter180 {
    private val metadata: Map<String, Triple<String, String, String>> = mapOf(
        "terms" to Triple("Условия использования", "СЧЕТ • СТАВКИ • РАСЧЕТ", "Доступное руководство по критериям участия в учетной записи, принятым ставкам, точным записям, платежам и вашим обязательствам. Опубликованные условия веб-сайта остаются авторитетным общественным справочником."),
        "privacy" to Triple("Конфиденциальность и защита данных", "ДАННЫЕ • БЕЗОПАСНОСТЬ • ВАШ ВЫБОР", "Узнайте данные учетной записи, финансовые отчеты, проверки безопасности, поставщиков услуг и способы запроса помощи с личной информацией."),
        "responsible" to Triple("Ответственная игра", "КОНТРОЛЬ • БЛАГОПОЛУЧИЕ • ПОДДЕРЖКА", "Практические способы установить ограничения, распознать вредные привычки, поставить игру на паузу и обратиться за помощью. Азартные игры сопряжены с реальным риском финансовых потерь."),
        "guide" to Triple("BetVima — Полное руководство", "СПОРТ • КОШЕЛЕК • СЧЕТ", "Изучите опыт BetVima: настройка учетной записи, навигация по букмекерской конторе, прием коэффициентов, отслеживание ставок, криптоплатежи, U-Voucher, HotVoucher и поддержка, а также важные региональные рекомендации по участию.")
    )
    private val sections: Map<String, Pair<String, String>> = RussianFooter180Part1.sections +
        RussianFooter180Part2.sections +
        RussianFooter180Part3.sections
    fun article(lang: Lang, article: FooterInfoArticle, field: String): String? {
        if (lang != Lang.RU) return null
        val row = metadata[article.id] ?: return null
        return when (field) {
            "title" -> row.first
            "subtitle" -> row.second
            "summary" -> row.third
            else -> null
        }
    }
    fun section(lang: Lang, section: FooterInfoSection, heading: Boolean): String? {
        if (lang != Lang.RU) return null
        val row = sections[section.headingEn] ?: return null
        return if (heading) row.first else row.second
    }
    fun hasSection(heading: String): Boolean = heading in sections
}
