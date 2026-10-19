package com.betvima.app.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class Bet365Outage123Test {
    @Test fun unconfiguredSupplierIsNotReportedAsZeroScheduledGames() {
        try {
            parseBet365Catalogue(JSONObject().put("source","betsapi_bet365")
                .put("error","NOT_CONFIGURED").put("matches",org.json.JSONArray()))
            throw AssertionError("An inaccessible feed cannot be classified as an empty schedule")
        } catch (error: ApiFailure) {
            assertTrue(error.message.orEmpty().contains("NOT_CONFIGURED"))
        }
    }

    @Test fun confirmedEmptyProviderScheduleIsAnEmptyList() {
        val fixtures = parseBet365Catalogue(JSONObject().put("source","betsapi_bet365")
            .put("matches",org.json.JSONArray()))
        assertTrue(fixtures.isEmpty())
    }

    @Test fun differentProviderIsRejectedRatherThanMixedWithBetsApi() {
        try {
            parseBet365Catalogue(JSONObject().put("source","legacy_odds_provider")
                .put("matches",org.json.JSONArray()))
            throw AssertionError("Legacy provider must remain excluded")
        } catch (error: ApiFailure) {
            assertEquals(503,error.code)
        }
    }
}
