package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject

private val betSlipSharePattern = Regex("^NOVA-[A-HJ-NP-Z2-9]{8}$")

fun normalizeBetSlipCode(input: String): String =
    input.trim().uppercase(java.util.Locale.ROOT)

fun validBetSlipCode(input: String): Boolean =
    betSlipSharePattern.matches(normalizeBetSlipCode(input))

fun shareSlipPayload(picks: List<Pick>, currency: String): JSONObject {
    require(currency in setOf("USD", "IRR", "IRT", "EUR", "GBP"))
    require(picks.size in 1..20)
    require(picks.map { it.matchId }.distinct().size == picks.size) {
        "Share slips can include only one pick per match"
    }
    val selections = JSONArray()
    picks.forEach {
        require(it.matchId.isNotBlank() && it.marketId.isNotBlank() &&
            it.selectionId.isNotBlank())
        selections.put(JSONObject()
            .put("matchId",it.matchId)
            .put("marketId",it.marketId)
            .put("selectionId",it.selectionId)
            .put("label",it.selection.take(300))
            .put("marketLabel",it.market.take(300))
            .put("matchLabel",it.match.take(500))
            .put("sportSlug","football")
            .put("oddsScaled",it.oddsScaled)
            .put("oddsVersionSeen",(it.version ?: 1).coerceAtLeast(0)))
    }
    return JSONObject()
        .put("type",if(picks.size==1)"SINGLE" else "MULTIPLE")
        .put("currency",currency)
        .put("selections",selections)
}

data class ImportedSlip(
    val code: String, val currency: String,
    val picks: List<Pick>, val unavailableCount: Int
)

/** Only accept live, currently open selections from the server's current snapshot. */
fun parseImportedSlip(data: JSONObject): ImportedSlip {
    val code = normalizeBetSlipCode(data.str("code"))
    require(validBetSlipCode(code))
    val currency = data.str("currency")
    require(currency in setOf("USD","IRR","IRT","EUR","GBP"))
    val unavailable = data.optInt("unavailableCount",0).coerceAtLeast(0)
    val seenMatches = mutableSetOf<String>()
    val available = data.arr("legs").objects().mapNotNull { leg ->
        if (!leg.optBoolean("available",false)) return@mapNotNull null
        val current = leg.optJSONObject("current") ?: return@mapNotNull null
        val matchId = current.str("matchId")
        val selectionId = current.str("selectionId")
        val marketId = current.str("marketId")
        val scaled = current.str("oddsScaled")
        val version = current.optInt("oddsVersion",-1)
        if (matchId.isBlank() || selectionId.isBlank() || marketId.isBlank() ||
            (scaled.toLongOrNull() ?: 0) <= 10_000L || version < 0 ||
            !seenMatches.add(matchId)) return@mapNotNull null
        Pick(matchId,marketId,selectionId,current.str("matchLabel"),
            current.str("marketLabel"),current.str("label"),scaled,
            version,current.optBoolean("isLive",false))
    }.take(20)
    return ImportedSlip(code,currency,available,unavailable)
}

fun betSlipShareFingerprint(picks: List<Pick>, currency: String): String =
    currency + "|" + picks.joinToString("~") {
        it.matchId + "/" + it.marketId + "/" + it.selectionId +
            "/" + it.oddsScaled + "/" + (it.version ?: -1)
    }
