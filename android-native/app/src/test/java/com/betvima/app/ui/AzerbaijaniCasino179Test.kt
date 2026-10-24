package com.betvima.app.ui

import com.betvima.app.data.casinoDemoFailure
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AzerbaijaniCasino179Test {
    @Test fun casinoDemoFailureCategoriesHaveAzerbaijaniSafetyMessages() {
        val messages = listOf(
            casinoDemoFailure(null, true, false, "CASINO_DEMO_UNAVAILABLE"),
            casinoDemoFailure(401, false, false),
            casinoDemoFailure(422, false, false),
            casinoDemoFailure(404, false, false),
            casinoDemoFailure(429, false, false),
            casinoDemoFailure(503, true, false),
            casinoDemoFailure(null, true, false),
            casinoDemoFailure(null, false, false)
        )
        for (source in messages) {
            val translated = AzerbaijaniQuality179.translate(source)
            assertNotNull("Untranslated casino failure: $source", translated)
            assertNotEquals(source, translated)
            assertTrue(translated!!.isNotBlank())
        }
    }
}
