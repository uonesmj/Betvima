package com.betvima.app.data

// The web ingress template currently has an 8 MiB generic request cap,
// whereas the support storage bucket permits up to 10 MiB. Keep photo
// multipart requests below 6 MiB to leave room for multipart overhead.
const val SUPPORT_INGRESS_SAFE_BYTES: Int = 6 * 1024 * 1024

/** Never trust a document provider's MIME label without validating its bytes. */
fun detectSupportMime(bytes: ByteArray): String? = when {
    bytes.size >= 3 && bytes[0] == 0xff.toByte() &&
        bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte() -> "image/jpeg"
    bytes.size >= 8 && bytes.sliceArray(0 until 8).contentEquals(byteArrayOf(
        0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) -> "image/png"
    bytes.size >= 12 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" &&
        String(bytes, 8, 4, Charsets.US_ASCII) == "WEBP" -> "image/webp"
    bytes.size >= 5 && String(bytes, 0, 5, Charsets.US_ASCII) == "%PDF-" -> "application/pdf"
    else -> null
}

fun supportRequiresPhotoOptimization(mime: String, sizeBytes: Int): Boolean =
    mime.startsWith("image/") && sizeBytes > SUPPORT_INGRESS_SAFE_BYTES

fun supportCanonicalUploadFilename(originalName: String, actualMime: String): String {
    val suffix = when (actualMime) {
        "image/jpeg" -> ".jpg"
        "image/png" -> ".png"
        "image/webp" -> ".webp"
        "application/pdf" -> ".pdf"
        else -> throw IllegalArgumentException("Unsupported attachment format")
    }
    val safe = supportSafeFilename(originalName)
    val stem = safe.substringBeforeLast('.', safe).take(125).ifBlank { "support-photo" }
    return stem + suffix
}
