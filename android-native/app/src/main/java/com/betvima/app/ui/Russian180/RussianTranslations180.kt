package com.betvima.app.ui

/** Static Russian translations; no runtime network calls. */
internal object RussianTranslations180 {
    val terms: Map<String, String> = Russian180Part1.terms +
        Russian180Part2.terms +
        Russian180Part3.terms +
        Russian180Part4.terms +
        Russian180Part5.terms +
        Russian180Part6.terms +
        Russian180Part7.terms +
        Russian180Part8.terms +
        Russian180Part9.terms +
        Russian180Part10.terms +
        Russian180Part11.terms +
        Russian180Part12.terms +
        Russian180Part13.terms +
        Russian180Part14.terms +
        Russian180Part15.terms
    fun translate(key: String): String = terms[key] ?: key
    fun hasTranslation(key: String): Boolean = key in terms
}
