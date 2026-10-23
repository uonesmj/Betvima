package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.LiveStat
import com.betvima.app.data.Match
import kotlinx.coroutines.delay

private val trackerInk = Color(0xFF102A35)
private val trackerGreen = Color(0xFF46DEA6)
private val trackerGold = Color(0xFFFFCC79)
private val trackerWhite = Color(0xFFF3FAFB)
private val trackedKeys = setOf(
    "corners", "throwins", "fouls", "offsides", "yellowcards", "redcards",
    "on_target", "off_target", "attacks", "dangerous_attacks", "freekicks", "goalkicks"
)

private data class TrackerChange(
    val id: String, val side: String, val en: String, val fa: String,
    val increase: Int, val minute: Int?
)

private fun trackerShare(home: Int?, away: Int?): Float? {
    if (home == null || away == null || home < 0 || away < 0) return null
    val sum = home.toLong() + away.toLong()
    return if (sum > 0) (home.toFloat() / sum).coerceIn(0f, 1f) else null
}

private fun trackerScore(match: Match, facts: LiveMatchFacts?): String {
    val score = facts?.score?.split("-")?.takeIf { it.size == 2 }
    return if (score != null) score[0] + " : " + score[1]
    else (match.homeScore?.toString() ?: "–") + " : " + (match.awayScore?.toString() ?: "–")
}

/**
 * Rich football tracking surfaces for the native detail page.
 *
 * This source supplies totals, not spatial coordinates or official incident
 * timestamps. The drawing never invents ball positions or player formation.
 * All activity animations are changes to *reported counters* only.
 */
