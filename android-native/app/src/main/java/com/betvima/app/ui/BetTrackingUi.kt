package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Bet
import com.betvima.app.data.BetLegDetail
import com.betvima.app.data.Match
import com.betvima.app.data.odds

private val ticketInk = Color(0xFF16252F)
private val ticketMuted = Color(0xFF73818F)
private val ticketBorder = Color(0xFFE2E8EE)
private val ticketSurface = Color(0xFFF5F8FB)

/** The settlement ledger, not a match score, decides whether money was won. */
internal fun ticketResult(bet: Bet, lang: Lang): String {
    val status = bet.status.lowercase()
    if (status in setOf("void", "refunded", "cancelled"))
        return tr(lang, "Refund / void", "باطل / برگشت وجه")
    if (status == "cashed_out") return tr(lang, "Cash out", "تسویه زودهنگام")
    if (status == "rejected") return tr(lang, "Rejected", "ردشده")
    if (status != "settled") return betStatus(bet.status, lang)
    return when (bet.netResultMinor?.toBigDecimalOrNull()?.signum()) {
        1 -> tr(lang, "Won", "برد")
        -1 -> tr(lang, "Lost", "باخت")
        0 -> tr(lang, "Stake returned", "بازگشت مبلغ")
        else -> tr(lang, "Settled", "تسویه‌شده")
    }
}

internal fun ticketResultColor(bet: Bet): Color = when (bet.status.lowercase()) {
    "settled" -> when (bet.netResultMinor?.toBigDecimalOrNull()?.signum()) {
        1 -> Palette.green; -1 -> Palette.red; else -> Palette.blue
    }
    "rejected" -> Palette.red
    "void", "cancelled", "refunded" -> Palette.blue
    else -> Palette.blue
}

internal fun legResultLabel(raw: String, lang: Lang): String = when(raw.uppercase()) {
    "WON" -> tr(lang,"Won","برد")
    "LOST" -> tr(lang,"Lost","باخت")
    "VOID" -> tr(lang,"Void","باطل")
    "REFUNDED" -> tr(lang,"Refunded","برگشتی")
    "HALF_WON" -> tr(lang,"Half won","نیم‌برد")
    "HALF_LOST" -> tr(lang,"Half lost","نیم‌باخت")
    "PENDING", "OPEN", "ACCEPTED", "" -> tr(lang,"Pending","در انتظار")
    "MANUAL_REVIEW", "PENDING_REVIEW" -> tr(lang,"Under review","در حال بررسی")
    else -> raw.replace("_"," ")
}
private val livePhases = setOf("live","in_play","inplay","first_half","second_half",
    "halftime","half_time","extra_time","penalties","1h","2h","ht",
    "1st","2nd","3rd","4th","in_progress","ongoing")
private val finalPhases = setOf("finished","ended","complete","completed",
    "final","ft","after_penalties","settled")
internal fun matchPhase(raw: String, lang: Lang): String = when {
    raw.lowercase() in livePhases -> tr(lang,"LIVE","زنده")
    raw.lowercase() in finalPhases -> tr(lang,"FINISHED","پایان‌یافته")
    raw.lowercase() in setOf("scheduled","prematch","pre_match","not_started","upcoming") ->
        tr(lang,"PRE-MATCH","پیش‌بازی")
    raw.lowercase() == "postponed" -> tr(lang,"POSTPONED","به‌تعویق‌افتاده")
    raw.lowercase() in setOf("cancelled","canceled") -> tr(lang,"CANCELLED","لغوشده")
    raw.lowercase() in setOf("suspended","interrupted") -> tr(lang,"SUSPENDED","متوقف‌شده")
    raw.isBlank() -> tr(lang,"Status unavailable","وضعیت نامشخص")
    else -> raw.replace("_"," ")
}
internal fun matchPhaseColor(status: String): Color = when(status.lowercase()) {
    in livePhases -> Palette.red
    in finalPhases -> Palette.green
    else -> Palette.blue
}

/** Provider fixture keys and UUIDs are internal identifiers, never readable team names. */
internal fun validPublicMatchLabel(raw: String): Boolean {
    val value = raw.trim()
    if (value.isBlank() || value.length > 115) return false
    if (value.matches(Regex("(?i)[0-9a-f]{8}-[0-9a-f-]{27,}"))) return false
    if (value.contains(':') && (value.contains('_') ||
            Regex("[0-9a-fA-F]{16,}").containsMatchIn(value))) return false
    if (Regex("[0-9a-fA-F]{22,}").containsMatchIn(value)) return false
    if (value.matches(Regex("[a-z0-9_]+"))) return false
    return true
}

internal fun fixtureTitle(leg: BetLegDetail, match: Match?, lang: Lang): String {
    if (match != null && match.home.name != "TBD" && match.away.name != "TBD")
        return match.home.name + " — " + match.away.name
    if (validPublicMatchLabel(leg.matchLabel)) return leg.matchLabel.trim()
    return tr(lang, "Match details unavailable", "نام مسابقه در دسترس نیست")
}

