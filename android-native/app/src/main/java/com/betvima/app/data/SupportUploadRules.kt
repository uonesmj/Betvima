package com.betvima.app.data

/** Exact upload limits of the first-party BetVima support endpoint. */
const val SUPPORT_MAX_FILE_BYTES: Long = 10L * 1024 * 1024
val supportAttachmentMimeTypes = setOf(
    "image/jpeg", "image/png", "image/webp", "application/pdf"
)

fun supportUploadSelectable(mime: String, sizeBytes: Long): Boolean =
    mime in supportAttachmentMimeTypes &&
        (sizeBytes == -1L || sizeBytes in 1..SUPPORT_MAX_FILE_BYTES)

fun supportSafeFilename(name: String): String =
    name.trim().replace(Regex("[\\\\/\\x00-\\x1F\\x7F]"), "_")
        .take(140).ifBlank { "support-attachment" }
