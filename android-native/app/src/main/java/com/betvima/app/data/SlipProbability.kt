package com.betvima.app.data

import org.json.JSONObject
import kotlin.math.floor

/**
 * Display-only market-implied estimates. These values must never be used to
 * price a bet, change customer balances, authorize a stake, or settle a ticket.
 */
data class SlipOddsSelection(
    val id: String, val code: String, val name: String,
    val oddsScaled: String, val status: String
)
data class SlipOddsMarket(
    val id: String, val key: String, val status: String,
    val specifier: String, val isLive: Boolean?,
    val selections: List<SlipOddsSelection>
)
data class SlipOddsMatch(
    val matchId: String, val status: String, val minute: Int?,
    val markets: List<SlipOddsMarket>
)
data class SlipOutcome(val win: Double, val lose: Double, val refund: Double, val live: Boolean)
data class SlipOutcomePercent(val win: Int, val lose: Int, val refund: Int)

fun parseSlipOddsMatch(payload: JSONObject): SlipOddsMatch = SlipOddsMatch(
    matchId = payload.str("matchId"),
    status = payload.str("status"),
    minute = payload.numberOrNull("minute"),
    markets = payload.arr("markets").objects().map { m ->
        SlipOddsMarket(
            id = m.str("id"), key = m.str("key"), status = m.str("status"),
            specifier = m.str("specifier"),
            isLive = if (m.has("isLive") && !m.isNull("isLive")) m.optBoolean("isLive") else null,
            selections = m.arr("selections").objects().map { s ->
                SlipOddsSelection(
                    id = s.str("id"), code = s.str("code"), name = s.str("name"),
                    oddsScaled = s.str("oddsScaled"), status = s.str("status")
                )
            }
        )
    }
)

private fun slipOpen(value: String): Boolean =
    value.equals("open", true) || value.equals("active", true)

private fun slipKey(value: String) = value.uppercase().replace(Regex("[^A-Z0-9]+"), "_")

private fun slipDraw(s: SlipOddsSelection): Boolean =
    slipKey(s.code) in setOf("DRAW", "X") ||
        s.name.trim().lowercase() in setOf("draw", "tie", "مساوی")

private fun slipFair(market: SlipOddsMarket): Map<String, Double>? {
    if (!slipOpen(market.status) || market.selections.size !in 2..3 ||
        market.selections.any { !slipOpen(it.status) }) return null
    val odds = market.selections.map {
        (it.oddsScaled.toDoubleOrNull() ?: return null) / 10000.0
    }
    if (odds.any { !it.isFinite() || it <= 1.0 || it > 100000.0 }) return null
    val raw = odds.map { 1.0 / it }
    val total = raw.sum()
    if (total <= 0.0) return null
    return market.selections.mapIndexed { index, s -> s.id to raw[index] / total }.toMap()
}

private fun slipHalfPoint(market: SlipOddsMarket): Boolean {
    val words = (listOf(market.specifier) + market.selections.map { it.name }).joinToString(" ")
    return Regex("""(^|[^0-9])\d+\.5([^0-9]|$)""").containsMatchIn(words) &&
        !Regex("""(^|[^0-9])\d+\.(0|25|75)([^0-9]|$)""").containsMatchIn(words)
}

private fun slipSingle(pick: Pick, match: SlipOddsMatch): SlipOutcome? {
    val market = match.markets.firstOrNull { it.id == pick.marketId } ?: return null
    val selection = market.selections.firstOrNull { it.id == pick.selectionId } ?: return null
    val probabilities = slipFair(market) ?: return null
    val win = probabilities[selection.id] ?: return null
    val key = slipKey(market.key)
    val live = match.status.equals("live", true) && market.isLive != false

    if (key in setOf("DRAW_NO_BET", "DNB")) {
        // Drawing returns the stake only in this specific settlement market.
        // Never take the draw from a different match or mixed market phase.
        val candidates = match.markets.filter {
            it.id != market.id && slipKey(it.key) in setOf("1X2", "H2H") &&
                it.selections.size == 3 && it.selections.any(::slipDraw)
        }
        val reference = candidates.singleOrNull {
            market.isLive != null && it.isLive == market.isLive
        } ?: candidates.singleOrNull() ?: return null
        val referencePrices = slipFair(reference) ?: return null
        val draw = reference.selections.firstOrNull(::slipDraw) ?: return null
        val choice = reference.selections.firstOrNull {
            !slipDraw(it) &&
                ((selection.code.isNotBlank() && slipKey(selection.code) == slipKey(it.code)) ||
                    (selection.name.isNotBlank() && selection.name.equals(it.name, true)))
        } ?: return null
        val selected = referencePrices[choice.id] ?: return null
        val returnChance = referencePrices[draw.id] ?: return null
        return SlipOutcome(selected, (1.0 - selected - returnChance).coerceAtLeast(0.0),
            returnChance, live)
    }

    val noPush =
        (key in setOf("1X2", "H2H") &&
            (market.selections.size == 2 ||
                (market.selections.size == 3 && market.selections.any(::slipDraw)))) ||
        (key in setOf("BTTS", "BOTH_TEAMS_TO_SCORE") && market.selections.size == 2) ||
        (key in setOf("TOTALS", "OVER_UNDER", "SPREADS", "HANDICAP") &&
            market.selections.size == 2 && slipHalfPoint(market))
    if (!noPush) return null
    return SlipOutcome(win, 1.0 - win, 0.0, live)
}

/**
 * Accumulator logic with void legs priced at 1:
 * all legs win-or-void and at least one wins = WIN,
 * all legs void = full REFUND, any losing leg = LOSS.
 * Independence across matches is a simplifying assumption, not forecasting.
 */
fun estimateSlipOutcome(
    picks: List<Pick>, snapshots: Map<String, SlipOddsMatch>
): SlipOutcome? {
    if (picks.isEmpty()) return null
    var noLoss = 1.0
    var allRefund = 1.0
    var live = false
    for (pick in picks) {
        val match = snapshots[pick.matchId] ?: return null
        if (match.status.lowercase() in setOf(
                "finished", "cancelled", "abandoned", "postponed", "interrupted"
            )) return null
        val single = slipSingle(pick, match) ?: return null
        noLoss *= single.win + single.refund
        allRefund *= single.refund
        live = live || single.live
    }
    val refund = allRefund.coerceIn(0.0, 1.0)
    val win = (noLoss - refund).coerceIn(0.0, 1.0)
    return SlipOutcome(win, (1.0 - win - refund).coerceAtLeast(0.0), refund, live)
}

fun slipOutcomePercents(model: SlipOutcome): SlipOutcomePercent {
    val exact = listOf(model.win, model.lose, model.refund).map {
        (it * 100.0).coerceIn(0.0, 100.0)
    }
    val values = exact.map { floor(it).toInt() }.toMutableList()
    val remainder = (100 - values.sum()).coerceIn(0, 3)
    val priorities = exact.indices.sortedByDescending { exact[it] - floor(exact[it]) }
    repeat(remainder) { values[priorities[it % priorities.size]]++ }
    return SlipOutcomePercent(values[0], values[1], values[2])
}
