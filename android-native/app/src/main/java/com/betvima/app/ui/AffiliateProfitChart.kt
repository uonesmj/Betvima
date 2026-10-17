package com.betvima.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.PartnerDailyStat
import com.betvima.app.data.partnerWeeklyTrend
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

private val trendBlue = Color(0xFF1688EF)
private val trendPink = Color(0xFFE84F9A)
private val trendGreen = Color(0xFF08C878)

/**
 * Genuine daily margin, derived from settled player losses - player wins
 * divided by turnover. Missing/no-turnover dates are never drawn as zero profit.
 * The financial data remains server-owned and is not a payout promise.
 */
@Composable
fun AffiliateProfitChart(
    rows: List<PartnerDailyStat>, today: LocalDate, lang: Lang, available: Boolean
) {
    val points = remember(rows, today) { partnerWeeklyTrend(rows, today) }
    val visible = remember(points) { points.map { it?.grossMarginPct?.toFloat() } }
    var selected by remember(today, visible) {
        mutableIntStateOf(visible.indexOfLast { it != null }.takeIf { it >= 0 } ?: 6)
    }
    val selectedPoint = points.getOrNull(selected)
    val percentage = selectedPoint?.grossMarginPct
    val hasTrend = available && visible.any { it != null }
    val progress by animateFloatAsState(
        targetValue = if (hasTrend) 1f else 0f,
        animationSpec = tween(850), label = "affiliate-margin-draw"
    )
    val dateLocale = if (lang == Lang.FA) Locale.forLanguageTag("fa-IR") else Locale.US
    val dayFormat = remember(dateLocale) { DateTimeFormatter.ofPattern("EEE", dateLocale) }
    val dates = (6L downTo 0L).map { today.minusDays(it) }

    Surface(
        color = Color.White, shape = RoundedCornerShape(24.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, affiliateOutline),
        shadowElevation = 2.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Color(0xFFEAF3FF), shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.Insights, null, tint = trendBlue,
                        modifier = Modifier.padding(9.dp).size(21.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Daily profit margin", "درصد سود روزانه"),
                        fontSize = 16.sp, fontWeight = FontWeight.Black, color = affiliateInk)
                    Text(tr(lang, "Last 7 days · settled turnover",
                        "۷ روز اخیر · گردش شرط تسویه‌شده"),
                        fontSize = 10.sp, color = Color(0xFF7F8B9C))
                }
                Surface(color = Color(0xFFF2F6FB), shape = RoundedCornerShape(10.dp)) {
                    Text("7D", modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        color = trendBlue, fontSize = 11.sp, fontWeight = FontWeight.Black)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when {
                        !available -> "—"
                        percentage == null -> tr(lang, "No activity", "بدون فعالیت")
                        else -> percentage.stripTrailingZeros().toPlainString() + "%"
                    }, fontSize = if (percentage == null) 20.sp else 29.sp,
                    fontWeight = FontWeight.Black,
                    color = if (percentage != null && percentage.signum() < 0) trendPink else affiliateInk
                )
                Spacer(Modifier.weight(1f))
                Text(dates[selected].format(dayFormat) + " · " + dates[selected].dayOfMonth,
                    color = Color(0xFF7F8B9C), fontSize = 12.sp)
            }
            val maxMagnitude = maxOf(5f, visible.filterNotNull().maxOfOrNull { abs(it) } ?: 0f)
            val top = maxMagnitude * 1.18f
            val bottom = -top
            val yOf: (Float, Float) -> Float = { height, percent ->
                ((top - percent) / (top - bottom)) * height
            }
            Box(
                Modifier.fillMaxWidth().height(175.dp)
                    .background(Color(0xFFF8FAFE), RoundedCornerShape(16.dp))
                    .padding(horizontal = 10.dp, vertical = 14.dp)
            ) {
                Canvas(Modifier.fillMaxSize().pointerInput(visible) {
                    detectTapGestures { point ->
                        val step = size.width.toFloat() / 6f
                        if (step > 0f) selected = (point.x / step).toInt().coerceIn(0, 6)
                    }
                }) {
                    val w = size.width
                    val h = size.height
                    val step = w / 6f
                    for (i in 0..4) {
                        val y = h * i / 4f
                        drawLine(Color(0xFFE7EDF5), androidx.compose.ui.geometry.Offset(0f, y),
                            androidx.compose.ui.geometry.Offset(w, y), strokeWidth = 1.dp.toPx())
                    }
                    val zeroY = yOf(h, 0f)
                    drawLine(Color(0xFFAEBFD2), androidx.compose.ui.geometry.Offset(0f, zeroY),
                        androidx.compose.ui.geometry.Offset(w, zeroY), strokeWidth = 1.1.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(7f, 7f)))
                    if (hasTrend) {
                        val runs = mutableListOf<List<Int>>()
                        var current = mutableListOf<Int>()
                        for (i in visible.indices) {
                            if (visible[i] == null) {
                                if (current.isNotEmpty()) runs.add(current.toList())
                                current = mutableListOf()
                            } else current.add(i)
                        }
                        if (current.isNotEmpty()) runs.add(current)
                        runs.forEach { run ->
                            val curve = Path()
                            val first = run.first()
                            curve.moveTo(first * step, yOf(h, visible[first]!!))
                            for (idx in 1 until run.size) {
                                val before = run[idx - 1]
                                val now = run[idx]
                                val x0 = before * step
                                val x1 = now * step
                                val y0 = yOf(h, visible[before]!!)
                                val y1 = yOf(h, visible[now]!!)
                                val middle = (x0 + x1) / 2f
                                curve.cubicTo(middle, y0, middle, y1, x1, y1)
                            }
                            if (run.size > 1) {
                                val area = Path().apply {
                                    addPath(curve)
                                    lineTo(run.last() * step, zeroY)
                                    lineTo(first * step, zeroY)
                                    close()
                                }
                                drawPath(area, Brush.verticalGradient(
                                    listOf(trendBlue.copy(alpha = .25f), trendBlue.copy(alpha = .015f)),
                                    startY = 0f, endY = h))
                            }
                            drawPath(curve, trendBlue.copy(alpha = progress),
                                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
                        }
                        visible.forEachIndexed { i, value ->
                            if (value != null) {
                                val center = androidx.compose.ui.geometry.Offset(
                                    i * step, yOf(h, value))
                                drawCircle(Color.White, radius = if (i == selected) 7.dp.toPx() else 4.5.dp.toPx(), center = center)
                                drawCircle(if (value < 0) trendPink else trendGreen,
                                    radius = if (i == selected) 5.dp.toPx() else 3.dp.toPx(), center = center)
                            }
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                dates.forEachIndexed { index, date ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(date.format(dayFormat), fontSize = 10.sp, color =
                            if (selected == index) trendBlue else Color(0xFF7F8B9C),
                            fontWeight = if (selected == index) FontWeight.Black else FontWeight.Normal)
                        Text(date.dayOfMonth.toString(), fontSize = 9.sp,
                            color = Color(0xFF9AA9B9))
                    }
                }
            }
            Divider(color = Color(0xFFECF0F5))
            Text(
                tr(lang,
                    "Daily margin = (player losses − player wins) ÷ settled turnover. This is not your payable commission.",
                    "حاشیه سود روزانه = (باخت کاربران − برد کاربران) ÷ گردش شرط تسویه‌شده؛ این رقم کمیسیون قابل برداشت شما نیست."),
                fontSize = 10.sp, lineHeight = 15.sp, color = Color(0xFF8895A7)
            )
        }
    }
}
