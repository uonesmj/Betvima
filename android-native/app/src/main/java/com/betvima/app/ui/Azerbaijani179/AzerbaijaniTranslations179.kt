package com.betvima.app.ui

/** Static Azerbaijani translations; no runtime network calls. */
internal object AzerbaijaniTranslations179 {
    val terms: Map<String, String> = Azerbaijani179Part1.terms +
        Azerbaijani179Part2.terms +
        Azerbaijani179Part3.terms +
        Azerbaijani179Part4.terms +
        Azerbaijani179Part5.terms +
        Azerbaijani179Part6.terms +
        Azerbaijani179Part7.terms +
        Azerbaijani179Part8.terms +
        Azerbaijani179Part9.terms +
        Azerbaijani179Part10.terms +
        Azerbaijani179Part11.terms +
        Azerbaijani179Part12.terms +
        Azerbaijani179Part13.terms +
        Azerbaijani179Part14.terms
    fun translate(key: String): String = terms[key] ?: key
    fun hasTranslation(key: String): Boolean = key in terms
}
