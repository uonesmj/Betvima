package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class Bet365SportsAdapterTest {
    private val fixture = JSONObject()
        .put("id", "betsapi:live:1:202819155")
        .put("sportKey", "football")
        .put("leagueName", "Portugal Cup")
        .put("leagueLogoUrl", "/sports/leagues/portugal-cup.png")
        .put("isLive", true)
        .put("isBettingAvailable", true) // external fixtures must override this
        .put("minute", 74)
        .put("homeScore", 1).put("awayScore", 2)
        .put("participants", JSONArray()
            .put(JSONObject().put("role", "HOME").put("name", "Home FC")
                .put("logoUrl", "https://example.com/home.png"))
            .put(JSONObject().put("role", "AWAY").put("name", "Away FC")))

    @Test fun fixturesNeverBecomeWagerable() {
        val matches = parseBet365Catalogue(JSONObject()
            .put("source", BET365_SOURCE)
            .put("matches", JSONArray().put(fixture)))
        assertEquals(1, matches.size)
        val match = matches.single()
        assertFalse(match.bettingAvailable)
        assertEquals("Portugal Cup", match.league)
        assertEquals("Home FC", match.home.name)
        assertEquals("https://example.com/home.png", match.home.logo)
        assertEquals(74, match.minute)
        assertEquals(2, match.awayScore)
        assertEquals("betsapi:live:1:202819155", match.id)
    }

    @Test fun legacyOddsApiMatchesAreRejected() {
        try {
            parseBet365Catalogue(JSONObject().put("source", "the_odds_api")
                .put("matches", JSONArray().put(fixture)))
            fail("Expected exclusive provider source")
        } catch (failure: ApiFailure) {
            assertEquals(503, failure.code)
        }
    }

    @Test fun sportIdentityUsesExistingNativeHockeyLabel() {
        assertEquals("ice-hockey", betsApiSport("hockey"))
        assertTrue(bet365CataloguePath("upcoming", "hockey")
            .contains("sport=ice-hockey"))
        assertEquals(null, betsApiSport("unsupported"))
        assertEquals("202819155", bet365Ref(fixture.getString("id"))?.fi)
        assertEquals(null, bet365Ref("any-old-local-match-id"))
    }

    @Test fun headlineUsesExactProviderOddsAndStaysNonActionable() {
        val m = parseMatch(fixture)
        val preview = JSONObject()
            .put("source", BET365_SOURCE)
            .put("marketCount", 26)
            .put("market", JSONObject()
                .put("name", "Fulltime Result")
                .put("selections", JSONArray()
                    .put(JSONObject().put("label", "Home FC")
                        .put("decimal", "2.1000"))
                    .put(JSONObject().put("label", "Draw")
                        .put("decimal", "3.2500"))
                    .put(JSONObject().put("label", "Away FC")
                        .put("decimal", "4.0000"))))
        val enriched = withBet365Headline(m, preview)
        assertEquals(26, enriched.marketsCount)
        assertEquals(3, enriched.featured?.selections?.size)
        assertEquals("21000", enriched.featured?.selections?.first()?.oddsScaled)
        assertEquals("2.10", odds(enriched.featured!!.selections.first().oddsScaled))
        assertFalse(enriched.bettingAvailable)
        assertFalse(enriched.featured!!.available)
        assertTrue(enriched.featured!!.selections.none { it.available })
        assertTrue(enriched.featured!!.selections.all { it.id.startsWith("bet365-preview:") })
        assertTrue(enriched.featured!!.selections.all { it.id.contains("display-index-") })
    }

    @Test fun matchDetailsUseReadOnlyBet365Markets() {
        val m = parseMatch(fixture)
        val full = JSONObject()
            .put("source", BET365_SOURCE)
            .put("marketCount", 2)
            .put("markets", JSONArray()
                .put(JSONObject().put("key", "FT").put("title", "Fulltime Result")
                    .put("selections", JSONArray()
                        .put(JSONObject().put("id", "11").put("label", "Draw")
                            .put("decimal", "1.2500"))))
                .put(JSONObject().put("key", "CORNERS").put("title", "Corners")
                    .put("selections", JSONArray()
                        .put(JSONObject().put("id", "21").put("label", "Over 9.5")
                            .put("decimal", "2.5000")))))
        val enriched = withBet365Details(m, full)
        assertEquals(2, enriched.markets.size)
        assertEquals("12500", enriched.markets.first().selections.first().oddsScaled)
        assertFalse(enriched.bettingAvailable)
        assertTrue(enriched.markets.all { !it.available })
    }

    @Test fun eventClockUpdatesWithoutChangingNativeMarketOrVisualModels() {
        val old = parseMatch(fixture.put("minute", JSONObject.NULL))
        assertNull(old.minute)
        val updated = withBet365MatchMinute(old, JSONObject().put("minute", 79))
        assertEquals(79, updated.minute)
        assertEquals(old.id, updated.id)
        assertEquals(old.league, updated.league)
        assertEquals(old.home.logo, updated.home.logo)
        assertFalse(updated.bettingAvailable)
        assertNull(withBet365MatchMinute(old, JSONObject().put("minute", "error")).minute)
        assertNull(withBet365MatchMinute(old, JSONObject().put("minute", 210)).minute)
        assertNull(withBet365MatchMinute(old, null).minute)
    }

    @Test fun pathsContainOnlyValidatedProviderIds() {
        val ref = bet365Ref("betsapi:upcoming:17:203138143")!!
        assertEquals("/api/v1/betsapi/card-prices?mode=upcoming&sportId=17&fi=203138143",
            bet365PricesPath(ref, headline = true))
        assertEquals("/api/v1/betsapi/market-refresh?mode=upcoming&sportId=17&fi=203138143",
            bet365PricesPath(ref))
    }
}
