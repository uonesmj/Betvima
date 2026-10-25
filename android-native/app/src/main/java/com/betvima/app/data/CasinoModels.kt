package com.betvima.app.data

import org.json.JSONObject

/**
 * Pilot permission and balance are always returned by BetVima's authenticated
 * backend, not inferred from a client-side build flag or preferred display text.
 * USD cents are strings to avoid floating-point or JSON integer precision loss.
 */
data class CasinoEligibility(
    val realMoneyEnabled: Boolean,
    val walletCurrency: String,
    val availableUsdMinor: String,
    val minStakeUsdMinor: String
) {
    val displayedUsd: String get() = formatCasinoUsd(availableUsdMinor)
    val displayedMinimumUsd: String get() = formatCasinoUsd(minStakeUsdMinor)
}

private val casinoMinorPattern = Regex("[0-9]{1,16}")

/** Display-only conversion. No currency conversion or wagering is performed on-device. */
private fun formatCasinoUsd(minor: String): String {
    val cents = minor.toLongOrNull()?.coerceAtLeast(0L) ?: 0L
    return (cents / 100L).toString() + "." +
        (cents % 100L).toString().padStart(2, '0')
}

/**
 * Malformed server eligibility must never make the native app show Play USD.
 * The server independently enforces its allowlist and audited financial gates.
 */
fun parseCasinoEligibility(json: JSONObject): CasinoEligibility {
    val currency = json.optString("walletCurrency", "").takeIf {
        it in setOf("USD", "IRT", "IRR")
    }
    val balance = json.optString("availableUsdMinor", "").takeIf {
        it.matches(casinoMinorPattern) && it.toLongOrNull() != null
    }
    val minimum = json.optString("minStakeUsdMinor", "").takeIf {
        it.matches(casinoMinorPattern) && (it.toLongOrNull() ?: 0L) >= 10L
    }
    return CasinoEligibility(
        realMoneyEnabled = json.optBoolean("realMoneyEnabled", false) &&
            currency != null && balance != null && minimum != null,
        walletCurrency = currency ?: "USD",
        availableUsdMinor = balance ?: "0",
        minStakeUsdMinor = minimum ?: "20"
    )
}

/** Provider-supplied catalogue entries. No bundled or fabricated casino titles. */
data class CasinoGame(
    val id: String,
    val name: String,
    val category: String,
    val provider: String,
    val providerName: String,
    val imageUrl: String?,
    val demoSupported: Boolean
) {
    // SoftAggregator explicitly confirms some playable demos have a false
    // catalogue flag; the backend safely tries getGameDemo, never getGame.
    val canTryDemo: Boolean get() = id.isNotBlank()
}

data class CasinoPage(
    val games: List<CasinoGame>,
    val total: Int,
    val page: Int,
    val pageSize: Int,
    val providers: List<String> = emptyList()
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
    val options = json.optJSONArray("providers")
    val providers = buildList {
        if (options != null) for (index in 0 until options.length()) {
            val name = (options.opt(index) as? String)?.trim() ?: continue
            if (name.length in 1..80) add(name)
        }
    }.distinct()
    return CasinoPage(games, json.optInt("total").coerceAtLeast(0),
        json.optInt("page", 1).coerceAtLeast(1),
        json.optInt("limit", 40).coerceIn(1, 100), providers)
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

/**
 * Casino live/slot titles are not all available as free demos.
 * Never claim that a failed demo is a real-money wallet issue or offer a
 * wagering fallback while wallet callbacks are disabled.
 */
fun casinoDemoFailure(code: Int?, confirmedDemo: Boolean, persian: Boolean,
    serverCode: String? = null): String =
    if (serverCode == "CASINO_DEMO_UNAVAILABLE") {
        if (persian)
            "این بازی در حال حاضر دموی قابل اجرا ندارد. بازی با پول واقعی شروع نشده است. می‌توانید دموی Aviator را امتحان کنید."
        else "This game has no available demo session right now. No real-money game was started. Try the confirmed Aviator demo."
    } else when (code) {
        401, 403 -> if (persian)
            "برای اجرای بازی آزمایشی دوباره وارد حساب کاربری شوید."
        else "Please sign in again to start this demo."
        422 -> if (persian)
            "سرویس‌دهنده، اجرای دموی این بازی را نپذیرفت. هیچ مبلغی از کیف پول کسر نشده است. عنوان دیگری را امتحان کنید؛ این درخواست به بازی با پول واقعی تبدیل نمی‌شود."
        else "The provider rejected this title's demo. No wallet funds were charged. Try another game; this request never switches to real-money play."
        404 -> if (persian)
            "این عنوان دیگر در فهرست بازی‌های سرویس‌دهنده موجود نیست. فهرست را به‌روزرسانی کنید."
        else "This title is no longer in the provider catalogue. Refresh the game list."
        429 -> if (persian)
            "درخواست‌های زیادی ارسال شده است؛ کمی بعد دوباره تلاش کنید."
        else "Too many requests. Please retry in a moment."
        502, 503, 504 -> if (persian)
            "ارتباط با سرویس‌دهنده بازی موقتاً برقرار نیست. کمی بعد دوباره تلاش کنید؛ هیچ شرط پولی ارسال نشده است."
        else "The game provider is temporarily unavailable. Retry later; no real-money wager was submitted."
        else -> if (confirmedDemo) {
            if (persian)
                "اجرای دموی تأییدشده ناموفق بود؛ ممکن است مشکل موقت اتصال یا سرویس‌دهنده باشد. دوباره تلاش کنید. اگر ادامه داشت، کد خطا را گزارش دهید."
            else "This verified demo failed to launch. It may be a temporary connection or provider error. Please retry and report the error code if it persists."
        } else {
            if (persian)
                "درخواست اجرای این بازی ناموفق بود. ممکن است این عنوان دمو نداشته باشد یا سرویس‌دهنده موقتاً در دسترس نباشد. بازی با پول واقعی غیرفعال است؛ برای مقایسه، دموی تأییدشده Aviator را امتحان کنید."
            else "This demo launch failed. This title might not support demo, or the provider may be temporarily unavailable. Real-money play is disabled. Try the verified Aviator demo to compare."
        }
    }