@Composable
internal fun PremiumNativeLiveTracker(
    match: Match, facts: LiveMatchFacts?, fa: Boolean, clockLabel: String,
    embedded: Boolean = false
) {
    val activeLang177 = LocalNativeLanguage176.current
    var page by remember(match.id) { mutableStateOf(0) }
    var previous by remember(match.id) { mutableStateOf<LiveMatchFacts?>(null) }
    var currentPulse by remember(match.id) { mutableStateOf<TrackerChange?>(null) }
    val changes = remember(match.id) { mutableStateListOf<TrackerChange>() }
    val trend = remember(match.id) { mutableStateListOf<Float>() }
    val activity = facts?.stat("dangerous_attacks") ?: facts?.stat("attacks")
    val share = trackerShare(activity?.home, activity?.away)
    val animatedShare by animateFloatAsState(
        targetValue = share ?: .5f,
        animationSpec = tween(durationMillis = 700),
        label = "liveTrackerAttackingShare"
    )

    LaunchedEffect(facts?.observedAt, match.id) {
        val before = previous
        previous = facts
        if (facts == null || facts.observedAt.isBlank()) return@LaunchedEffect
        if (before == null || before.fi != facts.fi) return@LaunchedEffect
        if (before.observedAt == facts.observedAt) return@LaunchedEffect
        val events = mutableListOf<TrackerChange>()
        facts.stats.forEach { next ->
            if (next.key !in trackedKeys) return@forEach
            val old = before.stat(next.key) ?: return@forEach
            listOf("home", "away").forEach { side ->
                val first = if (side == "home") old.home else old.away
                val last = if (side == "home") next.home else next.away
                val increase = if (first != null && last != null) last - first else 0
                val maximum = if (next.key.contains("attack")) 15 else 4
                if (increase in 1..maximum) events.add(TrackerChange(
                    facts.fi + ":" + facts.observedAt + ":" + next.key + ":" + side,
                    side, next.en, next.fa, increase, facts.minute
                ))
            }
        }
        if (events.isNotEmpty()) {
            events.reversed().forEach { changes.add(0, it) }
            while (changes.size > 50) changes.removeAt(changes.lastIndex)
            currentPulse = events.first()
        }
        val nextActivity = facts.stat("dangerous_attacks") ?: facts.stat("attacks")
        val measured = trackerShare(nextActivity?.home, nextActivity?.away)
        if (measured != null) {
            trend.add(measured)
            while (trend.size > 30) trend.removeAt(0)
        }
    }
    LaunchedEffect(currentPulse?.id) {
        val id = currentPulse?.id ?: return@LaunchedEffect
        delay(5_200)
        if (currentPulse?.id == id) currentPulse = null
    }

    val tabNames = listOf(trLive177(activeLang177, "Pitch", "زمین"), trLive177(activeLang177, "Stats", "آمار"),
        trLive177(activeLang177, "Updates", "رویدادها"), trLive177(activeLang177, "Trend", "روند"))
    val icons = listOf(Icons.Default.Sensors, Icons.Default.BarChart,
        Icons.Default.History, Icons.Default.TrendingUp)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = trackerInk,
        shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, Color(0xFF32505A))
    ) {
        Column {
            if (!embedded) {
            Row(
                modifier = Modifier.fillMaxWidth().background(Color(0xFF183541))
                    .padding(horizontal = 13.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.size(8.dp).background(trackerGreen, RoundedCornerShape(8.dp)))
                Spacer(Modifier.width(7.dp))
                Text(trLive177(activeLang177, "LIVE MATCH CENTRE", "مرکز زنده مسابقه"),
                    color = trackerWhite, fontWeight = FontWeight.Black,
                    fontSize = 10.sp, modifier = Modifier.weight(1f))
                Text(clockLabel, color = trackerGreen, fontSize = 14.sp,
                    fontWeight = FontWeight.Bold)
            }
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(match.home.name, color = trackerWhite, fontWeight = FontWeight.ExtraBold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f), fontSize = 12.sp)
                Text(trackerScore(match, facts), color = Color.White,
                    fontWeight = FontWeight.Black, fontSize = 23.sp,
                    textAlign = TextAlign.Center, modifier = Modifier.width(90.dp))
                Text(match.away.name, color = trackerWhite, fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.End, maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f), fontSize = 12.sp)
            }
            }
            val possession = facts?.stat("possession")
            Row(Modifier.fillMaxWidth().background(Color(0xFF112B36))
                .padding(vertical = 9.dp, horizontal = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly) {
                TrackerHeaderFact(trLive177(activeLang177, "Home possession", "مالکیت میزبان"),
                    possession?.home?.let { it.toString() + "%" } ?: "—")
                TrackerHeaderFact(trLive177(activeLang177, "Dangerous attacks", "حملات خطرناک"),
                    (facts?.stat("dangerous_attacks")?.home?.toString() ?: "—") + " : " +
                        (facts?.stat("dangerous_attacks")?.away?.toString() ?: "—"))
                TrackerHeaderFact(trLive177(activeLang177, "Away possession", "مالکیت مهمان"),
                    possession?.away?.let { it.toString() + "%" } ?: "—")
            }
            Row(
                modifier = Modifier.fillMaxWidth().background(Color(0xFF142C37))
                    .padding(horizontal = 6.dp)
            ) {
                tabNames.forEachIndexed { index, name ->
                    val chosen = index == page
                    Column(
                        modifier = Modifier.weight(1f).clickable { page = index }
                            .background(if (chosen) Color(0xFF205064) else Color.Transparent)
                            .padding(vertical = 9.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(icons[index], contentDescription = null,
                            tint = if (chosen) trackerWhite else Color(0xFF97AFBA),
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.height(3.dp))
                        Text(name, color = if (chosen) trackerWhite else Color(0xFF97AFBA),
                            fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.width(if (chosen) 29.dp else 2.dp).height(2.dp)
                            .background(if (chosen) Color(0xFF59B7FE) else Color.Transparent))
                    }
                }
            }
            when (page) {
                0 -> Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    NativeSchematicPitch(pulseSide = currentPulse?.side)
                    AnimatedVisibility(currentPulse != null) {
                        val pulse = currentPulse
                        if (pulse != null) Surface(
                            color = Color(0xFF1A674E), shape = RoundedCornerShape(10.dp)
                        ) {
                            Column(Modifier.fillMaxWidth().padding(10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(if (pulse.side == "home") match.home.name else match.away.name,
                                    color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                                Text((trLive177(activeLang177, pulse.en, pulse.fa)) + " +" + pulse.increase,
                                    color = Color(0xFFB5FCE1), fontSize = 11.sp)
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(match.home.name, fontSize = 10.sp, color = trackerWhite,
                            maxLines = 1, modifier = Modifier.weight(1f))
                        Text(trLive177(activeLang177, "ATTACK PRESSURE", "فشار حملات"),
                            fontSize = 9.sp, color = Color(0xFFA3B7BD))
                        Text(match.away.name, fontSize = 10.sp, color = trackerWhite,
                            maxLines = 1, textAlign = TextAlign.End,
                            modifier = Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth().height(8.dp)
                        .background(Color(0xFF29505B), RoundedCornerShape(9.dp))) {
                        if (share != null) {
                            Box(Modifier.fillMaxWidth(animatedShare)
                                .fillMaxHeight().background(trackerGreen, RoundedCornerShape(9.dp)))
                            Box(Modifier.weight(1f).fillMaxHeight()
                                .background(trackerGold, RoundedCornerShape(9.dp)))
                        }
                    }
                    Text(trLive177(activeLang177, "Schematic pitch · highlights indicate verified counter changes, not real ball positions.", "زمین شماتیک است؛ برجسته‌سازی‌ها تغییر آمار دریافتی‌اند، نه موقعیت واقعی توپ."),
                        color = Color(0xFFACC5CC), fontSize = 10.sp,
                        textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
                1 -> Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (facts?.stats.isNullOrEmpty()) {
                        TrackerEmpty(trLive177(activeLang177, "No verified match statistics supplied", "آمار معتبر مسابقه از API موجود نیست"))
                    } else facts!!.stats.forEach { stat ->
                        NativeTrackerStat(stat, fa)
                    }
                }
                2 -> Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (changes.isEmpty()) TrackerEmpty(
                        trLive177(activeLang177, "Changes observed since opening this page will appear here.", "تغییرات از زمان باز شدن این صفحه نمایش داده می‌شوند.")
                    )
                    changes.take(20).forEach { update ->
                        Surface(color = Color(0xFF1B3B48), shape = RoundedCornerShape(10.dp)) {
                            Row(Modifier.fillMaxWidth().padding(11.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(if (update.side == "home") match.home.name else match.away.name,
                                    color = trackerWhite, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                    maxLines = 1, modifier = Modifier.weight(1f))
                                Text((trLive177(activeLang177, update.en, update.fa)) + " +" + update.increase,
                                    color = trackerGreen, fontSize = 10.sp,
                                    modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                                Spacer(Modifier.width(8.dp))
                                Text(update.minute?.toString()?.plus("′") ?: "—",
                                    color = Color(0xFFB7CCD3), fontSize = 10.sp)
                            }
                        }
                    }
                    Text(trLive177(activeLang177, "Counter changes are not an official timestamped incident feed.", "این موارد تغییر شمارنده‌ها هستند؛ رویدادهای رسمی با زمان دقیق نیستند."),
                        color = Color(0xFFA3B7BD), fontSize = 9.sp,
                        modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                }
                else -> Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(trLive177(activeLang177, "Attacking pressure during this session", "نمودار فشار حملات در همین بازدید"),
                        color = trackerWhite, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                    if (trend.isEmpty()) TrackerEmpty(
                        trLive177(activeLang177, "The graph appears as fresh snapshots are received.", "با دریافت داده‌های جدید نمودار ساخته می‌شود.")
                    )
                    else Row(Modifier.fillMaxWidth().height(118.dp).background(Color(0xFF1A3945),
                        RoundedCornerShape(10.dp)).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        trend.forEach { portion ->
                            Column(Modifier.weight(1f).fillMaxHeight(),
                                verticalArrangement = Arrangement.Bottom) {
                                Box(Modifier.fillMaxWidth().fillMaxHeight(portion.coerceAtLeast(.015f))
                                    .background(trackerGreen, RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)))
                            }
                        }
                    }
                    listOf("on_target", "off_target", "corners", "fouls").chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { key ->
                                val stat = facts?.stat(key)
                                Column(Modifier.weight(1f).background(Color(0xFF1A3945),
                                    RoundedCornerShape(10.dp)).padding(9.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(trLive177(activeLang177, stat?.en ?: key, stat?.fa ?: key),
                                        color = Color(0xFFA3B7BD), fontSize = 9.sp, maxLines = 1)
                                    Text((stat?.home?.toString() ?: "—") + " : " +
                                        (stat?.away?.toString() ?: "—"),
                                        color = trackerWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
            Text(
                (trLive177(activeLang177, "Last provider update: ", "آخرین دریافت API: ")) +
                    (facts?.observedAt?.takeIf { it.isNotBlank() } ?: "—"),
                fontSize = 9.sp, color = Color(0xFF93B2BD),
                modifier = Modifier.fillMaxWidth().background(Color(0xFF0E2630)).padding(11.dp)
            )
        }
    }
}

@Composable
private fun TrackerHeaderFact(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 9.sp, color = Color(0xFFAAC1CA), maxLines = 1)
        Text(value, fontSize = 11.sp, color = trackerWhite, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TrackerEmpty(label: String) {
    Text(label, color = Color(0xFFB7CCD3), fontSize = 11.sp,
        textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(20.dp))
}

@Composable
private fun NativeTrackerStat(stat: LiveStat, fa: Boolean) {
    val activeLang177 = LocalNativeLanguage176.current
    val share = trackerShare(stat.home, stat.away)
    Surface(color = Color(0xFF1A3945), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.fillMaxWidth().padding(11.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(stat.home?.toString() ?: "—", color = trackerGreen,
                    fontSize = 14.sp, fontWeight = FontWeight.Black)
                Text(trLive177(activeLang177, stat.en, stat.fa), modifier = Modifier.weight(1f),
                    color = trackerWhite, fontSize = 11.sp, textAlign = TextAlign.Center)
                Text(stat.away?.toString() ?: "—", color = trackerGold,
                    fontSize = 14.sp, fontWeight = FontWeight.Black)
            }
            Row(Modifier.fillMaxWidth().height(6.dp)
                .background(Color(0xFF355262), RoundedCornerShape(6.dp))) {
                if (share != null) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(share).background(trackerGreen))
                    Box(Modifier.fillMaxHeight().weight(1f).background(trackerGold))
                }
            }
        }
    }
}

/**
 * Independent vector pitch. The supplier does not provide ball or player
 * coordinates, so no fake ball token is drawn or animated.
 */
@Composable
private fun NativeSchematicPitch(pulseSide: String?) {
    Canvas(Modifier.fillMaxWidth().aspectRatio(1.83f)) {
        val width = size.width
        val height = size.height
        drawRect(Color(0xFF166440))
        for (i in 0..9) if (i % 2 == 0) {
            drawRect(Color.White.copy(alpha = .037f), Offset(width * i / 10f, 0f),
                Size(width / 10f, height))
        }
        val field = Color(0xFFCEF3DE).copy(alpha = .77f)
        val thick = 2.0.dp.toPx()
        val left = width * .035f
        val top = height * .07f
        val fieldW = width * .93f
        val fieldH = height * .86f
        if (pulseSide != null) {
            drawRect(Color(0xFF85FFD0).copy(alpha = .15f),
                topLeft = Offset(if (pulseSide == "home") width * .67f else left, top),
                size = Size(width * .29f, fieldH))
        }
        drawRect(field, topLeft = Offset(left, top),
            size = Size(fieldW, fieldH), style = Stroke(thick))
        drawLine(field, Offset(width / 2f, top),
            Offset(width / 2f, top + fieldH), thick)
        drawCircle(field, radius = height * .145f,
            center = Offset(width / 2f, height / 2f), style = Stroke(thick))
        drawCircle(field, radius = thick * 1.3f, center = Offset(width / 2f, height / 2f))
        drawRect(field, Offset(left, height * .27f),
            Size(width * .17f, height * .46f), style = Stroke(thick))
        drawRect(field, Offset(width * .795f, height * .27f),
            Size(width * .17f, height * .46f), style = Stroke(thick))
        drawRect(field, Offset(left, height * .365f),
            Size(width * .075f, height * .27f), style = Stroke(thick))
        drawRect(field, Offset(width * .89f, height * .365f),
            Size(width * .075f, height * .27f), style = Stroke(thick))
        drawCircle(field, radius = thick * 1.5f, center = Offset(width * .155f, height * .5f))
        drawCircle(field, radius = thick * 1.5f, center = Offset(width * .845f, height * .5f))
    }
}
