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

    @Test fun liveFactsMatchProviderFixtureAndOnlyPresentRealCounters() {
        val source = JSONObject()
            .put("fi", "202819155")
            .put("minute", 60).put("clockSeconds", 3641)
            .put("clockRunning", true).put("score", "3-2")
            .put("updatedAt", "2026-10-19T00:00:00.000Z")
            .put("stats", JSONArray()
                .put(JSONObject().put("key", "corners")
                    .put("en", "Corners").put("fa", "کرنر")
                    .put("home", 5).put("away", 2))
                .put(JSONObject().put("key", "fouls")
                    .put("en", "Fouls").put("fa", "خطا")
                    .put("home", 7).put("away", 9)))
        val parsed = parseBet365LiveFacts(source)
        assertEquals("202819155", parsed.fi)
        assertEquals(3641, parsed.clockSeconds)
        assertTrue(parsed.clockRunning)
        assertEquals(60, parsed.minute)
        assertEquals(5, parsed.stat("corners")?.home)
        assertEquals(9, parsed.stat("fouls")?.away)
        assertNull(parsed.stat("odds"))
    }
    @Test fun absentAndInvalidTimersNeverCreateRunningClocks() {
        val f = JSONObject().put("fi", "202819155")
            .put("minute", JSONObject.NULL).put("clockSeconds", JSONObject.NULL)
            .put("clockRunning", true).put("stats", JSONArray())
        val parsed = parseBet365LiveFacts(f)
        assertNull(parsed.minute)
        assertNull(parsed.clockSeconds)
        assertFalse(parsed.clockRunning)
        assertTrue(parsed.stats.isEmpty())
    }

    @Test fun fixtureCardsAndDetailKeepAuthoritativeClockState() {
        val incoming = JSONObject(fixture.toString())
            .put("clockSeconds", 2705)
            .put("clockRunning", true)
            .put("clockObservedAt", "2026-10-19T00:53:40.000Z")
        val parsed = parseBet365Catalogue(JSONObject()
            .put("source", BET365_SOURCE)
            .put("matches", JSONArray().put(incoming))).single()
        assertEquals(2705, parsed.clockSeconds)
        assertTrue(parsed.clockRunning)
        assertEquals("2026-10-19T00:53:40.000Z", parsed.clockObservedAt)
        assertFalse(parsed.bettingAvailable)
    }
    @Test fun stoppedProviderClockNeverTicksByDefault() {
        val incoming = JSONObject(fixture.toString())
            .put("minute", 45)
            .put("clockSeconds", 2700)
            .put("clockRunning", false)
        val parsed = parseMatch(incoming)
        assertEquals(45, parsed.minute)
        assertEquals(2700, parsed.clockSeconds)
        assertFalse(parsed.clockRunning)
        assertFalse(withBet365MatchMinute(parsed, JSONObject().put("minute", 45))
            .bettingAvailable)
    }

    @Test fun pathsContainOnlyValidatedProviderIds() {
        val ref = bet365Ref("betsapi:upcoming:17:203138143")!!
        assertEquals("/api/v1/betsapi/card-prices?mode=upcoming&sportId=17&fi=203138143",
            bet365PricesPath(ref, headline = true))
        assertEquals("/api/v1/betsapi/market-refresh?mode=upcoming&sportId=17&fi=203138143",
            bet365PricesPath(ref))
    }

    @Test fun additionalUpcomingPagesAreBoundedAndMetadataDriven() {
        assertEquals(1, bet365UpcomingPageLimit(JSONObject()))
        assertEquals(1, bet365UpcomingPageLimit(JSONObject().put("pageCount", 0)))
        assertEquals(1, bet365UpcomingPageLimit(JSONObject().put("pageCount", "invalid")))
        assertEquals(3, bet365UpcomingPageLimit(JSONObject().put("pageCount", 3)))
        assertEquals(4, bet365UpcomingPageLimit(JSONObject().put("pageCount", 80)))
        assertEquals(2, bet365UpcomingPageLimit(JSONObject().put("pageCount", 80), 2))
        assertTrue(bet365CataloguePath("upcoming", "football", 2).endsWith("page=2"))
    }
}
