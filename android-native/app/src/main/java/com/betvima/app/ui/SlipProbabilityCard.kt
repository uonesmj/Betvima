package com.betvima.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Pick
import com.betvima.app.data.SlipOddsMatch
import com.betvima.app.data.estimateSlipOutcome
import com.betvima.app.data.slipOutcomePercents
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

private val winGreen = Color(0xFF08BD77)
private val lossRed = Color(0xFFEF5A76)
private val refundAmber = Color(0xFFF2AF3D)
private val mutedText = Color(0xFF778A96)

/**
 * Small, borderless probability display embedded alongside Combined Odds.
 * Falls back to the odds ALREADY visible to the customer when the market feed
 * cannot model a leg; the fallback is explicitly marked approximate.
 * Never changes selections, accepted prices, quotes or financial settlement.
 */
@Composable
fun SlipProbabilityInline(
    picks: List<Pick>, model: AppViewModel, lang: Lang,
    modifier: Modifier = Modifier
) {
    if (picks.isEmpty()) return
    val ids = remember(picks) { picks.map { it.matchId }.distinct().sorted() }
    var snapshots by remember(ids) { mutableStateOf<Map<String, SlipOddsMatch>>(emptyMap()) }

    LaunchedEffect(ids) {
        while (true) {
            try {
                snapshots = model.slipProbabilitySnapshots(ids)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                snapshots = emptyMap()
            }
            delay(if (ids.size <= 4) 12_000L else 30_000L)
        }
    }
    val estimate = remember(picks, snapshots) { estimateSlipOutcome(picks, snapshots) }
    val percent = estimate?.let(::slipOutcomePercents)
    val win by animateFloatAsState(
        targetValue = (estimate?.win ?: 0.0).toFloat(),
        animationSpec = tween(600), label = "slip-chance-win"
    )
    val lose by animateFloatAsState(
        targetValue = (estimate?.lose ?: 0.0).toFloat(),
        animationSpec = tween(600), label = "slip-chance-loss"
    )
    val refund by animateFloatAsState(
        targetValue = (estimate?.refund ?: 0.0).toFloat(),
        animationSpec = tween(600), label = "slip-chance-refund"
    )

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (estimate?.approximatedLegs ?: 0 > 0)
                    tr(lang, "ODDS ESTIMATE", "برآورد ضریب")
                else if (estimate?.live == true)
                    tr(lang, "LIVE ESTIMATE", "برآورد زنده")
                else tr(lang, "WIN PROBABILITY", "احتمال برد"),
                fontSize = 8.sp, color = mutedText, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
        }

        if (percent == null) {
            Text(tr(lang, "Odds unavailable", "ضرایب نامعتبر"), color = mutedText, fontSize = 9.sp)
            return@Column
        }
        Row(verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(modifier = Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                val summary = tr(
                    lang,
                    "Win " + percent.win + "%, loss " + percent.lose +
                        "%, refund " + (if (estimate.refundKnown) percent.refund.toString() + "%" else "unknown"),
                    "برد " + percent.win + "٪، باخت " + percent.lose +
                        "٪، برگشت " + (if (estimate.refundKnown) percent.refund.toString() + "٪" else "نامشخص")
                )
                Canvas(Modifier.fillMaxSize().padding(6.dp)
                    .semantics { contentDescription = summary }) {
                    val stroke = 7.dp.toPx()
                    drawCircle(Color(0xFFDCEBE6), style = Stroke(width = stroke))
                    val degreesWin = win * 360f
                    val degreesLose = lose * 360f
                    val degreesRefund = refund * 360f
                    if (degreesWin > 0.1f) drawArc(
                        winGreen, -90f, degreesWin, false,
                        style = Stroke(width = stroke, cap = StrokeCap.Butt)
                    )
                    if (degreesLose > 0.1f) drawArc(
                        lossRed, -90f + degreesWin, degreesLose, false,
                        style = Stroke(width = stroke, cap = StrokeCap.Butt)
                    )
                    if (estimate.refundKnown && degreesRefund > 0.1f) drawArc(
                        refundAmber, -90f + degreesWin + degreesLose,
                        degreesRefund, false, style = Stroke(width = stroke, cap = StrokeCap.Butt)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(percent.win.toString() + "%", color = Color(0xFF0B7551),
                        fontWeight = FontWeight.Black, fontSize = 15.sp, lineHeight = 17.sp)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                CompactChanceLabel(tr(lang, "Win", "برد"), percent.win.toString() + "%", winGreen)
                CompactChanceLabel(tr(lang, "Lose", "باخت"), percent.lose.toString() + "%", lossRed)
                CompactChanceLabel(
                    tr(lang, "Refund", "برگشت"),
                    if (estimate.refundKnown) percent.refund.toString() + "%" else "—",
                    refundAmber
                )
            }
        }
        if (estimate.approximatedLegs > 0) {
            Text(
                tr(lang, "Selected-odds approximation · refund unknown",
                    "برآورد ضریب انتخابی · برگشت نامشخص"),
                color = mutedText, fontSize = 7.sp, maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun CompactChanceLabel(label: String, value: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(color))
        Text(label, modifier = Modifier.weight(1f), color = Color(0xFF566B77),
            fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, color = color, fontWeight = FontWeight.Black,
            fontSize = 10.sp, maxLines = 1)
    }
}
