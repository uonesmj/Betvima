package com.betvima.app.ui

import com.betvima.app.data.UserNotification
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** In-app notices expire exactly 24h after their server-created timestamp. */
const val NOTIFICATION_VISIBLE_HOURS = 24L

fun notificationStillVisible(createdAt: String, nowMillis: Long): Boolean =
    try {
        Instant.parse(createdAt).toEpochMilli() > nowMillis - NOTIFICATION_VISIBLE_HOURS * 3_600_000L
    } catch (_: Exception) {
        false
    }

/** Never infer general announcements from their title or fabricated examples. */
enum class NotificationCategory { ALL, PERSONAL, GENERAL }

fun notificationMatchesCategory(note: UserNotification, category: NotificationCategory): Boolean =
    when (category) {
        NotificationCategory.ALL -> true
        NotificationCategory.PERSONAL -> note.audience != "general"
        NotificationCategory.GENERAL -> note.audience == "general"
    }

/**
 * Only internal, explicitly supported app destinations may be followed.
 * An arbitrary URL, custom URI scheme or unrecognized route is never launched.
 */
enum class NotificationDestination { BONUSES, WALLET, CASINO, SPORTS, BETS, SUPPORT, VIP, AFFILIATE, PROFILE }

fun notificationDestination(path: String?): NotificationDestination? {
    val value = path?.trim()?.takeIf { it.length in 2..240 } ?: return null
    if (!value.startsWith("/") || value.startsWith("//") || value.contains('\\')
        || value.contains('#') || value.contains('%') || value.contains("..")) return null
    val pathname = value.substringBefore('?').trimEnd('/').lowercase(Locale.ROOT)
    return when (pathname) {
        "/bonuses", "/bonus" -> NotificationDestination.BONUSES
        "/wallet" -> NotificationDestination.WALLET
        "/casino" -> NotificationDestination.CASINO
        "/sports", "/betting" -> NotificationDestination.SPORTS
        "/my-bets", "/bets" -> NotificationDestination.BETS
        "/support" -> NotificationDestination.SUPPORT
        "/vip" -> NotificationDestination.VIP
        "/affiliate" -> NotificationDestination.AFFILIATE
        "/profile" -> NotificationDestination.PROFILE
        else -> null
    }
}

fun notificationDisplayDate(date: String, language: Lang): String {
    return try {
        val locale = if (language == Lang.FA) Locale.forLanguageTag("fa-IR") else Locale.UK
        DateTimeFormatter.ofPattern("dd/MM/yyyy", locale)
            .withZone(ZoneId.systemDefault()).format(Instant.parse(date))
    } catch (_: Exception) {
        date.take(10)
    }
}

/** Only an authenticated, owned UUID may become a direct support destination. */
fun validSupportNotificationTicketId(value: String): Boolean =
    Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        .matches(value)

/** Reject non-BetVima URLs, extra query fields, fragments and malformed IDs. */
fun supportTicketFromNotificationHref(href: String?): String? {
    if (notificationDestination(href) != NotificationDestination.SUPPORT) return null
    val value = href?.trim() ?: return null
    val query = value.substringAfter('?', "")
    if (!query.startsWith("ticket=")) return null
    val id = query.removePrefix("ticket=")
    return id.takeIf(::validSupportNotificationTicketId)
}
