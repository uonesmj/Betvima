package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class FixtureIdentityTest {
    @Test fun usesHttpsOnlyForProviderSuppliedImages() {
        assertEquals("https://cdn.example.org/club.svg", verifiedLogoUrl(" https://cdn.example.org/club.svg "))
        assertEquals("https://betvima.com/team-logos/club.svg", verifiedLogoUrl("/team-logos/club.svg"))
        assertNull(verifiedLogoUrl("//external.example/club.svg"))
        assertNull(verifiedLogoUrl("http://example.org/club.png"))
        assertNull(verifiedLogoUrl("javascript:alert(1)"))
        assertNull(verifiedLogoUrl(null))
    }

    @Test fun teamNamesNeverGetGuessedCrests() {
        assertEquals("RM", teamBadgeInitials("Real Madrid"))
        assertEquals("CE", teamBadgeInitials("Celtic FC"))
        assertEquals("SA", teamBadgeInitials("Saitama"))
        assertEquals("?", teamBadgeInitials(" "))
    }

    @Test fun realCountryCodesAndNamesHaveCorrespondingFlags() {
        assertEquals("JP", recognizedCountryCode("Japan"))
        assertEquals("US", recognizedCountryCode("USA"))
        assertEquals("BR", recognizedCountryCode("br"))
        assertEquals("🇯🇵", countryFlag("JP"))
        assertEquals("🇺🇸", countryFlag("United States"))
        assertEquals("Japan", countryDisplayName("JP"))
    }

    @Test fun knownFirstPartyLeagueBadgesAreExactAndNeverSwapped() {
        assertEquals("https://betvima.com/sports/leagues/europa-league.svg",
            firstPartyLeagueLogo("Europe. UEFA Europa League"))
        assertEquals("https://betvima.com/sports/leagues/mls.svg",
            firstPartyLeagueLogo("MLS"))
        assertNull(firstPartyLeagueLogo("UEFA Europa Conference League"))
        assertNull(firstPartyLeagueLogo("NBA Preseason"))
        assertNull(firstPartyLeagueLogo("World. Men. Setka Cup"))
    }

    @Test fun supportsThreeLetterCountryCodesAndSportsFeedAliases() {
        assertEquals("KR", recognizedCountryCode("KOR"))
        assertEquals("JP", recognizedCountryCode("JPN"))
        assertEquals("AU", recognizedCountryCode("AUS"))
        assertEquals("TR", recognizedCountryCode("TUR"))
        assertEquals("KR", recognizedCountryCode("Korea, Republic of"))
        assertEquals("GE", recognizedCountryCode("Georgia"))
    }

    @Test fun neverOverridesConfirmedCountryOrGuessesForCrossBorderLeagues() {
        assertEquals("South Korea", resolvedCompetitionCountry("International", "KBO"))
        assertEquals("Japan", resolvedCompetitionCountry("World", "NPB"))
        assertEquals("Australia", resolvedCompetitionCountry("International", "A-League"))
        assertEquals("South Korea", resolvedCompetitionCountry("International", "K League 1"))
        assertEquals("Turkey", resolvedCompetitionCountry("", "Turkey Super League"))
        assertEquals("International", resolvedCompetitionCountry("International", "NBL"))
        assertEquals("Japan", resolvedCompetitionCountry("Japan", "A-League"))
    }

    @Test fun exactLogoMappingsAndNonemptyMonograms() {
        assertTrue(knownPublicLeagueLogo("NPB")!!.contains("NPB_logo.svg"))
        assertTrue(knownPublicLeagueLogo("KBO")!!.contains("Korea_Baseball_Organization"))
        assertNull(knownPublicLeagueLogo("KBO Futures League"))
        assertNull(knownPublicLeagueLogo("NBA"))
        assertEquals("NPB", leagueBadgeInitials("NPB"))
        assertEquals("KL", leagueBadgeInitials("K League 1"))
        assertEquals("?", leagueBadgeInitials("  "))
    }

    @Test fun continentsAndUnknownCountriesNeverGetFakeFlags() {
        assertNull(countryFlag("Europe"))
        assertNull(countryFlag("World"))
        assertNull(countryFlag(""))
        assertNull(countryFlag("XX"))
    }
}
