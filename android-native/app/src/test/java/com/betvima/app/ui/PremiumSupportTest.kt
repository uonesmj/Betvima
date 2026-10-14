package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class PremiumSupportTest {
    @Test fun supportFormRejectsInvalidOrEmptyInputs() {
        assertTrue(supportValidDraft("withdrawal", "Missing payout", "Please check transaction"))
        assertTrue(supportValidDraft("technical", "Bug", "The page did not load"))
        assertFalse(supportValidDraft("invalid_category", "Something", "Help"))
        assertFalse(supportValidDraft("general", "ab", "Help"))
        assertFalse(supportValidDraft("general", "Valid", "   "))
        assertFalse(supportValidDraft("general", "X".repeat(161), "Hello"))
        assertFalse(supportValidDraft("general", "Valid", "X".repeat(5001)))
    }

    @Test fun supportStatusIsNotMistakenForAgentAvailability() {
        assertTrue(supportActive("open"))
        assertTrue(supportActive("waiting_user"))
        assertTrue(supportActive("waiting_support"))
        assertFalse(supportActive("resolved"))
        assertFalse(supportActive("closed"))
    }

    @Test fun everyServerCategoryHasTranslation() {
        for (category in supportCategories) {
            assertTrue(supportCategoryName(category, Lang.EN).isNotBlank())
            assertTrue(supportCategoryName(category, Lang.FA).isNotBlank())
        }
        assertEquals("منتظر پاسخ شما",supportStatusName("waiting_user", Lang.FA))
        assertEquals("در انتظار پشتیبانی",supportStatusName("waiting_support", Lang.FA))
    }
}
