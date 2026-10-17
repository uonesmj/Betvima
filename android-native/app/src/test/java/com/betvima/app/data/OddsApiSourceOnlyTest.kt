package com.betvima.app.data

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OddsApiSourceOnlyTest {
    @Test fun onlyFirstPartyOddsApiMatchesAreAllowed() {
        assertTrue(isOfficialSportsbookMatch(JSONObject().put("provider", "the_odds_api")))
        assertFalse(isOfficialSportsbookMatch(JSONObject().put("provider", "retired_vendor")))
        assertFalse(isOfficialSportsbookMatch(JSONObject().put("provider", "disabled")))
        assertFalse(isOfficialSportsbookMatch(JSONObject().put("provider", "")))
        assertFalse(isOfficialSportsbookMatch(JSONObject()))
    }
}
