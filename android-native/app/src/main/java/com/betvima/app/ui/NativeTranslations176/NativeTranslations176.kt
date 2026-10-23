package com.betvima.app.ui

/** Verified additive translations; existing language defaults remain unchanged. */
internal object TurkishTranslations176 {
    val terms: Map<String, String> = NativeTr176Part1.terms
        + NativeTr176Part2.terms
        + NativeTr176Part3.terms
        + NativeTr176Part4.terms
        + NativeTr176Part5.terms
    fun translate(key: String): String = terms[key] ?: key
}

internal object ArmenianTranslations176 {
    val terms: Map<String, String> = NativeHy176Part1.terms
        + NativeHy176Part2.terms
        + NativeHy176Part3.terms
        + NativeHy176Part4.terms
        + NativeHy176Part5.terms
        + NativeHy176Part6.terms
        + NativeHy176Part7.terms
    fun translate(key: String): String = terms[key] ?: key
}

internal object ArabicTranslations176 {
    val terms: Map<String, String> = NativeAr176Part1.terms
    fun translate(key: String): String = terms[key] ?: key
}
