package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.Match
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

private val pipBackground = Color(0xFF0A1920)
private val pipGreen = Color(0xFF44E6A6)
private val pipGold = Color(0xFFF7CB7B)
private val pipMuted = Color(0xFFB3CCD1)
private val pipStats = listOf(
    "corners" to "Corners", "dangerous_attacks" to "Dangerous attacks",
    "attacks" to "Attacks", "on_target" to "Shots on target",
    "off_target" to "Shots off target", "fouls" to "Fouls",
    "offsides" to "Offsides", "throwins" to "Throw-ins",
    "yellowcards" to "Yellow cards", "redcards" to "Red cards",
    "freekicks" to "Free kicks", "goalkicks" to "Goal kicks"
)
private data class PiPPulse128(val key: String, val team: String, val name: String, val count: Int)

private fun pipAttackShare(facts: LiveMatchFacts?): Float? {
    val stat = facts?.stat("dangerous_attacks") ?: facts?.stat("attacks") ?: return null
    val a = stat.home ?: return null
    val b = stat.away ?: return null
    if (a < 0 || b < 0 || a + b <= 0) return null
    return (a.toFloat() / (a + b)).coerceIn(0f, 1f)
}

/**
 * Non-modal, movable picture-in-picture tracker.
 *
 * PopupProperties(focusable=false) is essential: Android delivers touches and
 * vertical scrolling OUTSIDE this small Popup to the match page underneath.
 * No fullscreen scrim, Dialog, draggable overlay parent or outside-dismiss is
 * created. It stays visible while MatchDetailPage's LazyColumn scrolls.
 */
