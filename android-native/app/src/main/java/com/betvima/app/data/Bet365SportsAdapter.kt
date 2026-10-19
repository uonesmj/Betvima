package com.betvima.app.data

import java.math.BigDecimal
import java.math.RoundingMode
import org.json.JSONObject

/**
 * Conversion between public, READ-ONLY BetVima BetsAPI responses and the unchanged
 * native Android Match/Market models. Provider identifiers are deliberately never
 * accepted as internal wager identifiers. No token is bundled in the APK.
 */
internal const val BET365_SOURCE = "betsapi_bet365"
internal val bet365FixturePattern = Regex("^betsapi:(live|upcoming):([0-9]{1,4}):([0-9]{1,16})$")
internal val bet365PrimarySports = listOf(
    "football", "basketball", "tennis", "volleyball", "ice-hockey", "cricket", "handball"
)
/** Cover the existing native Live category ribbon without altering one UI chip. */
internal val bet365LiveSports = bet365PrimarySports + listOf(
    "baseball", "american-football", "table-tennis", "esports", "mma", "boxing"
)
private val bet365AvailableSports = setOf(
    "football", "basketball", "tennis", "volleyball", "ice-hockey", "cricket", "handball",
    "baseball", "american-football", "table-tennis", "darts", "snooker", "futsal",
    "badminton", "rugby-union", "rugby-league", "australian-rules", "floorball",
    "beach-volleyball", "water-polo", "squash", "esports", "mma", "boxing",
    "horse-racing", "greyhounds", "bowls", "gaelic-sports"
)

/** Keep UI sport identifiers unchanged; normalize only the upstream query. */
internal fun betsApiSport(sport: String): String? {
    val key = if (sport == "hockey") "ice-hockey" else sport
    return key.takeIf { key in bet365AvailableSports }
}

internal fun bet365CataloguePath(mode: String, sport: String, page: Int = 1): String {
    require(mode == "live" || mode == "upcoming")
    val sourceSport = betsApiSport(sport) ?: error("Unsupported Bet365 sport")
    require(page in 1..100)
    return "/api/v1/betsapi/catalogue?mode=$mode&sport=$sourceSport&page=$page"
}

internal data class Bet365Ref(val mode: String, val sportId: String, val fi: String)

internal fun bet365Ref(id: String): Bet365Ref? {
    val m = bet365FixturePattern.matchEntire(id) ?: return null
    return Bet365Ref(m.groupValues[1], m.groupValues[2], m.groupValues[3])
}

internal fun bet365PricesPath(ref: Bet365Ref, headline: Boolean = false): String =
    "/api/v1/betsapi/" + (if (headline) "card-prices" else "market-refresh") +
        "?mode=${ref.mode}&sportId=${ref.sportId}&fi=${ref.fi}"

/**
 * Fail closed when a gateway, cache or deployment unexpectedly switches source.
 * This prevents restoring retired Odds API games from legacy endpoints.
 */
internal fun parseBet365Catalogue(data: JSONObject): List<Match> {
    if (data.str("source") != BET365_SOURCE || data.str("error").isNotBlank())
        throw ApiFailure(503, "Bet365 fixture feed unavailable")
    return data.arr("matches").objects().mapNotNull { json ->
        val id = json.str("id")
        if (bet365Ref(id) == null) return@mapNotNull null
        parseMatch(json).copy(bettingAvailable = false)
    }
}

private fun scaledQuote(decimal: String): String? = runCatching {
    val value = BigDecimal(decimal)
    if (value <= BigDecimal.ONE || value > BigDecimal("100000")) null
    else value.movePointRight(4).setScale(0, RoundingMode.HALF_UP).toPlainString()
}.getOrNull()

/**
 * Model.status is suspended even for priced offers. A quoted outcome in the
 * external provider is NOT a tradable selection in BetVima's local ledger.
 * UI components still render the decimal price but cannot activate bet buttons.
 */
internal fun parseBet365Market(raw: JSONObject, fixtureId: String, position: Int,
    displayOnlyIdentity: Boolean = false): Market? {
    val title = raw.str("title", raw.str("name"))
    if (title.isBlank() || title.length > 180 || !fixtureId.startsWith("betsapi:")) return null
    val key = raw.str("key", "market_$position").take(70)
        .replace(Regex("[^a-zA-Z0-9_-]"), "_")
    val selections = raw.arr("selections").objects().take(100).mapIndexedNotNull { index, selection ->
        // Headline endpoint intentionally omits vendor selection ids.
        // Invent ONLY an unmistakably non-wagerable display identity, and
        // only in this path. Full detail must retain actual bookmaker id.
        val id = selection.str("id").ifBlank {
            if (displayOnlyIdentity) "display-index-$index" else ""
        }
        val label = selection.str("label", selection.str("name"))
        val quote = scaledQuote(selection.str("decimal"))
        if (id.isBlank() || id.length > 100 || label.isBlank() ||
            label.contains("Unlabelled outcome", true) || quote == null) null
        else Selection(
            id = "bet365-preview:${fixtureId}:${key}:$id",
            name = label.take(180),
            oddsScaled = quote,
            status = "suspended",
            version = 0,
            movement = "STABLE"
        )
    }
    if (selections.isEmpty()) return null
    return Market(
        id = "bet365-preview:${fixtureId}:$key",
        key = if (Regex("^(full ?time result|match result|1x2|match winner)$", RegexOption.IGNORE_CASE)
                .matches(title)) "h2h" else "bet365_preview_$key",
        name = title, status = "suspended", selections = selections
    )
}

internal fun withBet365Headline(match: Match, data: JSONObject): Match {
    if (data.str("source") != BET365_SOURCE || data.str("error").isNotBlank())
        return match.copy(bettingAvailable = false)
    val raw = data.optJSONObject("market") ?: return match.copy(bettingAvailable = false)
    val marketJson = JSONObject().put("key", "headline")
        .put("title", raw.str("name")).put("selections", raw.arr("selections"))
    val market = parseBet365Market(marketJson, match.id, 0, displayOnlyIdentity = true)
    return match.copy(
        markets = if (market != null) listOf(market) else emptyList(),
        marketsCount = data.optInt("marketCount", 0).coerceAtLeast(0),
        bettingAvailable = false
    )
}

internal fun withBet365Details(match: Match, data: JSONObject): Match {
    if (data.str("source") != BET365_SOURCE || data.str("error").isNotBlank())
        throw ApiFailure(503, "Bet365 match markets unavailable")
    val markets = data.arr("markets").objects().take(100)
        .mapIndexedNotNull { index, raw -> parseBet365Market(raw, match.id, index) }
    return match.copy(
        markets = markets,
        marketsCount = data.optInt("marketCount", markets.size).coerceAtLeast(markets.size),
        bettingAvailable = false
    )
}

/** Live clock is a factual provider field, never inferred from odds or kickoff. */
internal fun withBet365MatchMinute(match: Match, facts: JSONObject?): Match {
    if (facts == null || !match.live || bet365Ref(match.id) == null) return match
    val raw = facts.opt("minute")
    val minute = when (raw) {
        is Number -> raw.toInt().takeIf { raw.toDouble() == it.toDouble() }
        is String -> raw.toIntOrNull()
        else -> null
    }?.takeIf { it in 0..200 }
    return if (minute != null) match.copy(minute = minute, bettingAvailable = false)
    else match.copy(bettingAvailable = false)
}
