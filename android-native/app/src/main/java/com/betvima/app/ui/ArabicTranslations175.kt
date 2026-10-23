package com.betvima.app.ui

/**
 * Standard Arabic (ar). Only source-controlled, user-facing labels are mapped.
 * Never mutate server event names, bet prices, wallet amounts, player identifiers
 * or pre-existing Compose layout directions/geometry.
 */
internal object ArabicTranslations175 {
    private val terms: Map<String, String> =
        ArabicTranslations175A.terms +
        ArabicTranslations175B.terms +
        ArabicTranslations175C.terms +
        ArabicTranslations175D.terms +
        ArabicTranslations175E.terms +
        ArabicTranslations175F.terms +
        ArabicTranslations175G.terms +
        ArabicTranslations175H.terms +
        ArabicTranslations175I.terms +
        ArabicTranslations175J.terms +
        ArabicTranslations175K.terms

    fun translate(english: String): String =
        terms[english] ?: dynamicText(english) ?: english

    // Interpolated status codes, live counts and period labels must preserve their
    // actual values. Do not attempt automatic translation of arbitrary server data.
    private fun dynamicText(english: String): String? {
        val httpCode = Regex("""HTTP (\d{3})""").find(english)?.groupValues?.get(1)
        if (httpCode != null) {
            return when {
                english.startsWith("File content or format was rejected (HTTP ") ->
                    "رُفض محتوى الملف أو صيغته (HTTP ${httpCode}). اختر JPG أو PNG أو WEBP أو PDF."
                english.startsWith("Upload access denied (HTTP ") ->
                    "تم رفض صلاحية الرفع (HTTP ${httpCode}). سجل الدخول مجددًا أو تواصل مع الدعم."
                else -> null
            }
        }
        val liveCount = Regex("""Live · (\d+)""").matchEntire(english)
        if (liveCount != null) return "مباشر · ${liveCount.groupValues[1]}"
        val days = Regex("""(\d+) days""").matchEntire(english)
        if (days != null) return "${days.groupValues[1]} يومًا"
        return null
    }

    // Used by native unit tests to assert parity with all existing Turkish
    // translation keys, without changing how English is rendered.
    internal fun hasTranslation(english: String): Boolean = english in terms
}
