package com.betvima.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SupportUploadSignatureTest {
    @Test fun detectsAllowedFormatsFromRealBytes() {
        assertEquals("image/jpeg", supportActualMime(byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0)))
        assertEquals("image/png", supportActualMime(byteArrayOf(
            0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))
        assertEquals("image/webp", supportActualMime("RIFF0000WEBP".toByteArray(Charsets.US_ASCII)))
        assertEquals("application/pdf", supportActualMime("%PDF-1.7".toByteArray(Charsets.US_ASCII)))
    }

    @Test fun rejectsWrongMagicAndUnsupportedImageFormats() {
        assertNull(supportActualMime(byteArrayOf()))
        assertNull(supportActualMime("not a real jpg".toByteArray()))
        assertNull(supportActualMime("00000000ftypheic".toByteArray()))
        assertNull(supportActualMime("RIFF0000WAVE".toByteArray()))
    }
}
