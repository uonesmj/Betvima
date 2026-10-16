package com.betvima.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode

data class Team(val name: String, val role: String, val logo: String?)
data class Selection(val id: String, val name: String, val oddsScaled: String, val status: String,
    val version: Int, val movement: String, val nameFa: String = "") {
    // The server has used 'open' for DB selections and 'active' in its catalogue type.
    // Suspended, closed, void, and settled selections are never actionable.
    val available get() =
        (status == "open" || status == "active") &&
            (oddsScaled.toBigDecimalOrNull()?.let { it > BigDecimal("10000") } == true)
    fun label(persian: Boolean) = if (persian && nameFa.isNotBlank()) nameFa else name
}
data class Market(val id: String, val key: String, val name: String, val status: String,
    val selections: List<Selection>, val nameFa: String = "", val version: Int? = null) {
    val available get() = status == "open"
    fun label(persian: Boolean) = if (persian && nameFa.isNotBlank()) nameFa else name
}
data class Match(
    val id: String, val league: String, val leagueLogo: String?, val sport: String,
    val country: String, val starts: String, val live: Boolean, val bettingAvailable: Boolean,
    val minute: Int?, val homeScore: Int?, val awayScore: Int?,
    val teams: List<Team>, val markets: List<Market>, val marketsCount: Int
) {
    val home get() = teams.firstOrNull { it.role == "HOME" } ?: teams.firstOrNull() ?: Team("TBD", "HOME", null)
    val away get() = teams.firstOrNull { it.role == "AWAY" } ?: teams.getOrNull(1) ?: Team("TBD", "AWAY", null)
    val featured get() = markets.firstOrNull { it.key == "h2h" && it.selections.isNotEmpty() }
        ?: markets.firstOrNull { it.selections.isNotEmpty() }
    val title get() = home.name + " – " + away.name
}
data class Pick(
    val matchId: String, val marketId: String, val selectionId: String,
    val match: String, val market: String, val selection: String,
    val oddsScaled: String, val version: Int?, val live: Boolean
)
data class Bet(val id: String, val status: String, val type: String,
    val stakeMinor: String, val payoutMinor: String, val currency: String, val legs: Int,
    val settledPayoutMinor: String? = null, val netResultMinor: String? = null,
    val placedAt: String = "", val combinedOddsScaled: String = "0",
    val selections: List<BetLegDetail> = emptyList()) {
    val isSettled: Boolean get() = status.lowercase() in setOf(
        "settled", "void", "refunded", "cancelled", "cashed_out", "rejected")
}
data class BetLegDetail(val matchLabel: String, val marketLabel: String,
    val selectionLabel: String, val oddsScaled: String, val status: String,
    val league: String, val result: String,
    val matchId: String = "", val matchStatus: String = "", val scheduledAt: String = "",
    val minute: Int? = null, val clock: String = "", val period: String = "",
    val homeScore: Int? = null, val awayScore: Int? = null,
    val homeTeamName: String = "", val awayTeamName: String = "",
    val homeTeamLogoUrl: String = "", val awayTeamLogoUrl: String = "")
data class BetDetail(val id: String, val publicId: String, val status: String,
    val currency: String, val stakeMinor: String, val potentialPayoutMinor: String,
    val settledPayoutMinor: String?, val netResultMinor: String?,
    val placedAt: String, val settledAt: String?, val legs: List<BetLegDetail>)
data class Transaction(val id: String, val type: String, val amountMinor: String,
    val time: String, val direction: String = "", val status: String = "")
data class Wallet(val availableMinor: String, val balanceMinor: String,
    val heldMinor: String, val currency: String, val integrity: String,
    val transactions: List<Transaction>, val page: Int = 1, val hasMore: Boolean = false,
    val payments: List<WalletPaymentRecord> = emptyList())
data class BetPage(val items: List<Bet>, val page: Int, val hasMore: Boolean)
data class Bonus(val title: String, val status: String, val remainingMinor: String, val currency: String)

fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun JSONObject.str(key: String, fallback: String = ""): String =
    if (isNull(key)) fallback else optString(key).takeUnless { it == "null" } ?: fallback
fun JSONObject.arr(key: String): JSONArray = optJSONArray(key) ?: JSONArray()
fun JSONObject.numberOrNull(key: String): Int? = if (isNull(key)) null else optInt(key)
fun parseSelection(o: JSONObject) = Selection(o.str("id"), o.str("name", o.str("nameEn", o.str("code"))),
    o.str("oddsScaled", "0"), o.str("status", "suspended"),
    o.optInt("oddsVersion", o.optInt("version", 0)), o.str("movement", "STABLE"),
    nameFa = o.str("nameFa"))
fun parseMarket(o: JSONObject) = Market(o.str("id"), o.str("key"),
    o.str("name", o.str("nameEn", o.str("key"))), o.str("status", "suspended"),
    o.arr("selections").objects().map(::parseSelection), nameFa = o.str("nameFa"),
    version = if (o.has("version") && !o.isNull("version")) o.optInt("version") else null)
fun parseMatch(o: JSONObject, overrideMarkets: JSONArray? = null): Match = Match(
    id = o.str("id"), league = o.str("leagueName", "Football"),
    leagueLogo = o.str("leagueLogoUrl", o.str("leagueLogo")).takeIf(String::isNotBlank),
    sport = o.str("sportKey", "football"),
    country = o.str("countryCode", o.str("countryName", o.str("country"))),
    starts = o.str("scheduledAt"), live = o.optBoolean("isLive", false),
    bettingAvailable = o.optBoolean("isBettingAvailable", false),
    minute = o.numberOrNull("minute"), homeScore = o.numberOrNull("homeScore"),
    awayScore = o.numberOrNull("awayScore"),
    teams = o.arr("participants").objects().map {
        Team(it.str("name", "TBD"), it.str("role"),
            it.str("logoUrl", it.str("logo")).takeIf(String::isNotBlank))
    },
    markets = (overrideMarkets ?: o.optJSONArray("topMarkets") ?: o.optJSONArray("markets") ?: JSONArray())
        .objects().map(::parseMarket),
    marketsCount = o.optInt("marketsCount", 0)
)
fun odds(scaled: String): String = runCatching {
    BigDecimal(scaled).movePointLeft(4).setScale(2, RoundingMode.HALF_UP).toPlainString()
}.getOrDefault("—")
fun money(minor: String, currency: String = "USD"): String = runCatching {
    val fraction = if (currency in setOf("IRT", "IRR")) 0 else 2
    BigDecimal(minor).movePointLeft(fraction).setScale(fraction, RoundingMode.HALF_UP).toPlainString() + " " + currency
}.getOrDefault("—")

/** Inbox metadata is always server-provided; no synthetic campaign or player data. */
data class UserNotification(
    val id: String,
    val eventKey: String,
    val title: String,
    val body: String,
    val createdAt: String,
    val readAt: String?,
    val audience: String = "personal",
    val ctaLabel: String? = null,
    val ctaHref: String? = null
)
data class NotificationPage(
    val items: List<UserNotification>,
    val page: Int,
    val hasMore: Boolean,
    val unreadCount: Int = 0
)
data class SupportTicket(
    val id: String, val subject: String, val status: String, val category: String,
    val createdAt: String = "", val updatedAt: String = "", val lastMessageAt: String = "",
    val priority: String = "normal", val unreadMessages: Int = 0
)
data class SupportTicketPage(
    val items: List<SupportTicket>, val page: Int, val total: Int, val hasMore: Boolean
)
data class SupportThreadMessage(
    val id: String, val body: String, val senderRole: String, val createdAt: String,
    val attachments: List<String> = emptyList()
)
data class SupportConversation(
    val ticket: SupportTicket, val messages: List<SupportThreadMessage>
)

