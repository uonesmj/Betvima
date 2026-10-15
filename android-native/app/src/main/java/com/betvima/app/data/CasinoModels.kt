package com.betvima.app.data

import org.json.JSONObject

/** Provider-supplied catalogue entries. No bundled or fabricated casino titles. */
data class CasinoGame(
    val id: String,
    val name: String,
    val category: String,
    val provider: String,
    val providerName: String,
    val imageUrl: String?,
    val demoSupported: Boolean
)

data class CasinoPage(
    val games: List<CasinoGame>,
    val total: Int,
    val page: Int,
    val pageSize: Int
) {
    val hasMore: Boolean get() = page.toLong() * pageSize.toLong() < total.toLong()
}

/** Only the backend-provided, correctly shaped data can appear as a playable card. */
fun parseCasinoPage(json: JSONObject): CasinoPage {
    val items = json.optJSONArray("items")
    val games = buildList {
        if (items != null) for (index in 0 until items.length()) {
            val item = items.optJSONObject(index) ?: continue
            val id = item.optString("id").trim()
            val title = item.optString("name").trim()
            val category = item.optString("category").trim().lowercase()
            val provider = item.optString("provider").trim()
            if (id.isBlank() || title.isBlank() || category.isBlank() || provider.isBlank()) continue
            val image = item.optString("image").trim().takeIf { it.startsWith("https://") }
            add(CasinoGame(
                id = id, name = title, category = category, provider = provider,
                providerName = item.optString("providerName", provider).ifBlank { provider },
                imageUrl = image, demoSupported = item.optBoolean("demoSupported", false)
            ))
        }
    }
    return CasinoPage(games, json.optInt("total").coerceAtLeast(0),
        json.optInt("page", 1).coerceAtLeast(1),
        json.optInt("limit", 40).coerceIn(1, 100))
}

fun casinoCategoryLabel(category: String, persian: Boolean): String =
    when (category) {
        "slots" -> if (persian) "اسلات" else "Slots"
        "live" -> if (persian) "کازینو زنده" else "Live Casino"
        "crash" -> if (persian) "کراش" else "Crash"
        "table" -> if (persian) "بازی‌های رومیزی" else "Table Games"
        "instant" -> if (persian) "بازی‌های فوری" else "Instant"
        "bingo" -> if (persian) "بینگو" else "Bingo"
        "keno" -> if (persian) "کینو" else "Keno"
        "fishing" -> if (persian) "ماهیگیری" else "Fishing"
        "virtual" -> if (persian) "مجازی" else "Virtual"
        "sportsbook" -> if (persian) "پیش‌بینی ورزشی" else "Sportsbook"
        "other" -> if (persian) "سایر بازی‌ها" else "Other"
        else -> if (persian) "همه بازی‌ها" else "All games"
    }
