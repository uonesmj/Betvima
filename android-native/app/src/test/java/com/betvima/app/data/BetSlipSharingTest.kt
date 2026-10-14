package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class BetSlipSharingTest {
    private fun pick(i:Int, scaled:String="17600"):Pick = Pick(
        matchId="00000000-0000-4000-8000-%012d".format(i),
        marketId="10000000-0000-4000-8000-%012d".format(i),
        selectionId="20000000-0000-4000-8000-%012d".format(i),
        match="Team $i - Team B", market="Full time",
        selection="Home", oddsScaled=scaled, version=3, live=false
    )
    @Test fun createsSameBackendFieldsAsWebShareEndpoint() {
        val body=shareSlipPayload(listOf(pick(1),pick(2)),"USD")
        assertEquals("MULTIPLE",body.getString("type"))
        assertEquals("USD",body.getString("currency"))
        val first=body.getJSONArray("selections").getJSONObject(0)
        assertEquals("Team 1 - Team B",first.getString("matchLabel"))
        assertEquals("Full time",first.getString("marketLabel"))
        assertEquals("Home",first.getString("label"))
        assertEquals("football",first.getString("sportSlug"))
        assertEquals(3,first.getInt("oddsVersionSeen"))
        assertEquals("17600",first.getString("oddsScaled"))
    }
    @Test fun rejectsDuplicatesAndOversizedSlips() {
        assertThrows(IllegalArgumentException::class.java) {
            shareSlipPayload(listOf(pick(1),pick(1)),"USD")
        }
        assertThrows(IllegalArgumentException::class.java) {
            shareSlipPayload((1..21).map { pick(it) },"USD")
        }
    }
    @Test fun exactCodeRegexMatchesSite() {
        assertTrue(validBetSlipCode(" nova-abcdefgh "))
        assertTrue(validBetSlipCode("NOVA-23456789"))
        assertFalse(validBetSlipCode("NOVA-01234567"))
        assertFalse(validBetSlipCode("NOVA-ABCDEFGI"))
        assertFalse(validBetSlipCode("BETVIMA-ABCDEFGH"))
        assertFalse(validBetSlipCode("NOVA-AAAA"))
    }
    @Test fun importsOnlyFreshAvailableSnapshotAndOmitsClosedPicks() {
        fun leg(i:Int,available:Boolean):JSONObject {
            val p=pick(i)
            return JSONObject()
                .put("available",available)
                .put("current",JSONObject()
                    .put("matchId",p.matchId)
                    .put("marketId",p.marketId)
                    .put("selectionId",p.selectionId)
                    .put("matchLabel",p.match)
                    .put("marketLabel",p.market)
                    .put("label",p.selection)
                    .put("oddsScaled",p.oddsScaled)
                    .put("oddsVersion",9)
                    .put("isLive",false))
        }
        val payload=JSONObject()
            .put("code","NOVA-ABCDEFGH")
            .put("currency","USD")
            .put("unavailableCount",1)
            .put("legs",JSONArray().put(leg(1,true))
                .put(leg(2,false)).put(leg(1,true)))
        val result=parseImportedSlip(payload)
        assertEquals(1,result.picks.size)
        assertEquals(9,result.picks[0].version)
        assertEquals(1,result.unavailableCount)
        assertEquals("17600",result.picks[0].oddsScaled)
    }
    @Test fun dropsSnapshotsWithNonOpenOdds() {
        val p=pick(1)
        val doc=JSONObject().put("code","NOVA-ABCDEFGH").put("currency","USD")
            .put("legs",JSONArray().put(JSONObject().put("available",true)
                .put("current",JSONObject()
                    .put("matchId",p.matchId).put("selectionId",p.selectionId)
                    .put("marketId",p.marketId)
                    .put("oddsScaled","10000").put("oddsVersion",3))))
        assertTrue(parseImportedSlip(doc).picks.isEmpty())
    }
    @Test fun changingSelectionsInvalidatesGeneratedCodeFingerprint() {
        val old=betSlipShareFingerprint(listOf(pick(1),pick(2)),"USD")
        assertNotEquals(old,betSlipShareFingerprint(listOf(pick(1),pick(2,"19000")),"USD"))
        assertNotEquals(old,betSlipShareFingerprint(listOf(pick(1),pick(2)),"IRR"))
    }
}
