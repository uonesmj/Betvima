package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class FixtureIdentityTest {
    @Test fun usesHttpsOnlyForProviderSuppliedImages() {
        assertEquals("https://cdn.example.org/club.svg", verifiedLogoUrl(" https://cdn.example.org/club.svg "))
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

    @Test fun continentsAndUnknownCountriesNeverGetFakeFlags() {
        assertNull(countryFlag("Europe"))
        assertNull(countryFlag("World"))
        assertNull(countryFlag(""))
        assertNull(countryFlag("XX"))
    }
}
