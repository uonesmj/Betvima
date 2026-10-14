package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class BonusDashboardModelsTest {
    private fun grant(): BonusReward = BonusReward(
        id = "fcb4e52b-987b-4133-a1b6-2beed6fd1b70",
        title = "100% Deposit Bonus", description = "",
        status = "active", currency = "USD",
        amountMinor = "4000", remainingMinor = "4000",
        grantedAt = Instant.now().toString(),
        expiresAt = Instant.now().plusSeconds(3600).toString(),
        usedAt = "", betId = null, depositId = "tx-01"
    )

    @Test fun serverCountdownDoesNotTrustDeviceGrantCreation() {
        assertEquals(24L*60*60*1000,bonusMillisecondsLeft(
            "2026-10-15T00:00:00Z",Instant.parse("2026-10-14T00:00:00Z").toEpochMilli()))
        assertEquals(0L,bonusMillisecondsLeft(
            "2026-10-14T00:00:00Z",Instant.parse("2026-10-15T00:00:00Z").toEpochMilli()))
        assertEquals("24:00:00",bonusClockLabel(86_400_000L))
        assertEquals("00:00:00",bonusClockLabel(-100L))
    }

    @Test fun onlyExactlyFourPicksAtLeast16000AndFullBonusAreEligible() {
        val good = grant()
        assertTrue(bonusLegsLookEligible(listOf(16000L,16000L,20000L,18500L),"4000",good))
        assertFalse(bonusLegsLookEligible(listOf(15999L,16000L,20000L,20000L),"4000",good))
        assertFalse(bonusLegsLookEligible(listOf(16000L,16000L,16000L),"4000",good))
        assertFalse(bonusLegsLookEligible(listOf(16000L,16000L,16000L,16000L),"3999",good))
        assertFalse(bonusLegsLookEligible(listOf(16000L,16000L,16000L,16000L),"4000",
            good.copy(status="expired")))
    }

    @Test fun parserKeepsCurrencyAndPromotionStatusServerAuthoritative() {
        val data = JSONObject()
            .put("promotion",JSONObject()
                .put("code","nova-100-deposit-bonus")
                .put("isActive",true)
                .put("percentageBps",10000))
            .put("summary",JSONObject()
                .put("total",1).put("active",1)
                .put("activeAmountMinor","4000"))
            .put("items", JSONArray().put(JSONObject()
                .put("id",grant().id)
                .put("amountMinor","4000")
                .put("remainingAmountMinor","4000")
                .put("status","active")
                .put("currency","USD")
                .put("expiresAt",grant().expiresAt)))
            .put("hasMore",false)
            .put("total",1)
            .put("page",1)
        val page=parseBonusCurrencyPage(data,"USD",1)
        assertEquals(10000,page.promotion?.percentageBps)
        assertTrue(page.promotion!!.active)
        assertEquals("USD",page.items.single().currency)
        assertEquals("4000",page.summary.activeAmountMinor)
        assertFalse(page.hasMore)
    }

    @Test fun bonusStatusLockedIsNotAvailableForNewBet() {
        assertTrue(grant().isActive)
        assertTrue(grant().copy(status="locked").isActive)
        assertFalse(grant().copy(status="won").isActive)
        assertFalse(bonusLegsLookEligible(listOf(16000L,17000L,18000L,19000L),
            "4000",grant().copy(status="locked")))
    }
}
