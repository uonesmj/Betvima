package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordRecoveryTest {
    @Test fun emailChecksAreSharedByBothLoginFlows() {
        assertTrue(validRecoveryEmail("partner@example.com"))
        assertTrue(validRecoveryEmail(" member+tag@example.co.uk "))
        assertFalse(validRecoveryEmail(""))
        assertFalse(validRecoveryEmail("not-an-email"))
        assertFalse(validRecoveryEmail("a@b"))
        assertFalse(validRecoveryEmail("a b@example.com"))
        assertFalse(validRecoveryEmail("x".repeat(246) + "@example.com"))
    }

    @Test fun resetRedirectsStayOnOfficialBetvimaDomainAndPreservePortal() {
        assertEquals(
            "https://betvima.com/auth/reset-password",
            recoveryRedirect(RecoveryAccount.SPORTSBOOK)
        )
        assertEquals(
            "https://betvima.com/auth/reset-password?from=affiliate",
            recoveryRedirect(RecoveryAccount.AFFILIATE)
        )
    }
}
