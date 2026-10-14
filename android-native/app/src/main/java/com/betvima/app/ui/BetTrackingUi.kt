package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Scoreboard
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
import com.betvima.app.data.odds

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
        0 -> tr(lang, "Stake returned", "برگشت مبلغ")
        else -> tr(lang, "Settled", "تسویه‌شده")
    }
}
internal fun ticketResultColor(bet: Bet): Color = when (bet.status.lowercase()) {
    "settled" -> when (bet.netResultMinor?.toBigDecimalOrNull()?.signum()) {
        1 -> Palette.green; -1 -> Palette.red; else -> Palette.blue
    }
    "rejected" -> Palette.red
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
    raw.isBlank() -> tr(lang,"Unknown phase","وضعیت نامشخص")
    else -> raw.replace("_"," ")
}
internal fun matchPhaseColor(status: String): Color = when(status.lowercase()) {
    in livePhases -> Palette.red
    in finalPhases -> Palette.green
    else -> Palette.blue
}

@Composable
internal fun BetSelectionOverview(
    leg: BetLegDetail, lang: Lang, modifier: Modifier = Modifier
) {
    val result = leg.result.ifBlank { leg.status }
    val phaseColor = matchPhaseColor(leg.matchStatus)
    Surface(modifier = modifier, color = Color(0xFFF6F8FB),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Palette.border)) {
        Column(Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(leg.league.ifBlank { tr(lang,"Match","مسابقه") },
                    color = Palette.muted, fontSize = 10.sp,
                    modifier = Modifier.weight(1f), maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Surface(color = phaseColor.copy(alpha=.12f),
                    shape = RoundedCornerShape(8.dp)) {
                    Text(matchPhase(leg.matchStatus,lang),
                        modifier = Modifier.padding(horizontal=8.dp,vertical=5.dp),
                        color=phaseColor,fontSize=10.sp,fontWeight=FontWeight.Black)
                }
            }
            Text(leg.matchLabel,color=Palette.text,fontWeight=FontWeight.Black,fontSize=13.sp)
            if (leg.homeScore != null && leg.awayScore != null) {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Scoreboard,null,tint=Palette.blue,
                        modifier=Modifier.size(17.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(leg.homeScore.toString()+" : "+leg.awayScore.toString(),
                        color=Palette.text,fontSize=15.sp,fontWeight=FontWeight.Black)
                    if (leg.matchStatus.lowercase() in livePhases && leg.minute != null) {
                        Spacer(Modifier.width(8.dp))
                        Text(leg.minute.toString()+"′",color=Palette.red,fontSize=11.sp)
                    }
                }
            } else if (leg.scheduledAt.isNotBlank()) {
                Text(leg.scheduledAt.take(16).replace("T"," · "),
                    color=Palette.muted,fontSize=10.sp)
            }
            HorizontalDivider(color=Palette.border)
            Text(leg.marketLabel+" · "+leg.selectionLabel,
                color=Palette.text,fontSize=12.sp,fontWeight=FontWeight.Bold)
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(tr(lang,"Placed odds","ضریب ثبت‌شده")+": "+odds(leg.oddsScaled),
                    color=Palette.blue,fontSize=11.sp,fontWeight=FontWeight.Black,
                    modifier=Modifier.weight(1f))
                val tint=when(result.uppercase()) {
                    "WON","HALF_WON"->Palette.green
                    "LOST","HALF_LOST"->Palette.red
                    else->Palette.muted
                }
                Text(legResultLabel(result,lang),color=tint,
                    fontSize=11.sp,fontWeight=FontWeight.ExtraBold)
            }
        }
    }
}
