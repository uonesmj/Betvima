package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class NativeAffiliateAttribution120Test {
    @Test fun genericApkHasNoAutomaticReferrer() {
        assertFalse(NativeAffiliateAttribution120.hasEmbeddedPartner(""))
        assertEquals("",NativeAffiliateAttribution120.registrationCode("", ""))
    }

    @Test fun approvedPartnerApkAppliesReferralWithoutGiftInput() {
        assertTrue(NativeAffiliateAttribution120.hasEmbeddedPartner("nova7CODE"))
        assertEquals("NOVA7CODE",
            NativeAffiliateAttribution120.registrationCode("nova7CODE", ""))
    }

    @Test fun embeddedPartnerWinsOverOptionalGiftField() {
        assertEquals("NOVA7CODE",
            NativeAffiliateAttribution120.registrationCode("NOVA7CODE", "GIFT123"))
    }

    @Test fun genericApkKeepsExplicitGiftCode() {
        assertEquals("GIFT123",
            NativeAffiliateAttribution120.registrationCode("", "gift123"))
    }

    @Test fun malformedBuildRefIsRejected() {
        assertEquals("",NativeAffiliateAttribution120.embeddedCode("bad;command"))
        assertEquals("",NativeAffiliateAttribution120.embeddedCode("bad/referral"))
        assertEquals("",NativeAffiliateAttribution120.embeddedCode(" "))
    }
}
