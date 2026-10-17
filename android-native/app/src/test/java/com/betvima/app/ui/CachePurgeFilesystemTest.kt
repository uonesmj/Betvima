package com.betvima.app.ui

import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assert.*
import org.junit.Test

class CachePurgeFilesystemTest {
    @Test fun deletesOnlyDisposableContentsAndLeavesCacheRootIntact() {
        val base = Files.createTempDirectory("betvima-cache-test-")
        try {
            val cache = Files.createDirectory(base.resolve("cache"))
            val persistent = Files.createDirectory(base.resolve("persistent"))
            val token = Files.write(persistent.resolve("encrypted-session.dat"), byteArrayOf(7, 8, 9))
            val pin = Files.write(persistent.resolve("pin-lock.dat"), byteArrayOf(1, 2))
            Files.write(cache.resolve("image.png"), byteArrayOf(1, 2, 3, 4))
            val nested = Files.createDirectories(cache.resolve("http/images"))
            Files.write(nested.resolve("old-image.jpg"), byteArrayOf(5, 6, 7))

            val report = purgeCacheContents(cache.toFile())

            assertTrue(Files.exists(cache))
            assertEquals(0, Files.list(cache).use { it.count() }.toInt())
            assertEquals(2, report.filesDeleted)
            assertEquals(7L, report.bytesDeleted)
            assertEquals(0, report.failures)
            assertArrayEquals(byteArrayOf(7, 8, 9), Files.readAllBytes(token))
            assertArrayEquals(byteArrayOf(1, 2), Files.readAllBytes(pin))
        } finally {
            deleteTestTree(base)
        }
    }

    @Test fun neverFollowsSymbolicLinkOutsideTheCacheRoot() {
        val base = Files.createTempDirectory("betvima-cache-symlinks-")
        try {
            val cache = Files.createDirectory(base.resolve("cache"))
            val privateDir = Files.createDirectory(base.resolve("private"))
            val protectedFile = Files.write(privateDir.resolve("account.json"), "secret".toByteArray())
            Files.createSymbolicLink(cache.resolve("bad-link"), privateDir)
            val report = purgeCacheContents(cache.toFile())
            assertEquals(1, report.filesDeleted)
            assertTrue(Files.exists(protectedFile))
            assertFalse(Files.exists(cache.resolve("bad-link")))
        } finally {
            deleteTestTree(base)
        }
    }

    @Test fun refusesASymlinkPassedAsRootRatherThanFollowingIt() {
        val base = Files.createTempDirectory("betvima-cache-root-")
        try {
            val privateDir = Files.createDirectory(base.resolve("private"))
            val file = Files.write(privateDir.resolve("vault.json"), byteArrayOf(1))
            val symlink = Files.createSymbolicLink(base.resolve("cache"), privateDir)
            val report = purgeCacheContents(symlink.toFile())
            assertEquals(1, report.failures)
            assertTrue(Files.exists(symlink))
            assertTrue(Files.exists(file))
        } finally {
            deleteTestTree(base)
        }
    }

    @Test fun repeatedClearDoesNotFailOrDeleteTheRoot() {
        val root = Files.createTempDirectory("betvima-empty-cache-")
        try {
            assertEquals(CacheFilePurgeResult(), purgeCacheContents(root.toFile()))
            assertEquals(CacheFilePurgeResult(), purgeCacheContents(root.toFile()))
            assertTrue(Files.exists(root))
        } finally {
            deleteTestTree(root)
        }
    }

    private fun deleteTestTree(root: Path) {
        if (!Files.exists(root)) return
        Files.walk(root).use { paths ->
            paths.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) }
        }
    }
}
