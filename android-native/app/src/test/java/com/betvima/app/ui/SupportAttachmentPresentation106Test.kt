package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportAttachmentPresentation106Test {
    @Test fun clearFileStatesDoNotClaimUploadBeforeServerAcknowledgement() {
        assertEquals("Ready to send", supportAttachmentPhaseLabel(SupportAttachmentPhase.READY, Lang.EN))
        assertEquals("Uploading...", supportAttachmentPhaseLabel(SupportAttachmentPhase.UPLOADING, Lang.EN))
        assertTrue(supportAttachmentPhaseLabel(SupportAttachmentPhase.FAILED, Lang.EN).contains("failed"))
        assertTrue(supportAttachmentPhaseLabel(SupportAttachmentPhase.VERIFY, Lang.EN).contains("Check"))
    }

    @Test fun farsiUploadStateLabelsAreAvailable() {
        for (phase in SupportAttachmentPhase.entries) {
            assertTrue(supportAttachmentPhaseLabel(phase, Lang.FA).isNotBlank())
        }
        assertEquals("آماده ارسال", supportAttachmentPhaseLabel(SupportAttachmentPhase.READY, Lang.FA))
        assertEquals("در حال ارسال...", supportAttachmentPhaseLabel(SupportAttachmentPhase.UPLOADING, Lang.FA))
    }
}
