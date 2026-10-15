package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CasinoModelsTest {
    @Test fun parsesProviderCatalogueWithoutFabricatingMissingTitles() {
        val items = JSONArray().put(JSONObject()
            .put("id", "studio/game1")
            .put("name", "Original Slot")
            .put("category", "slots")
            .put("provider", "studio")
            .put("providerName", "Original Studio")
            .put("image", "https://assets.example.test/slot.webp")
            .put("demoSupported", true))
        val page = parseCasinoPage(JSONObject().put("items", items)
            .put("total", 250).put("page", 1).put("limit", 40))
        assertEquals(1, page.games.size)
        assertEquals("studio/game1", page.games.first().id)
        assertTrue(page.games.first().demoSupported)
        assertTrue(page.hasMore)
    }

    @Test fun rejectsMissingIdentityOrUnsafeThumbnailLinks() {
        val items = JSONArray().put(JSONObject()
            .put("id", "").put("name", "Fake")
            .put("category", "slots").put("provider", "x"))
            .put(JSONObject().put("id", "studio/2")
                .put("name", "Real").put("category", "live")
                .put("provider", "studio")
                .put("image", "http://unsafe.invalid/x.png"))
        val result = parseCasinoPage(JSONObject().put("items", items)
            .put("total", 1).put("page", 1).put("limit", 40))
        assertEquals(1, result.games.size)
        assertNull(result.games.first().imageUrl)
        assertFalse(result.hasMore)
        assertFalse(result.games.first().demoSupported)
        assertTrue(result.games.first().canTryDemo)
    }

    @Test fun categoriesHavePersianAndEnglishLabels() {
        assertEquals("اسلات", casinoCategoryLabel("slots", true))
        assertEquals("Live Casino", casinoCategoryLabel("live", false))
        assertEquals("کراش", casinoCategoryLabel("crash", true))
        assertEquals("Other", casinoCategoryLabel("other", false))
    }
}
