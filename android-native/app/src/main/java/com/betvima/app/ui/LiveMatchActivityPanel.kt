package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.LiveStat
import com.betvima.app.data.Match
import kotlinx.coroutines.delay

private data class MatchPulse114(
    val identity: String, val side: String, val label: String, val delta: Int
)
private val pulseKeys114 = setOf(
    "corners", "throwins", "fouls", "offsides", "yellowcards", "redcards",
    "attacks", "dangerous_attacks", "on_target", "off_target"
)

/**
 * Informational match-flow animation. The pitch graphic shows reported
 * ATTACK BALANCE, NOT tracking of the ball or guessed player locations.
 * Pulse only follows a confirmed counter increase between API snapshots.
 */
@Composable
internal fun LiveMatchActivityPanel(
    match: Match,
    facts: LiveMatchFacts?,
    fa: Boolean,
    expanded: Boolean,
    clockLabel: String
) {
    val activeLang177 = LocalNativeLanguage176.current
    var prior by remember(match.id) { mutableStateOf<LiveMatchFacts?>(null) }
    var pulse by remember(match.id) { mutableStateOf<MatchPulse114?>(null) }
    LaunchedEffect(facts?.observedAt, match.id) {
        val previous = prior
        prior = facts
        if (facts == null || previous == null || facts.observedAt == previous.observedAt) return@LaunchedEffect
        val found = facts.stats.firstNotNullOfOrNull { current ->
            if (current.key !in pulseKeys114) return@firstNotNullOfOrNull null
            val old = previous.stat(current.key) ?: return@firstNotNullOfOrNull null
            listOf("home", "away").firstNotNullOfOrNull { side ->
                val from = if (side == "home") old.home else old.away
                val to = if (side == "home") current.home else current.away
                val change = if (from != null && to != null) to - from else 0
                if (change > 0 && change <= if (current.key.contains("attack")) 8 else 3)
                    MatchPulse114(current.key + side + facts.observedAt,
                        side, tr(activeLang177, current.en, current.fa), change)
                else null
            }
        }
        if (found != null) {
            pulse = found
            delay(5_200)
            if (pulse?.identity == found.identity) pulse = null
        }
    }
    val attacks = facts?.stat("attacks") ?: facts?.stat("dangerous_attacks")
    val attackHome = attacks?.home
    val attackAway = attacks?.away
    val total = (attackHome ?: 0) + (attackAway ?: 0)
    val targetShare = if (total > 0) ((attackHome ?: 0).toFloat() / total.toFloat())
        .coerceIn(.05f, .95f) else .5f
    val share by animateFloatAsState(
        targetValue = targetShare,
        animationSpec = tween(durationMillis = 850),
        label = "verifiedAttackBalance"
    )
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            color = Color(0xFF0F5847),
            shadowElevation = 2.dp
        ) {
            Column(
                modifier = Modifier.background(
                    Brush.linearGradient(listOf(Color(0xFF0E604C), Color(0xFF153E43)))
                ).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Sensors, null, tint = Color(0xFF63E8BA),
                        modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(tr(activeLang177, "Live match flow", "جریان زنده مسابقه"),
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = Color.White, modifier = Modifier.weight(1f))
                    Surface(color = Color(0xFF12362F), shape = RoundedCornerShape(8.dp)) {
                        Text(clockLabel, color = Color(0xFFBBFFDB), fontSize = 14.sp,
                            fontWeight = FontWeight.Black, modifier = Modifier.padding(
                                horizontal = 9.dp, vertical = 4.dp))
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(match.home.name, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White,
                        modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    Text(match.away.name, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White,
                        modifier = Modifier.weight(1f))
                }
                Row(
                    Modifier.fillMaxWidth().height(9.dp)
                        .background(Color(0xFF10382F), RoundedCornerShape(12.dp))
                ) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(share)
                        .background(Color(0xFF50EBB3), RoundedCornerShape(12.dp)))
                    Box(Modifier.fillMaxHeight().weight(1f)
                        .background(Color(0xFFFFBE69), RoundedCornerShape(12.dp)))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text((attackHome?.toString() ?: "—") +
                            tr(activeLang177, " attacks", " حمله"),
                        fontSize = 10.sp, color = Color(0xFFCDF4E5))
                    Text((attackAway?.toString() ?: "—") +
                            tr(activeLang177, " attacks", " حمله"),
                        fontSize = 10.sp, color = Color(0xFFFFEACD))
                }
                AnimatedVisibility(visible = pulse != null) {
                    val activity = pulse
                    if (activity != null) {
                        Surface(color = Color(0xFF327E6C), shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()) {
                            Text(
                                (if (activity.side == "home") match.home.name else match.away.name) +
                                    "  +" + activity.delta + "  " + activity.label,
                                color = Color.White, fontWeight = FontWeight.Bold,
                                fontSize = 11.sp, modifier = Modifier.padding(9.dp)
                            )
                        }
                    }
                }
                if (pulse == null) Text(
                    tr(activeLang177, "Reported attack balance · not ball tracking", "نسبت حملات ثبت‌شده؛ نه مکان واقعی توپ"),
                    fontSize = 9.sp, color = Color(0xFFB4D9CF)
                )
            }
        }
        // Keep the score view compact: detailed metric cards are visible only
        // after the user selects the Live statistics tab.
        if (expanded) {
        val metrics = listOf(
            Triple("corners", "Corners", "کرنر"),
            Triple("attacks", "Attacks", "حمله"),
            Triple("fouls", "Fouls", "خطا"),
            Triple("throwins", "Throw-ins", "اوت"),
            Triple("offsides", "Offsides", "آفساید"),
            Triple("yellowcards", "Yellow cards", "کارت زرد"),
            Triple("redcards", "Red cards", "کارت قرمز"),
            Triple("on_target", "Shots on target", "شوت در چارچوب"),
            Triple("dangerous_attacks", "Dangerous attacks", "حملات خطرناک")
        )
        val shown = metrics
        shown.chunked(2).forEach { line ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                line.forEach { (key, english, persian) ->
                    val data = facts?.stat(key)
                    LiveMatchMetricChip(
                        modifier = Modifier.weight(1f),
                        title = tr(activeLang177, english, persian),
                        home = data?.home, away = data?.away,
                        highlighted = pulse?.identity?.startsWith(key) == true
                    )
                }
            }
        }
        }
        if (expanded && facts?.stats.isNullOrEmpty()) Text(
            tr(activeLang177, "No verified match statistics received for this fixture.", "آمار تأییدشده‌ای از API برای این بازی دریافت نشده است."),
            fontSize = 11.sp, color = Palette.muted
        )
    }
}

@Composable
private fun LiveMatchMetricChip(
    modifier: Modifier,
    title: String,
    home: Int?,
    away: Int?,
    highlighted: Boolean
) {
    val tint by animateColorAsState(
        if (highlighted) Color(0xFFDEFFF0) else Color.White,
        animationSpec = tween(500), label = "statChanged"
    )
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = tint,
        border = BorderStroke(1.dp, Color(0xFFDCE6ED))
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(title, color = Palette.muted, fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold, maxLines = 1)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(home?.toString() ?: "—", color = Palette.ink, fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold)
                Text(":", color = Palette.muted, fontSize = 13.sp)
                Text(away?.toString() ?: "—", color = Palette.ink, fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}
