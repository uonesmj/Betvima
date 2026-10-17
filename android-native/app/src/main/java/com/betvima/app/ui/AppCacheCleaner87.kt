package com.betvima.app.ui

import android.content.Context
import android.webkit.WebView
import coil.imageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.file.Files

/** Result of the explicit user-triggered cleanup, never of a data reset. */
internal data class AppCacheCleanupResult(
    val deletedFiles: Int,
    val bytesFreed: Long,
    val failures: Int,
    val webCacheCleared: Boolean,
    val imageCacheCleared: Boolean
) {
    val complete: Boolean get() = failures == 0 && webCacheCleared && imageCacheCleared
}

/** Total bytes in non-symlinked files below a disposable cache directory. */
private fun cacheFootprint(root: File?): Long {
    if (root == null || !root.exists() || Files.isSymbolicLink(root.toPath())) return 0L
    if (root.isFile) return root.length().coerceAtLeast(0L)
    return root.listFiles()?.sumOf(::cacheFootprint) ?: 0L
}

/**
 * Does NOT call clearApplicationUserData(), WebStorage.deleteAllData(),
 * CookieManager.removeAllCookies(), deleteDatabase(), preferences.clear(),
 * or delete filesDir / codeCacheDir.
 *
 * User sign-in, local PIN/pattern, MFA session, wallet/account state, and
 * saved preferences remain intact. WebView HTTP resources and Coil images
 * will be fetched again when needed.
 */
internal object AppCacheCleaner87 {
    suspend fun clear(context: Context): AppCacheCleanupResult {
        val app = context.applicationContext
        val internal = app.cacheDir
        val external = app.externalCacheDir?.takeUnless {
            it.canonicalPath == internal.canonicalPath
        }

        val before = withContext(Dispatchers.IO) {
            cacheFootprint(internal) + cacheFootprint(external)
        }

        // WebView must only be constructed and interacted with on main.
        // clearCache(true) removes HTTP cache, not site storage or cookies.
        val webCleared = withContext(Dispatchers.Main.immediate) {
            runCatching {
                val webView = WebView(app)
                try { webView.clearCache(true) }
                finally { webView.destroy() }
            }.isSuccess
        }

        val loader = app.imageLoader
        val result = withContext(Dispatchers.IO) {
            val memoryOk = runCatching { loader.memoryCache?.clear() }.isSuccess
            val diskOk = runCatching { loader.diskCache?.clear() }.isSuccess
            // App-owned cache roots ONLY. Never traverse private persisted data.
            val files = purgeCacheContents(internal) + purgeCacheContents(external)
            val after = cacheFootprint(internal) + cacheFootprint(external)
            AppCacheCleanupResult(
                deletedFiles = files.filesDeleted,
                bytesFreed = (before - after).coerceAtLeast(files.bytesDeleted).coerceAtLeast(0L),
                failures = files.failures,
                webCacheCleared = webCleared,
                imageCacheCleared = memoryOk && diskOk
            )
        }
        return result
    }
}
