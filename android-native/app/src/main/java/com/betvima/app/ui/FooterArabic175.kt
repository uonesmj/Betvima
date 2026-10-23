package com.betvima.app.ui

/** Native Arabic footer content. Keep the original policy links unchanged. */
internal object FooterArabic175 {
    private val metadata: Map<String, Triple<String, String, String>> = mapOf(
        "terms" to Triple(
            "الشروط والأحكام", "الحساب • الاحتمالات • التسوية",
            "دليل للأهلية وقبول الرهانات والسجلات الدقيقة والمدفوعات والالتزامات. تظل الشروط الرسمية المنشورة على الموقع المرجع المعتمد."
        ),
        "privacy" to Triple(
            "الخصوصية وحماية البيانات", "البيانات • الأمان • خياراتك",
            "تعرف على بيانات الحساب والسجلات المالية والتحقق الأمني ومزودي الخدمة وكيفية طلب المساعدة بشأن معلوماتك الشخصية."
        ),
        "responsible" to Triple(
            "اللعب المسؤول", "التحكم • السلامة • الدعم",
            "طرق عملية لتحديد الحدود والتعرف إلى السلوك الضار والتوقف وطلب المساعدة. تنطوي المراهنة على احتمال خسارة مالية حقيقية."
        ),
        "guide" to Triple(
            "BetVima — الدليل الشامل", "الرياضة • المحفظة • الحساب",
            "دليل التسجيل والبحث عن المباريات وقبول الاحتمالات ومتابعة الرهانات والدفع بالعملات المشفرة والقسائم والدعم، مع التنبيه إلى الأهلية حسب الموقع."
        )
    )

    private val sections = FooterArabic175Legal.sections +
        FooterArabic175Responsible.sections +
        FooterArabic175Guide.sections

    fun article(lang: Lang, article: FooterInfoArticle, field: String): String? {
        if (lang != Lang.AR) return null
        val row = metadata[article.id] ?: return null
        return when (field) {
            "title" -> row.first
            "subtitle" -> row.second
            "summary" -> row.third
            else -> null
        }
    }

    fun section(lang: Lang, section: FooterInfoSection, heading: Boolean): String? {
        if (lang != Lang.AR) return null
        val row = sections[section.headingEn] ?: return null
        return if (heading) row.first else row.second
    }

    internal fun hasSection(heading: String): Boolean = heading in sections
}
