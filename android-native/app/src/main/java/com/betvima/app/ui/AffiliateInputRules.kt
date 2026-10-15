package com.betvima.app.ui

/** Native affiliate credentials and campaign validation, matching published API schemas. */
internal object AffiliateInputRules {
    fun validEmail(email: String): Boolean =
        email.trim().length in 3..254 &&
            email.trim().matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))

    fun validUsername(value: String): Boolean =
        value.trim().matches(Regex("^[a-z0-9_]{3,32}$"))

    fun validPassword(value: String): Boolean = value.length in 8..128

    fun validRegistration(email: String, username: String, password: String,
        payoutAccountId: String): Boolean =
        validEmail(email) && validUsername(username.trim().lowercase()) &&
            validPassword(password) && payoutAccountId.trim().length in 4..120

    fun validGiftCode(value: String): Boolean =
        value.matches(Regex("^[A-Z0-9]{4,8}$"))

    fun validCampaign(value: String): Boolean = value.trim().length in 2..60
}