@Composable
internal fun PremiumMatchTvModal126(
    match: Match, facts: LiveMatchFacts?, fa: Boolean,
    clockLabel: String, onClose: () -> Unit, onRefresh: () -> Unit
) {
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val width = minOf(284, (configuration.screenWidthDp - 20).coerceAtLeast(190)).dp
    val height = minOf(302, (configuration.screenHeightDp - 100).coerceAtLeast(190)).dp
    val pixelWidth = with(density) { width.roundToPx() }
    val pixelHeight = with(density) { height.roundToPx() }
    val screenWidth = with(density) { configuration.screenWidthDp.dp.roundToPx() }
    val screenHeight = with(density) { configuration.screenHeightDp.dp.roundToPx() }
    val inset = with(density) { 10.dp.roundToPx() }
    val maxX = (screenWidth - pixelWidth - inset).coerceAtLeast(0)
    val maxY = (screenHeight - pixelHeight - inset).coerceAtLeast(0)

    // Default near the right edge, then let the user drag to any visible edge.
    var location by remember(match.id, screenWidth, screenHeight) {
        mutableStateOf(IntOffset(maxX, with(density) { 122.dp.roundToPx() }.coerceAtMost(maxY)))
    }
    var selected by remember(match.id) { mutableIntStateOf(0) }
    var previous by remember(match.id) { mutableStateOf<LiveMatchFacts?>(null) }
    var pulse by remember(match.id) { mutableStateOf<PiPPulse128?>(null) }

    LaunchedEffect(match.id, facts?.observedAt) {
        val old = previous
        previous = facts
        if (old == null || facts == null || old.fi != facts.fi ||
            old.observedAt == facts.observedAt) return@LaunchedEffect
        // Animate ONLY confirmed increments, not made-up ball/player movement.
        val next = facts.stats.firstNotNullOfOrNull { stat ->
            val earlier = old.stat(stat.key) ?: return@firstNotNullOfOrNull null
            if (stat.key !in setOf("corners", "dangerous_attacks", "attacks", "on_target",
                    "off_target", "fouls", "offsides", "yellowcards", "redcards", "throwins"))
                return@firstNotNullOfOrNull null
            val h = if (stat.home != null && earlier.home != null) stat.home - earlier.home else 0
            val a = if (stat.away != null && earlier.away != null) stat.away - earlier.away else 0
            val cap = if (stat.key.contains("attack")) 15 else 4
            val side = if (h in 1..cap) "home" else if (a in 1..cap) "away" else null
            side?.let {
                PiPPulse128(stat.key, it, if (fa) stat.fa else stat.en, if (it == "home") h else a)
            }
        }
        if (next != null) pulse = next
    }
    LaunchedEffect(pulse) {
        val active = pulse ?: return@LaunchedEffect
        delay(3900)
        if (pulse == active) pulse = null
    }

    val score = facts?.score?.split("-")?.takeIf { it.size == 2 }
        ?.joinToString(" : ") ?: (match.homeScore?.toString() ?: "–") +
            " : " + (match.awayScore?.toString() ?: "–")
    val share = pipAttackShare(facts)

    Popup(
        alignment = Alignment.TopStart,
        offset = location,
        onDismissRequest = {}, // Close only with X; never by scrolling/tapping the page.
        properties = PopupProperties(
            focusable = false,
            dismissOnBackPress = false,
            dismissOnClickOutside = false,
            clippingEnabled = true
        )
    ) {
        Surface(
            modifier = Modifier.width(width).height(height)
                .border(1.dp, Color(0xFF3B826C), RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            shadowElevation = 16.dp,
            color = pipBackground
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().height(39.dp)
                        .background(Color(0xFF113A35)),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Drag is captured only in the top title bar; buttons
                    // and stats continue to receive their own interactions.
                    Row(
                        modifier = Modifier.weight(1f).fillMaxHeight()
                            .pointerInput(maxX, maxY) {
                                detectDragGestures { change, drag ->
                                    change.consume()
                                    location = IntOffset(
                                        (location.x + drag.x.roundToInt()).coerceIn(0, maxX),
                                        (location.y + drag.y.roundToInt()).coerceIn(0, maxY)
                                    )
                                }
                            }.padding(start = 9.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("⠿", fontSize = 15.sp, color = pipMuted)
                        Spacer(Modifier.width(5.dp))
                        Text(if (fa) "زنده" else "LIVE",
                            color = pipGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Spacer(Modifier.width(5.dp))
                        Text(clockLabel, color = Color.White, fontSize = 10.sp,
                            fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = onRefresh, modifier = Modifier.size(33.dp)) {
                        Icon(Icons.Default.Refresh,
                            contentDescription = if (fa) "تازه‌سازی" else "Refresh",
                            tint = pipMuted, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onClose, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Close,
                            contentDescription = if (fa) "بستن پنجره" else "Close window",
                            tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
                Row(
                    Modifier.fillMaxWidth().height(39.dp)
                        .background(Color(0xFF112830)).padding(horizontal = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(match.home.name, modifier = Modifier.weight(1f),
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        fontWeight = FontWeight.Bold, fontSize = 9.sp,
                        color = Color.White)
                    Text(score, modifier = Modifier.padding(horizontal = 6.dp),
                        fontSize = 17.sp, fontWeight = FontWeight.Black,
                        color = Color.White)
                    Text(match.away.name, modifier = Modifier.weight(1f),
                        textAlign = TextAlign.End, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold,
                        fontSize = 9.sp, color = Color.White)
                }
                Row(
                    Modifier.fillMaxWidth().height(30.dp)
                        .background(Color(0xFF102B33))
                ) {
                    listOf(
                        if (fa) "زمین زنده" else "Pitch",
                        if (fa) "آمار" else "Stats"
                    ).forEachIndexed { i, label ->
                        Box(
                            modifier = Modifier.weight(1f).fillMaxHeight()
                                .background(if (selected == i) Color(0xFF23664D) else Color.Transparent),
                            contentAlignment = Alignment.Center
                        ) {
                            TextButton(onClick = { selected = i }, modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(0.dp)) {
                                Text(label, color = if (selected == i) Color.White else pipMuted,
                                    fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                if (selected == 0) {
                    Column(Modifier.fillMaxSize().padding(7.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (match.sport == "football") {
                            Canvas(Modifier.fillMaxWidth().weight(1f)) {
                                val w = size.width
                                val h = size.height
                                val stroke = 1.2.dp.toPx()
                                drawRect(Color(0xFF176440))
                                repeat(8) { i ->
                                    if (i % 2 == 0) drawRect(
                                        Color.White.copy(alpha = .04f),
                                        Offset(w * i / 8f, 0f), Size(w / 8f, h))
                                }
                                val white = Color.White.copy(alpha = .75f)
                                drawRect(white, Offset(w * .04f, h * .08f),
                                    Size(w * .92f, h * .84f), style = Stroke(stroke))
                                drawLine(white, Offset(w * .5f, h * .08f),
                                    Offset(w * .5f, h * .92f), stroke)
                                drawCircle(white, radius = minOf(w * .11f, h * .19f),
                                    center = Offset(w * .5f, h * .5f), style = Stroke(stroke))
                                drawRect(white, Offset(w * .04f, h * .29f),
                                    Size(w * .16f, h * .42f), style = Stroke(stroke))
                                drawRect(white, Offset(w * .8f, h * .29f),
                                    Size(w * .16f, h * .42f), style = Stroke(stroke))
                                val active = pulse?.team
                                if (active != null) drawRect(
                                    pipGreen.copy(alpha = .22f),
                                    Offset(if (active == "home") w * .70f else w * .04f,
                                        h * .08f), Size(w * .26f, h * .84f))
                            }
                        } else {
                            Text(if (fa) "آمار مسابقه" else "Match statistics",
                                color = pipMuted, modifier = Modifier.weight(1f)
                                    .fillMaxWidth(), textAlign = TextAlign.Center)
                        }
                        AnimatedVisibility(visible = pulse != null) {
                            Text(pulse?.let { p ->
                                (if (p.team == "home") match.home.name else match.away.name) +
                                    " · +" + p.count + " " + p.name
                            } ?: "", fontSize = 9.sp, color = pipGreen,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Row(Modifier.fillMaxWidth().height(7.dp)
                            .background(Color(0xFF264A49), RoundedCornerShape(6.dp))) {
                            if (share != null) {
                                Box(Modifier.fillMaxWidth(share).fillMaxHeight()
                                    .background(pipGreen))
                                Box(Modifier.weight(1f).fillMaxHeight()
                                    .background(pipGold))
                            }
                        }
                        Row(Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween) {
                            listOf("corners", "dangerous_attacks", "on_target").forEach { key ->
                                val stat = facts?.stat(key)
                                Text((if (fa) stat?.fa ?: key else stat?.en ?: key) +
                                    " " + (stat?.home ?: "—") + ":" + (stat?.away ?: "—"),
                                    color = pipMuted, fontSize = 8.sp,
                                    maxLines = 1)
                            }
                        }
                    }
                } else {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(horizontal = 9.dp, vertical = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        if (facts?.stats.isNullOrEmpty()) {
                            Text(if (fa) "آمار تأییدشده برای این مسابقه موجود نیست."
                                else "No verified live statistics available.",
                                color = pipMuted, fontSize = 11.sp)
                        } else {
                            facts?.stats?.forEach { stat ->
                                val total = (stat.home ?: 0) + (stat.away ?: 0)
                                val ratio = if (stat.home != null && stat.away != null && total > 0)
                                    stat.home.toFloat() / total else null
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Text((stat.home ?: "—").toString(), fontSize = 10.sp,
                                        color = pipGreen, fontWeight = FontWeight.Bold)
                                    Text(if (fa) stat.fa else stat.en, modifier = Modifier.weight(1f),
                                        fontSize = 9.sp, color = Color.White,
                                        textAlign = TextAlign.Center, maxLines = 1)
                                    Text((stat.away ?: "—").toString(), fontSize = 10.sp,
                                        color = pipGold, fontWeight = FontWeight.Bold)
                                }
                                Row(Modifier.fillMaxWidth().height(3.dp)
                                    .background(Color(0xFF31515A))) {
                                    if (ratio != null) {
                                        Box(Modifier.fillMaxHeight().fillMaxWidth(ratio)
                                            .background(pipGreen))
                                        Box(Modifier.weight(1f).fillMaxHeight()
                                            .background(pipGold))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
