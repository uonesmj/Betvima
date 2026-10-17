package com.betvima.app.ui

import java.io.File
import java.nio.file.Files

/** Pure file-system routines for disposable cache roots only.
 * Callers must supply Context.cacheDir or Context.externalCacheDir, never
 * filesDir, databases, app settings or Android Keystore storage.
 */
internal data class CacheFilePurgeResult(
    val filesDeleted: Int = 0,
    val bytesDeleted: Long = 0L,
    val failures: Int = 0
) {
    operator fun plus(other: CacheFilePurgeResult) = CacheFilePurgeResult(
        filesDeleted + other.filesDeleted,
        bytesDeleted + other.bytesDeleted,
        failures + other.failures
    )
}

/** Delete contents but never the root itself.
 * Directory symlinks are unlinked, never traversed outside the cache boundary.
 * A failure is reported rather than claiming everything was cleared.
 */
internal fun purgeCacheContents(root: File?): CacheFilePurgeResult {
    if (root == null || !root.exists()) return CacheFilePurgeResult()
    if (Files.isSymbolicLink(root.toPath()) || !root.isDirectory) {
        return CacheFilePurgeResult(failures = 1)
    }

    fun purge(entry: File): CacheFilePurgeResult {
        // Test symlinks before isDirectory, since the latter follows symbolic links.
        if (Files.isSymbolicLink(entry.toPath()) || !entry.isDirectory) {
            val bytes = if (Files.isSymbolicLink(entry.toPath())) 0L else entry.length().coerceAtLeast(0L)
            return if (entry.delete()) CacheFilePurgeResult(1, bytes)
            else CacheFilePurgeResult(failures = 1)
        }
        val children = entry.listFiles() ?: return CacheFilePurgeResult(failures = 1)
        val removed = children.fold(CacheFilePurgeResult()) { acc, child -> acc + purge(child) }
        return removed + if (entry.delete()) CacheFilePurgeResult()
            else CacheFilePurgeResult(failures = 1)
    }

    val children = root.listFiles() ?: return CacheFilePurgeResult(failures = 1)
    return children.fold(CacheFilePurgeResult()) { acc, child -> acc + purge(child) }
}
