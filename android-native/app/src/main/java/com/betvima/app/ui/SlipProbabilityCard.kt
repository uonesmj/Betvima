package com.betvima.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Pick
import com.betvima.app.data.SlipOddsMatch
import com.betvima.app.data.estimateSlipOutcome
import com.betvima.app.data.slipOutcomePercents
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

private val chanceGreen = Color(0xFF16CC8B)
private val chanceRed = Color(0xFFED6479)
private val chanceAmber = Color(0xFFF2B953)
private val chanceNavy = Color(0xFF0C1B28)
private val chanceMuted = Color(0xFFA4BCC9)

/** Read-only display: score changes affect this only when market odds update. */
@Composable
fun SlipProbabilityCard(picks: List<Pick>, model: AppViewModel, lang: Lang) {
    if (picks.isEmpty()) return
    val matchIds = remember(picks) { picks.map { it.matchId }.distinct().sorted() }
    var snapshots by remember(matchIds) { mutableStateOf<Map<String, SlipOddsMatch>?>(null) }
    var loading by remember(matchIds) { mutableStateOf(true) }

    LaunchedEffect(matchIds) {
        while (true) {
            try {
                snapshots = model.slipProbabilitySnapshots(matchIds)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                snapshots = null // Do not present stale data as live.
            } finally {
                loading = false
            }
            delay(if (matchIds.size <= 4) 12_000L else 30_000L)
        }
    }

    val estimate = remember(picks, snapshots) {
        snapshots?.let { estimateSlipOutcome(picks, it) }
    }
    val percent = estimate?.let(::slipOutcomePercents)
    val win by animateFloatAsState(estimate?.win?.toFloat() ?: 0f, tween(650), label = "slip-win")
    val lose by animateFloatAsState(estimate?.lose?.toFloat() ?: 0f, tween(650), label = "slip-lose")
    val refund by animateFloatAsState(estimate?.refund?.toFloat() ?: 0f, tween(650), label = "slip-refund")

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp), color = chanceNavy, shadowElevation = 3.dp
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(29.dp).clip(RoundedCornerShape(9.dp))
                        .background(Color(0xFF1A3444)), contentAlignment = Alignment.Center
                ) {
                    Text("◎", color = chanceGreen, fontSize = 19.sp,
                        fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "BET PROBABILITY", "تحلیل احتمال شرط"),
                        fontWeight = FontWeight.Black, color = Color.White, fontSize = 12.sp)
                    Text(tr(lang, "From current market prices", "برآورد بر اساس ضرایب بازار"),
                        color = chanceMuted, fontSize = 9.sp)
                }
                Surface(
                    color = if (estimate?.live == true) Color(0xFF5C2235)
                        else Color(0xFF233C4A), shape = RoundedCornerShape(12.dp)
                ) {
                    Text(if (estimate?.live == true) tr(lang, "● LIVE", "● زنده")
                        else tr(lang, "MARKET", "بازار"),
                        color = if (estimate?.live == true) Color(0xFFFF98AC)
                            else Color(0xFFC0D2DE),
                        fontSize = 9.sp, fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
                }
            }
            if (percent != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(Modifier.size(126.dp), contentAlignment = Alignment.Center) {
                        val a11y = tr(lang,
                            "Win " + percent.win + " percent, lose " + percent.lose +
                                " percent, refund " + percent.refund + " percent",
                            "برد " + percent.win + " درصد، باخت " + percent.lose +
                                " درصد، برگشت وجه " + percent.refund + " درصد")
                        Canvas(
                            Modifier.fillMaxSize().padding(7.dp)
                                .semantics { contentDescription = a11y }
                        ) {
                            val thick = 12.dp.toPx()
                            drawCircle(Color(0xFF243B49), style = Stroke(width = thick))
                            val w = win * 360f
                            val l = lose * 360f
                            val r = refund * 360f
                            if (w > 2f) drawArc(chanceGreen, -90f, (w - 1.5f).coerceAtLeast(0f),
                                false, style = Stroke(width = thick, cap = StrokeCap.Round))
                            if (l > 2f) drawArc(chanceRed, -90f + w, (l - 1.5f).coerceAtLeast(0f),
                                false, style = Stroke(width = thick, cap = StrokeCap.Round))
                            if (r > 2f) drawArc(chanceAmber, -90f + w + l, (r - 1.5f).coerceAtLeast(0f),
                                false, style = Stroke(width = thick, cap = StrokeCap.Round))
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(percent.win.toString() + "%", color = Color(0xFF7CF0BF),
                                fontSize = 24.sp, fontWeight = FontWeight.Black)
                            Text(tr(lang, "WIN CHANCE", "احتمال برد"), color = chanceMuted,
                                fontSize = 8.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                        SlipChanceLegend(tr(lang, "Win", "برد"), percent.win, chanceGreen)
                        SlipChanceLegend(tr(lang, "Lose", "باخت"), percent.lose, chanceRed)
                        SlipChanceLegend(tr(lang, "Refund", "برگشت وجه"), percent.refund, chanceAmber)
                    }
                }
            } else {
                Column(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    if (loading) CircularProgressIndicator(
                        modifier = Modifier.size(19.dp),
                        color = chanceGreen, strokeWidth = 2.dp
                    )
                    Text(if (loading)
                        tr(lang, "Checking current market odds…", "در حال دریافت ضرایب معتبر…")
                    else tr(lang, "Full probability unavailable for this market.",
                        "اطلاعات کافی برای محاسبه هر سه احتمال وجود ندارد."),
                        color = Color.White, fontSize = 11.sp,
                        fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    if (!loading) Text(
                        tr(lang, "Refund risk, invalid odds or suspension cannot be modeled.",
                            "احتمال برگشت وجه، ضرایب یا وضعیت بازار قابل مدل‌سازی نیست."),
                        color = chanceMuted, fontSize = 9.sp, textAlign = TextAlign.Center)
                }
            }
            HorizontalDivider(color = Color(0xFF2B4453), thickness = 1.dp)
            Text(
                tr(lang,
                    "Market-implied estimate, not a prediction or guarantee. Multi-bets assume independent legs. Exceptional cancellation refunds are excluded.",
                    "این ارقام برآوردی از ضرایب بازارند، نه پیش‌بینی یا تضمین برد. در میکس استقلال انتخاب‌ها فرض می‌شود. برگشت وجه ناشی از لغو استثنایی رویداد محاسبه نشده است."),
                color = chanceMuted, fontSize = 9.sp, lineHeight = 13.sp
            )
        }
    }
}

@Composable
private fun SlipChanceLegend(label: String, percentage: Int, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(7.dp))
        Text(label, color = Color(0xFFD6E6EC), fontSize = 11.sp,
            maxLines = 1, modifier = Modifier.weight(1f))
        Text(percentage.toString() + "%", color = color,
            fontWeight = FontWeight.Black, fontSize = 14.sp)
    }
}
