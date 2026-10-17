package com.betvima.app.data

import org.junit.Assert.*
import org.junit.Test

class SupportUploadPreparationTest {
    @Test fun magicHeaderOverridesIncorrectDocumentProviderLabel() {
        assertEquals("image/jpeg", detectSupportMime(byteArrayOf(
            0xff.toByte(),0xd8.toByte(),0xff.toByte(),0x00)))
        assertEquals("image/png", detectSupportMime(byteArrayOf(
            0x89.toByte(),0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)))
        assertEquals("image/webp", detectSupportMime(
            "RIFF0000WEBP".toByteArray(Charsets.US_ASCII)))
        assertEquals("application/pdf", detectSupportMime(
            "%PDF-1.7".toByteArray(Charsets.US_ASCII)))
        assertNull(detectSupportMime("<html>".toByteArray()))
        assertNull(detectSupportMime(byteArrayOf(0xff.toByte(),0xd8.toByte())))
    }

    @Test fun avoid8MegIngressRejectionsWithoutChangingSmallFiles() {
        assertFalse(supportRequiresPhotoOptimization("image/jpeg", 120_000))
        assertFalse(supportRequiresPhotoOptimization("image/png", SUPPORT_INGRESS_SAFE_BYTES))
        assertTrue(supportRequiresPhotoOptimization("image/jpeg", 9 * 1024 * 1024))
        assertTrue(supportRequiresPhotoOptimization("image/webp", 8 * 1024 * 1024))
        assertFalse(supportRequiresPhotoOptimization("application/pdf", 9 * 1024 * 1024))
    }

    @Test fun sentNameAlwaysMatchesValidatedBytes() {
        assertEquals("photo.jpg", supportCanonicalUploadFilename("photo.png", "image/jpeg"))
        assertEquals("passport.pdf", supportCanonicalUploadFilename("passport.jpeg", "application/pdf"))
        assertEquals("image.webp", supportCanonicalUploadFilename("image.jpg", "image/webp"))
        assertFalse(supportCanonicalUploadFilename("a/b", "image/jpeg").contains("/"))
    }
}
