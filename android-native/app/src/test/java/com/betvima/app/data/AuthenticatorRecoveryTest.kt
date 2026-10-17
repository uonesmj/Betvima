package com.betvima.app.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AuthenticatorRecoveryTest {
    private val primary = "11111111-1111-4111-8111-111111111111"
    private val backup = "22222222-2222-4222-8222-222222222222"

    @Test fun onlyVerifiedTotpFactorMayAuthorizeLogin() {
        val factors = parseTotpFactors(JSONObject("""
          {"factors":[
            {"id":"$primary","factor_type":"totp","status":"verified",
             "friendly_name":"BetVima Authenticator"},
            {"id":"$backup","factor_type":"totp","status":"unverified",
             "friendly_name":"BetVima Backup Authenticator"},
            {"id":"33333333-3333-4333-8333-333333333333",
             "factor_type":"phone","status":"verified"},
            {"id":"wrong","factor_type":"totp","status":"verified"}]}
        """.trimIndent()))
        assertEquals(2, factors.size)
        assertEquals(listOf(primary), factors.filter { it.verified }.map { it.id })
        assertTrue(factors.any { !it.verified && it.name == "BetVima Backup Authenticator" })
    }

    @Test fun verifiedBackupHasIndependentIdentityAndCanBeUsedToSignIn() {
        val factors = parseTotpFactors(JSONObject("""
          {"factors":[
            {"id":"$primary","factor_type":"totp","status":"verified",
             "friendly_name":"BetVima Authenticator"},
            {"id":"$backup","factor_type":"totp","status":"verified",
             "friendly_name":"BetVima Backup Authenticator"}]}
        """.trimIndent()))
        assertEquals(setOf(primary, backup), factors.filter { it.verified }.map { it.id }.toSet())
        assertEquals("BetVima Backup Authenticator", factors.first { it.id == backup }.name)
    }

    @Test fun absentFactorsNeverCreateAFakeRecoveryMethod() {
        assertTrue(parseTotpFactors(JSONObject()).isEmpty())
        assertTrue(parseTotpFactors(JSONObject("""{"factors":[]}""")).isEmpty())
    }
}
