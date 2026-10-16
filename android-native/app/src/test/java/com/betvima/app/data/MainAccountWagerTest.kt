package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class MainAccountWagerTest {
    private val pick = Pick(
        "88888888-8888-4888-8888-888888888888",
        "99999999-9999-4999-8999-999999999999",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "Fictional home - away", "Result", "Home",
        "33500", 1, true
    )
    private val now = Instant.parse("2026-10-17T12:00:00Z").toEpochMilli()
    private fun quote(expiry: String = "2026-10-17T12:00:50Z",
        minor: String = "500", currency: String = "USD"): JSONObject =
        JSONObject()
            .put("quoteToken", "signed-token-from-server-0123456789")
            .put("expiresAt", expiry)
            .put("stakeMinor", minor).put("currency", currency)
            .put("potentialPayoutMinor", "1675")
            .put("oddsChanges", JSONArray())

    @Test fun currencyAmountsDoNotMixMinorUnits() {
        assertEquals("500", mainBetStakeMinor("5.00", "USD"))
        assertEquals("10000", mainBetStakeMinor("10000", "IRR"))
        assertEquals("10000", mainBetStakeMinor("10000", "IRT"))
        listOf("USD", "IRR", "IRT").forEach { currency ->
            assertThrows(IllegalArgumentException::class.java) {
                mainBetStakeMinor("0", currency)
            }
        }
        assertThrows(ArithmeticException::class.java) {
            mainBetStakeMinor("10.75", "IRR")
        }
    }

    @Test fun signedQuoteRequiresSameStakeCurrencyAndExpiry() {
        val approved = parseMainBetReview(quote(), "500", "USD", listOf(pick), 3, now)
        assertTrue(canConfirmMainBet(approved, listOf(pick), "500", "USD", 3, now))
        assertFalse(canConfirmMainBet(approved, listOf(pick), "501", "USD", 3, now))
        assertFalse(canConfirmMainBet(approved, listOf(pick.copy(oddsScaled="33000")),
            "500", "USD", 3, now))
        assertFalse(canConfirmMainBet(approved, listOf(pick), "500", "USD", 4, now))
        assertFalse(canConfirmMainBet(approved, listOf(pick), "500", "USD", 3, now + 51000))
        assertThrows(IllegalArgumentException::class.java) {
            parseMainBetReview(quote(minor="501"), "500", "USD", listOf(pick), 3, now)
        }
        assertThrows(IllegalArgumentException::class.java) {
            parseMainBetReview(quote(currency="IRR"), "500", "USD", listOf(pick), 3, now)
        }
    }

    @Test fun movedOddsRequireExplicitReviewAndAreSelectionBound() {
        val changes=JSONArray().put(JSONObject()
            .put("selectionId",pick.selectionId)
            .put("previousOddsScaled","33500")
            .put("currentOddsScaled","32000"))
        val payload=quote().put("oddsChanges",changes)
        val review=parseMainBetReview(payload,"500","USD",listOf(pick),5,now)
        assertEquals("32000",review.changes.first().afterScaled)
        assertEquals(pick.selectionId,review.changes.first().selectionId)
        val forged=quote().put("oddsChanges",JSONArray().put(JSONObject()
            .put("selectionId","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
            .put("previousOddsScaled","33500")
            .put("currentOddsScaled","32000")))
        assertThrows(IllegalArgumentException::class.java) {
            parseMainBetReview(forged,"500","USD",listOf(pick),5,now)
        }
    }
}
