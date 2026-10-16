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

    @Test fun demoFailureExplainsUnlicensedDemoWithoutClaimingWalletAccess() {
        val noDemoFa = casinoDemoFailure(500, false, true)
        assertTrue(noDemoFa.contains("ناموفق"))
        assertTrue(noDemoFa.contains("Aviator"))
        assertTrue(casinoDemoFailure(500, false, false).contains("Real-money"))
        assertTrue(casinoDemoFailure(503, true, false).contains("verified demo"))
        assertTrue(casinoDemoFailure(401, true, true).contains("وارد"))
        assertTrue(casinoDemoFailure(429, false, false).contains("Too many"))
    }

    @Test fun pilotEligibilityDefaultsToDisabledAndPreservesExactCents() {
        val empty = parseCasinoEligibility(JSONObject())
        assertFalse(empty.realMoneyEnabled)
        assertEquals("USD", empty.walletCurrency)
        assertEquals("0.00", empty.displayedUsd)

        val allowed = parseCasinoEligibility(JSONObject()
            .put("realMoneyEnabled", true)
            .put("walletCurrency", "IRT")
            .put("availableUsdMinor", "123456")
            .put("minStakeUsdMinor", "20"))
        assertTrue(allowed.realMoneyEnabled)
        assertEquals("IRT", allowed.walletCurrency)
        assertEquals("1234.56", allowed.displayedUsd)

        val malformed = parseCasinoEligibility(JSONObject()
            .put("walletCurrency", "EUR")
            .put("availableUsdMinor", "-999"))
        assertEquals("USD", malformed.walletCurrency)
        assertEquals("0.00", malformed.displayedUsd)
    }

    @Test fun studioOptionsIncludeFullCatalogueAndExcludeUnsafeEntries() {
        val page = parseCasinoPage(JSONObject()
            .put("items", JSONArray().put(JSONObject()
                .put("id", "known").put("name", "Demo")
                .put("category", "slots").put("provider", "Visible")))
            .put("providers", JSONArray()
                .put("Visible").put("Off-page Studio")
                .put("Off-page Studio").put(9).put(""))
            .put("total", 4940).put("page", 1).put("limit", 40))
        assertEquals(listOf("Visible", "Off-page Studio"), page.providers)
        assertEquals(1, page.games.size)
        assertTrue(page.hasMore)
        assertTrue(parseCasinoPage(JSONObject()).providers.isEmpty())
    }

    @Test fun malformedServerEligibilityNeverGrantsRealMoneyButtons() {
        val permitted = JSONObject()
            .put("realMoneyEnabled", true)
            .put("walletCurrency", "IRT")
            .put("availableUsdMinor", "2043")
            .put("minStakeUsdMinor", "20")
        assertTrue(parseCasinoEligibility(permitted).realMoneyEnabled)
        assertEquals("0.20", parseCasinoEligibility(permitted).displayedMinimumUsd)

        for ((key, value) in listOf(
            "walletCurrency" to "GBP",
            "availableUsdMinor" to "-40",
            "availableUsdMinor" to "9999999999999999999",
            "minStakeUsdMinor" to "0",
            "minStakeUsdMinor" to "abc"
        )) {
            val corrupted = JSONObject(permitted.toString()).put(key, value)
            assertFalse("$key accepted invalid value $value",
                parseCasinoEligibility(corrupted).realMoneyEnabled)
        }
    }

    @Test fun categoriesHavePersianAndEnglishLabels() {
        assertEquals("اسلات", casinoCategoryLabel("slots", true))
        assertEquals("Live Casino", casinoCategoryLabel("live", false))
        assertEquals("کراش", casinoCategoryLabel("crash", true))
        assertEquals("Other", casinoCategoryLabel("other", false))
    }
}
