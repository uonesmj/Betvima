package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Brush
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

private val pipBackground = Color.Black
private val pipGreen = premiumMint130
private val pipGold = premiumAmber130
private val pipMuted = premiumMuted130
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
    val activeLang177 = LocalNativeLanguage176.current
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val width = minOf(284, (configuration.screenWidthDp - 20).coerceAtLeast(190)).dp
    val height = minOf(326, (configuration.screenHeightDp - 100).coerceAtLeast(190)).dp
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
    val observations = remember(match.id) { mutableStateListOf<PressureSample130>() }
    val recentEvents = remember(match.id) { mutableStateListOf<LiveIncidentCue129>() }
    var previous by remember(match.id) { mutableStateOf<LiveMatchFacts?>(null) }
    var currentIncident by remember(match.id) { mutableStateOf<LiveIncidentCue129?>(null) }
    val events = remember(match.id) {
        kotlinx.coroutines.channels.Channel<LiveIncidentCue129>(capacity = 8)
    }
    // First sample is a baseline, not a replay of historical incidents.
    LaunchedEffect(match.id, facts?.observedAt) {
        val newCues = observedIncidents129(previous, facts)
        previous = facts
        if (newCues.isNotEmpty()) {
            recentEvents.addAll(0, newCues)
            while (recentEvents.size > 36) recentEvents.removeAt(recentEvents.lastIndex)
        }
        val ratio = pressureRatio130(facts)
        val last = observations.lastOrNull()
        if (ratio != null && facts != null && last?.id != facts.observedAt) {
            observations.add(PressureSample130(facts.observedAt, ratio, facts.minute))
            while (observations.size > 30) observations.removeAt(0)
        }
        newCues.forEach { events.trySend(it) }
    }
    LaunchedEffect(match.id) {
        for (incident in events) {
            currentIncident = incident
            delay(incident.durationMs)
            currentIncident = null
            delay(220)
        }
    }

    val share = pressureRatio130(facts)
    val livePulse = rememberInfiniteTransition(label = "livePulse130")
    val pulseAlpha by livePulse.animateFloat(initialValue = .40f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "liveAlpha130")

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
                .border(1.dp, Color(0xFF363636), RoundedCornerShape(18.dp)),
            shape = RoundedCornerShape(18.dp),
            shadowElevation = 22.dp,
            color = pipBackground
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth().height(37.dp)
                        .background(Color.Black),
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
                        Box(Modifier.size(7.dp)
                            .background(pipGreen.copy(alpha = pulseAlpha), CircleShape))
                        Spacer(Modifier.width(6.dp))
                        Text("⠿", fontSize = 15.sp, color = pipMuted)
                        Spacer(Modifier.width(5.dp))
                        Text(tr(activeLang177, "LIVE", "زنده"),
                            color = pipGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Spacer(Modifier.width(5.dp))
                        Surface(color = Color(0xFF151515),
                            shape = RoundedCornerShape(7.dp),
                            border = BorderStroke(.5.dp, Color(0xFF444444))) {
                            Text(clockLabel, color = Color.White, fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp))
                        }
                    }
                    IconButton(onClick = onRefresh, modifier = Modifier.size(33.dp)) {
                        Icon(Icons.Default.Refresh,
                            contentDescription = tr(activeLang177, "Refresh", "تازه‌سازی"),
                            tint = pipMuted, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onClose, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Close,
                            contentDescription = tr(activeLang177, "Close window", "بستن پنجره"),
                            tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
                Row(
                    Modifier.fillMaxWidth().height(32.dp)
                        .background(Color.Black).padding(horizontal = 5.dp, vertical = 3.dp)
                ) {
                    listOf(
                        tr(activeLang177, "Pitch", "زمین"),
                        tr(activeLang177, "Stats", "آمار"),
                        tr(activeLang177, "Trend", "روند"),
                        tr(activeLang177, "Events", "رویداد")
                    ).forEachIndexed { i, label ->
                        Box(
                            modifier = Modifier.weight(1f).fillMaxHeight()
                                .background(if (selected == i) Color(0xFF202020) else Color.Transparent,
                                    RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            TextButton(onClick = { selected = i }, modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(0.dp)) {
                                Text(label, color = if (selected == i) Color.White else pipMuted,
                                    fontSize = 9.sp, fontWeight = FontWeight.Black, maxLines = 1)
                            }
                        }
                    }
                }
                when (selected) {
                    0 -> Column(
                        Modifier.fillMaxSize().padding(horizontal = 5.dp, vertical = 5.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (match.sport == "football") {
                            LiveIncidentPitch129(
                                modifier = Modifier.fillMaxWidth().weight(1f),
                                match = match, cue = currentIncident, fa = fa
                            )
                        } else Text(tr(activeLang177, "Match statistics", "آمار مسابقه"),
                            color = pipMuted, modifier = Modifier.weight(1f).fillMaxWidth(),
                            textAlign = TextAlign.Center)
                        PremiumPressureBar130(share, fa = fa, caption = true)
                        Text(tr(activeLang177, "Schematic animation · no ball tracking", "نمای شماتیک، نه مکان واقعی توپ"),
                            fontSize = 7.sp, color = pipMuted,
                            textAlign = TextAlign.Center, maxLines = 1,
                            modifier = Modifier.fillMaxWidth())
                    }
                    1 -> PremiumStatistics130(facts, fa, currentIncident, match)
                    2 -> PremiumMomentum130(observations.toList(), facts, fa)
                    else -> PremiumEvents130(recentEvents.toList(), match, fa)
                }
            }
        }
    }
}
