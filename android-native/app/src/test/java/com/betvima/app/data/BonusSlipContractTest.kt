package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class BonusSlipContractTest {
    private val now = Instant.parse("2026-10-15T12:00:00Z").toEpochMilli()
    private fun grant(
        currency: String = "USD", status: String = "active",
        expires: String = "2026-10-15T13:00:00Z"
    ) = BonusReward(
        id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        title="Deposit Bonus", description="", status=status,
        currency=currency, amountMinor="5000",remainingMinor="5000",
        grantedAt="2026-10-14T13:00:00Z",
        expiresAt=expires,usedAt="",betId=null,depositId="tx"
    )
    private fun picks(vararg prices: Long): List<Pick> = prices.mapIndexed { index, odds ->
        Pick(
            matchId="00000000-0000-4000-8000-%012d".format(index+1),
            marketId="10000000-0000-4000-8000-%012d".format(index+1),
            selectionId="20000000-0000-4000-8000-%012d".format(index+1),
            match="Match $index",market="1X2",selection="Home",
            oddsScaled=odds.toString(),version=4,live=false
        )
    }

    @Test fun enforcesExactlyFourDistinctMatches() {
        val valid=picks(16000,17000,18000,19000)
        assertNull(validateBonusSlip(valid,grant(),"USD",now))
        assertEquals("exact_four",validateBonusSlip(valid.dropLast(1),grant(),"USD",now))
        assertEquals("exact_four",validateBonusSlip(valid+valid.first(),grant(),"USD",now))
        assertEquals("exact_four",validateBonusSlip(
            valid.take(1)+valid.take(1)+valid.drop(2),grant(),"USD",now))
    }
    @Test fun rejectsOddsUnderOnePointSixAndExpiredOrWrongCurrency() {
        assertEquals("min_odds",validateBonusSlip(picks(15999,16000,16100,19000),grant(),"USD",now))
        assertEquals("bonus_expired",validateBonusSlip(picks(16000,17000,18000,19000),
            grant(expires="2026-10-15T11:59:59Z"),"USD",now))
        assertEquals("currency_mismatch",validateBonusSlip(picks(16000,17000,18000,19000),
            grant(currency="IRR"),"USD",now))
        assertEquals("bonus_not_active",validateBonusSlip(picks(16000,17000,18000,19000),
            grant(status="locked"),"USD",now))
    }
    @Test fun validatesServerQuoteAndChangedOddsBeforeFinancialPost() {
        val json=JSONObject().put("quoteToken","signed-quote-long-secret")
            .put("stakeMinor","5000").put("expiresAt","2026-10-15T12:05:00Z")
            .put("combinedOddsScaled","735000")
            .put("oddsChanges",JSONArray().put(JSONObject()
                .put("selectionId",picks(16000,17000,18000,19000)[0].selectionId)
                .put("previousOddsScaled","16000").put("currentOddsScaled","15999")
                .put("currentOddsVersion",7)))
        val review=parseBonusPlacementQuote(json,"USD")
        val pickList=picks(16000,17000,18000,19000)
        assertEquals("min_odds_or_invalid_change",
            validateBonusQuote(review,pickList,grant(),now))
        val healthy=review.copy(movements=listOf(review.movements[0].copy(currentScaled="17000")))
        assertNull(validateBonusQuote(healthy,pickList,grant(),now))
        assertEquals("stake_changed",validateBonusQuote(
            healthy.copy(stakeMinor="4000"),pickList,grant(),now))
        assertEquals("quote_expired",validateBonusQuote(
            healthy.copy(expiresAt="2026-10-15T11:00:00Z"),pickList,grant(),now))
    }
    @Test fun fingerprintsChangeWhenAnySelectionOrBonusBalanceChanges() {
        val first=picks(16000,17000,18000,19000)
        val key=bonusSlipIdentity(first,grant())
        assertNotEquals(key,bonusSlipIdentity(first,grant().copy(remainingMinor="4000")))
        assertNotEquals(key,bonusSlipIdentity(first.dropLast(1)+
            first.last().copy(oddsScaled="20000"),grant()))
    }
}
