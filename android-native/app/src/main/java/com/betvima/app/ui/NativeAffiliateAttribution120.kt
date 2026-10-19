package com.betvima.app.ui

import java.util.Locale

/**
 * A signed partner build may carry an approved referral code in BuildConfig.
 * This value is not a gift code and is never copied to registration inputs.
 * Every registration still requires server-side attribution validation.
 */
internal object NativeAffiliateAttribution120 {
    private val valid = Regex("^[A-Z0-9_-]{3,64}$")

    fun embeddedCode(buildValue: String): String {
        val normalized = buildValue.trim().uppercase(Locale.ROOT)
        return normalized.takeIf(valid::matches).orEmpty()
    }

    fun hasEmbeddedPartner(buildValue: String): Boolean =
        embeddedCode(buildValue).isNotEmpty()

    fun registrationCode(buildValue: String, typedGift: String): String =
        embeddedCode(buildValue).ifBlank { normalizeSignupReferral(typedGift) }
}
