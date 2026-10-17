package com.betvima.app.ui

import com.betvima.app.data.ApiFailure
import com.betvima.app.data.InvalidSupportFileException
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportUploadRejection107Test {
    @Test fun fileSizeRejectionShowsExactHttpCode() {
        val value = supportUploadRejectionMessage(ApiFailure(413, "Request too large"), Lang.EN)
        assertTrue(value.contains("413"))
    }

    @Test fun permissionErrorShowsStatus() {
        val value = supportUploadRejectionMessage(ApiFailure(403, "Forbidden"), Lang.FA)
        assertTrue(value.contains("403"))
    }

    @Test fun unsupportedImageEncodingExplainsAcceptedTypes() {
        val value = supportUploadRejectionMessage(InvalidSupportFileException("Unsupported"), Lang.EN)
        assertTrue(value.contains("JPG"))
    }

    @Test fun invalidFileTypeHasStatusAndReason() {
        val value = supportUploadRejectionMessage(
            ApiFailure(400, "Bad file", "VALIDATION_FAILED"), Lang.EN)
        assertTrue(value.contains("400"))
    }
}
