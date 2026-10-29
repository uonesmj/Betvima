package com.betvima.app.ui

/** Only public catalogue reads; server remains authoritative for game availability. */
internal data class CasinoLoadPlan216(val categories: List<String>, val pages: Int)

internal fun casinoLoadPlan216(
    category: String, provider: String, query: String, expanded: Boolean
): CasinoLoadPlan216 {
    if (provider.isNotBlank() || query.isNotBlank()) return CasinoLoadPlan216(emptyList(), 0)
    val types = when (category) {
        "live" -> listOf("live")
        "crash", "instant" -> listOf("crash", "instant")
        "" -> if (expanded) listOf("slots", "live", "instant", "crash", "table")
              else listOf("slots", "live")
        else -> emptyList()
    }
    val pages = if (expanded) when (category) {
        "live" -> 4
        "crash", "instant" -> 3
        else -> 1
    } else 1
    return CasinoLoadPlan216(types, pages)
}
