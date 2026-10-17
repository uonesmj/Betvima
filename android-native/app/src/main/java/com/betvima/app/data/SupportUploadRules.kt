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


/**
 * Determine the actual supported type from its file signature rather than
 * Android DocumentsProvider metadata. The backend validates the same bytes.
 * Never guess from the filename and never silently transform identity files.
 */
fun supportActualMime(header: ByteArray): String? {
    fun isAt(offset: Int, vararg values: Int): Boolean =
        header.size >= offset + values.size &&
            values.indices.all { i -> header[offset + i].toInt() and 0xff == values[i] }
    return when {
        isAt(0, 0xff, 0xd8, 0xff) -> "image/jpeg"
        isAt(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) -> "image/png"
        isAt(0, 0x52, 0x49, 0x46, 0x46) && isAt(8, 0x57, 0x45, 0x42, 0x50) -> "image/webp"
        isAt(0, 0x25, 0x50, 0x44, 0x46, 0x2d) -> "application/pdf"
        else -> null
    }
}
