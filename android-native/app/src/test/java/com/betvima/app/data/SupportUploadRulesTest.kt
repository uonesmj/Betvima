package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class SupportUploadRulesTest {
    @Test fun onlyServerPermittedFileTypesAreSelectable() {
        for (mime in listOf("image/jpeg", "image/png", "image/webp", "application/pdf")) {
            assertTrue(supportUploadSelectable(mime, 1))
            assertTrue(supportUploadSelectable(mime, SUPPORT_MAX_FILE_BYTES))
        }
        assertFalse(supportUploadSelectable("text/plain", 100))
        assertFalse(supportUploadSelectable("application/octet-stream", 100))
        assertFalse(supportUploadSelectable("image/gif", 100))
    }

    @Test fun fileSizeCannotExceedTenMegabytesOrBeEmpty() {
        assertFalse(supportUploadSelectable("application/pdf", 0))
        assertFalse(supportUploadSelectable("application/pdf", SUPPORT_MAX_FILE_BYTES+1))
        assertTrue(supportUploadSelectable("image/png", -1))
        assertFalse(supportUploadSelectable("image/png", -2))
    }

    @Test fun multipartFilenameRemovesPathAndControlCharacters() {
        assertEquals("a_b.pdf", supportSafeFilename("a/b.pdf"))
        assertEquals("note.txt", supportSafeFilename(" note.txt "))
        assertEquals("support-attachment", supportSafeFilename("  "))
        assertTrue(supportSafeFilename("x".repeat(250)).length <= 140)
    }
}
