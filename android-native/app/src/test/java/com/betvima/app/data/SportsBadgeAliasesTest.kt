package com.betvima.app.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class SportsBadgeAliasesTest {
    @Test fun readsAlternateBadgeFieldsForTheSameParticipantOnly() {
        val match = parseMatch(JSONObject("""
            {
              "id": "fixture-1",
              "leagueName": "K League 1",
              "sportKey": "football",
              "participants": [
                {
                  "name": "FC Seoul",
                  "role": "HOME",
                  "logoUrl": "https://example.org/seoul-broken.png",
                  "crestUrl": "https://example.org/seoul-verified.svg"
                },
                {
                  "name": "Jeonbuk",
                  "role": "AWAY",
                  "badge": "https://example.org/jeonbuk.png"
                }
              ]
            }
        """.trimIndent()))
        assertEquals("https://example.org/seoul-broken.png", match.home.logo)
        assertEquals(listOf("https://example.org/seoul-verified.svg"), match.home.alternateLogos)
        assertEquals("https://example.org/jeonbuk.png", match.away.logo)
        assertTrue(match.away.alternateLogos.isEmpty())
    }

    @Test fun missingArtKeepsTeamIdentityWithoutBorrowingOpponentBadge() {
        val match = parseMatch(JSONObject("""
            {
              "id": "fixture-2",
              "participants": [
                {"name": "Home", "role": "HOME"},
                {"name": "Away", "role": "AWAY", "badgeUrl": "https://example.org/away.png"}
              ]
            }
        """.trimIndent()))
        assertNull(match.home.logo)
        assertTrue(match.home.alternateLogos.isEmpty())
        assertEquals("https://example.org/away.png", match.away.logo)
    }
}
