package com.betvima.app.data

import org.json.JSONObject

/** Real match facts only. No market IDs, bookmaker odds or financial state. */
data class LiveStat(
    val key: String, val en: String, val fa: String,
    val home: Int?, val away: Int?
)
data class LiveMatchFacts(
    val fi: String, val minute: Int?, val clockSeconds: Int?,
    val clockRunning: Boolean, val score: String?,
    val stats: List<LiveStat>, val observedAt: String,
    val error: String? = null
) {
    fun stat(key: String) = stats.firstOrNull { it.key == key }
}
fun parseBet365LiveFacts(json: JSONObject): LiveMatchFacts {
    val fi = json.str("fi")
    require(fi.matches(Regex("[0-9]{1,16}")))
    val minute = json.opt("minute").let {
        when(it) {
            is Number -> it.toInt().takeIf { n -> it.toDouble() == n.toDouble() }
            is String -> it.toIntOrNull()
            else -> null
        }
    }?.takeIf { it in 0..200 }
    val seconds = json.opt("clockSeconds").let {
        when(it) {
            is Number -> it.toInt().takeIf { n -> it.toDouble() == n.toDouble() }
            is String -> it.toIntOrNull()
            else -> null
        }
    }?.takeIf { it in 0..12_000 }
    val rows = json.arr("stats").objects().take(30).mapNotNull { row ->
        val key = row.str("key")
        if (!key.matches(Regex("[a-z_]{3,35}"))) return@mapNotNull null
        val home = row.opt("home").let { if(it is Number && it.toInt() in 0..100_000) it.toInt() else null }
        val away = row.opt("away").let { if(it is Number && it.toInt() in 0..100_000) it.toInt() else null }
        if (home == null && away == null) return@mapNotNull null
        LiveStat(key, row.str("en").take(70), row.str("fa").take(70), home, away)
    }
    return LiveMatchFacts(
        fi = fi, minute = minute, clockSeconds = seconds,
        clockRunning = seconds != null && json.optBoolean("clockRunning", false),
        score = json.str("score").takeIf { it.matches(Regex("[0-9]{1,3}-[0-9]{1,3}")) },
        stats = rows, observedAt = json.str("updatedAt"),
        error = json.str("error").ifBlank { null }
    )
}
