package com.betvima.app.ui

import com.betvima.app.data.Match
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class UpcomingTournamentTaxonomyTest {
    private fun fixture(
        id: String, sport: String, country: String, league: String,
        leagueId: String = "", starts: String = "2026-10-22T10:00:00Z"
    ) = Match(
        id = id, league = league, leagueLogo = null, sport = sport,
        country = country, starts = starts, live = false,
        bettingAvailable = false, minute = null,
        homeScore = null, awayScore = null,
        teams = emptyList(), markets = emptyList(), marketsCount = 0,
        leagueId = leagueId
    )

    @Test fun neverMixIdenticallyNamedLeaguesAcrossSportsOrCountries() {
        val a = fixture("a", "football", "GB", "Premier League", "provider-4")
        val b = fixture("b", "basketball", "GB", "Premier League", "provider-4")
        val c = fixture("c", "football", "US", "Premier League", "provider-4")
        val d = fixture("d", "football", "GB", "Premier League", "provider-5")
        val keys = listOf(a,b,c,d).map(::upcomingLeagueKey)
        assertEquals(4, keys.distinct().size)
        assertEquals(keys[0], upcomingLeagueKey(a.copy(id="duplicate")))
    }

    @Test fun noFuzzyCompetitionMappingWithSameCountry() {
        val a = fixture("a", "football", "TR", "Premier League")
        val b = fixture("b", "football", "TR", "Premier League Women")
        assertNotEquals(upcomingLeagueKey(a), upcomingLeagueKey(b))
        assertEquals(1,
            tournamentLeagueNodes(listOf(a,b), "football", "TR")
                .first { it.label == "Premier League Women" }.count)
    }

    @Test fun apiCountryCodeIsAuthoritativeNoTeamOrNameGuess() {
        assertEquals("US", tournamentCountryKey("USA"))
        assertEquals("GB", tournamentCountryKey("GB"))
        assertEquals("international", tournamentCountryKey(""))
        assertEquals("world", tournamentCountryKey("World"))
        assertEquals("unverified:fictional region",
            tournamentCountryKey("Fictional region"))
    }

    @Test fun britishHomeNationsAreDistinctCompetitionRegions() {
        val england = fixture("eng", "football", "England", "Premier League", "1")
        val scotland = fixture("sct", "football", "Scotland", "Premier League", "1")
        val wales = fixture("wal", "football", "Wales", "Premier League", "1")
        val ni = fixture("ni", "football", "Northern Ireland", "Premier League", "1")
        val matches = listOf(england, scotland, wales, ni)
        assertEquals(4, matches.map(::upcomingLeagueKey).distinct().size)
        assertEquals(4, tournamentCountryNodes(matches, "football").size)
        assertEquals("home-nation:england", tournamentCountryKey("England"))
        assertEquals("home-nation:scotland", tournamentCountryKey("Scotland"))
        assertEquals("home-nation:wales", tournamentCountryKey("Wales"))
    }

    @Test fun groupsCountsStayInsideExactSportAndRegion() {
        val all = listOf(
            fixture("a", "football", "Japan", "J League", "11"),
            fixture("b", "football", "Japan", "J League", "11"),
            fixture("c", "football", "Japan", "Cup", "12"),
            fixture("d", "basketball", "Japan", "J League", "11"),
            fixture("e", "football", "Spain", "League", "13")
        )
        assertEquals(3, tournamentCountryNodes(all, "football")
            .first { it.country == "JP" }.count)
        val leagues = tournamentLeagueNodes(all, "football", "JP")
        assertEquals(2, leagues.size)
        assertEquals(2, leagues.first { it.label == "J League" }.count)
        assertEquals(2, upcomingMatchesForLeague(all,
            leagues.first { it.label == "J League" }.key).size)
    }

    @Test fun timeWindowsRejectOutsideOrInvalidTimes() {
        val now = Instant.parse("2026-10-21T12:00:00Z")
        val all = listOf(
            fixture("soon", "tennis", "World", "A",
                starts="2026-10-21T12:20:00Z"),
            fixture("late", "tennis", "World", "B",
                starts="2026-10-21T14:20:00Z"),
            fixture("old", "tennis", "World", "C",
                starts="2026-10-21T10:00:00Z"),
            fixture("invalid", "tennis", "World", "D", starts="unknown")
        )
        assertEquals(listOf("soon"), upcomingWithinHours(all, 1, now).map { it.id })
        assertEquals(4, upcomingWithinHours(all, null, now).size)
    }

    @Test fun esportsGamesNeverBorrowFixturesFromOtherTitles() {
        val cs2 = fixture("cs", "esports", "World", "Champions Cup", "9")
            .copy(esportsGame = "Counter-Strike 2")
        val dota = fixture("dota", "esports", "World", "Champions Cup", "9")
            .copy(esportsGame = "Dota 2")
        val unidentified = fixture("other", "esports", "World", "Champions Cup", "9")
        val all = listOf(cs2, dota, unidentified)
        assertEquals(listOf("cs"),
            upcomingForSport(all, "esports:cs2").map { it.id })
        assertEquals(listOf("dota"),
            upcomingForSport(all, "esports:dota2").map { it.id })
        assertNotEquals(upcomingLeagueKey(cs2), upcomingLeagueKey(dota))
        assertEquals(1, tournamentSportNodes(all)
            .first { it.sport == "esports:cs2" }.count)
    }

    @Test fun tennisOpensDirectLeagueListWithExactKeys() {
        val first = fixture("one", "tennis", "World", "ATP", "100")
        val second = fixture("two", "tennis", "World", "WTA", "101")
        val third = fixture("three", "football", "World", "ATP", "100")
        val nodes = tournamentDirectLeagues(listOf(first, second, third), "tennis")
        assertEquals(2, nodes.size)
        assertTrue(tournamentDirectSport("tennis"))
        assertTrue(tournamentDirectSport("esports:cs2"))
        assertFalse(tournamentDirectSport("football"))
        assertEquals(3, tournamentTopLeagues(listOf(first, second, third)).size)
    }

    @Test fun sportNormalizationIsSafeForHockeyButNeverBasketball() {
        assertEquals("hockey", upcomingSportIdentity("ice-hockey"))
        assertEquals("football", upcomingSportIdentity("soccer"))
        assertEquals("basketball", upcomingSportIdentity("basketball"))
        assertTrue(upcomingSportIdentity("ice-hockey") != upcomingSportIdentity("football"))
    }
}
