package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class NativeRegistrationTest {
    @Test fun requiredFieldsAndSeparateConsents() {
        assertEquals("email", signupValidation("bad", "strongPassword1", "strongPassword1", true, true))
        assertEquals("password", signupValidation("foo@example.com", "short", "short", true, true))
        assertEquals("confirmation", signupValidation("foo@example.com", "strongPassword1", "wrongPassword", true, true))
        assertEquals("age", signupValidation("foo@example.com", "strongPassword1", "strongPassword1", false, true))
        assertEquals("terms", signupValidation("foo@example.com", "strongPassword1", "strongPassword1", true, false))
        assertNull(signupValidation("foo@example.com", "strongPassword1", "strongPassword1", true, true))
    }
    @Test fun payloadMatchesExistingServerSchema() {
        val data = signupPayload(" test@example.com ", "strongPassword1", "USD",
            "gift12", "fa", "real-turnstile-token")
        assertEquals("test@example.com", data.getString("email"))
        assertEquals("USD", data.getString("currency"))
        assertEquals("GIFT12", data.getString("referralCode"))
        assertEquals("fa", data.getString("locale"))
        assertTrue(data.getBoolean("ageConfirmed"))
        assertTrue(data.getBoolean("acceptTerms"))
        assertEquals("real-turnstile-token", data.getString("turnstileToken"))
    }
    @Test fun emptyReferralDoesNotCreateFakeAttribution() {
        val data = signupPayload("a@b.com", "strongPassword1", "IRR", "", "en", "x")
        assertFalse(data.has("referralCode"))
    }
    @Test fun publicCloudflareKeyMustBePresentAndWellFormed() {
        assertNull(publicTurnstileKey(org.json.JSONObject()
            .put("authenticationConfigured", true)))
        assertNull(publicTurnstileKey(org.json.JSONObject().put("turnstileSiteKey", "")))
        val key = "0x4AAAAAAAa-1234567890abcdef"
        assertEquals(key, publicTurnstileKey(org.json.JSONObject()
            .put("turnstileSiteKey", key)))
        assertEquals(key, publicTurnstileKey(org.json.JSONObject()
            .put("ok", true)
            .put("data", org.json.JSONObject().put("turnstileSiteKey", key))))
    }

}
