package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class AffiliateInputRulesTest {
    @Test fun emailAndCredentialsMirrorAffiliateApiSchema() {
        assertTrue(AffiliateInputRules.validEmail("partner@example.com"))
        assertFalse(AffiliateInputRules.validEmail("username_only"))
        assertFalse(AffiliateInputRules.validEmail("x@"))
        assertTrue(AffiliateInputRules.validUsername("partner_101"))
        assertFalse(AffiliateInputRules.validUsername("a b"))
        assertTrue(AffiliateInputRules.validPassword("secure_password_123"))
        assertFalse(AffiliateInputRules.validPassword("short"))
    }

    @Test fun partnerRegistrationRequiresAllServerFields() {
        assertTrue(AffiliateInputRules.validRegistration(
            "team@example.com","team_123","password123","WALLET-123"))
        assertFalse(AffiliateInputRules.validRegistration(
            "team@example.com","team_123","password123",""))
        assertFalse(AffiliateInputRules.validRegistration(
            "team@example.com","??","password123","WALLET-123"))
    }

    @Test fun giftAndCampaignLimitsAreEnforcedBeforeServerCall() {
        assertTrue(AffiliateInputRules.validGiftCode("VIP2026"))
        assertFalse(AffiliateInputRules.validGiftCode("TOO_LONG_2026"))
        assertTrue(AffiliateInputRules.validCampaign("Instagram October"))
        assertFalse(AffiliateInputRules.validCampaign("X"))
    }
}
