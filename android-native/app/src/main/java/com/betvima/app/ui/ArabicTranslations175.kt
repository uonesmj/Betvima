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
        ArabicTranslations175G.terms

    fun translate(english: String): String = terms[english] ?: english

    // Used by native unit tests to assert parity with all existing Turkish
    // translation keys, without changing how English is rendered.
    internal fun hasTranslation(english: String): Boolean = english in terms
}