internal fun betLegOutcomeColor(leg: BetLegDetail): Color = when (
    leg.result.ifBlank { leg.status }.uppercase()
) {
    "WON","HALF_WON" -> Palette.green
    "LOST","HALF_LOST" -> Palette.red
    "VOID","REFUNDED" -> Palette.blue
    else -> ticketMuted
}

/** Read-only bet selection: same card in My Bets and receipt, no inferred wins. */
@Composable
internal fun BetSelectionOverview(
    leg: BetLegDetail,
    lang: Lang,
    modifier: Modifier = Modifier,
    resolvedMatch: Match? = null
) {
    val result = leg.result.ifBlank { leg.status }
    val terminalPhase = leg.matchStatus.lowercase() in finalPhases
    val liveMatch = resolvedMatch?.takeIf { it.live && !terminalPhase }
    val live = !terminalPhase && (leg.matchStatus.lowercase() in livePhases || liveMatch != null)
    val scoreHome = liveMatch?.homeScore ?: leg.homeScore ?: resolvedMatch?.homeScore
    val scoreAway = liveMatch?.awayScore ?: leg.awayScore ?: resolvedMatch?.awayScore
    val minute = if (live) liveMatch?.minute ?: leg.minute else null
    val phase = if (terminalPhase) matchPhase(leg.matchStatus, lang)
        else if (liveMatch != null) tr(lang,"LIVE","زنده")
        else matchPhase(leg.matchStatus, lang)
    val phaseColor = if (terminalPhase) Palette.green
        else if (liveMatch != null) Palette.red else matchPhaseColor(leg.matchStatus)
    val outcomeColor = betLegOutcomeColor(leg)

    Surface(
        modifier = modifier,
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, ticketBorder)
    ) {
        Column(Modifier.fillMaxWidth().padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.SportsSoccer, null,
                    tint = Palette.blue, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text(leg.league.ifBlank { resolvedMatch?.league
                    ?: tr(lang, "Match", "مسابقه") },
                    color = ticketMuted, fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f), maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Surface(
                    color = phaseColor.copy(alpha = .10f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(phase + if (live && minute != null) " · ${minute}′" else "",
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                        color = phaseColor, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
            }
            Text(fixtureTitle(leg, resolvedMatch, lang), color = ticketInk,
                fontWeight = FontWeight.Black, fontSize = 14.sp, maxLines = 3,
                overflow = TextOverflow.Ellipsis)
            if (scoreHome != null && scoreAway != null) {
                Row(
                    Modifier.fillMaxWidth()
                        .background(ticketSurface, RoundedCornerShape(11.dp))
                        .padding(horizontal = 11.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Scoreboard, null, tint = Palette.blue,
                        modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (live) tr(lang,"Live score","نتیجه زنده") else
                        tr(lang,"Reported score","نتیجه ثبت‌شده"),
                        color = ticketMuted, fontSize = 10.sp,
                        modifier = Modifier.weight(1f))
                    Text("${scoreHome} : ${scoreAway}", color = ticketInk,
                        fontSize = 17.sp, fontWeight = FontWeight.Black)
                }
            } else if (leg.scheduledAt.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Schedule, null, tint = ticketMuted,
                        modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(leg.scheduledAt.take(16).replace("T"," · "),
                        color = ticketMuted, fontSize = 11.sp)
                }
            }
            HorizontalDivider(color = ticketBorder)
            Text(tr(lang,"Your selection","انتخاب شما"), fontSize = 10.sp,
                color = ticketMuted, fontWeight = FontWeight.Bold)
            Text(leg.selectionLabel.ifBlank { tr(lang,"Selection unavailable","انتخاب نامشخص") },
                color = ticketInk, fontWeight = FontWeight.Black,
                fontSize = 15.sp, maxLines = 3)
            Text(leg.marketLabel.ifBlank { tr(lang,"Market unavailable","مارکت نامشخص") },
                color = ticketMuted, fontSize = 11.sp, maxLines = 2)
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = Color(0xFFE8F2FF), shape = RoundedCornerShape(9.dp)) {
                    Text(tr(lang, "Accepted odds ", "ضریب ثبت‌شده ") + odds(leg.oddsScaled),
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        color = Palette.blue, fontWeight = FontWeight.ExtraBold,
                        fontSize = 11.sp)
                }
                Surface(color = outcomeColor.copy(alpha = .10f),
                    shape = RoundedCornerShape(9.dp)) {
                    Text(legResultLabel(result, lang),
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        color = outcomeColor, fontSize = 11.sp,
                        fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

/** Prefer a fresh live catalogue event over cached match metadata. */
internal fun AppState.matchForLeg(leg: BetLegDetail): Match? {
    if (leg.matchId.isBlank()) return null
    return live.firstOrNull { it.id == leg.matchId }
        ?: ticketMatches[leg.matchId]
        ?: upcoming.firstOrNull { it.id == leg.matchId }
        ?: detail?.takeIf { it.id == leg.matchId }
}
