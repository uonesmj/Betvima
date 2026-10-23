package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match
import kotlin.math.min

private val cueGreen129 = Color(0xFF3EF7AE)
private val cueGold129 = Color(0xFFFFCB79)
private val cueWhite129 = Color(0xFFEFFFF8)

/**
 * The moving glow is a schematic ATTACK-DIRECTION cue. It is explicitly
 * not the location of the actual match ball, or a positional replay.
 */
@Composable
internal fun LiveIncidentPitch129(
    modifier: Modifier = Modifier,
    match: Match,
    cue: LiveIncidentCue129?,
    fa: Boolean
) {
    val activeLang177 = LocalNativeLanguage176.current
    // Visible activity even between provider observations is a decorative
    // pitch scan; it does NOT pretend to be actual ball/player movement.
    val ambient = rememberInfiniteTransition(label = "pitchAmbient131")
    val scan by ambient.animateFloat(
        initialValue = -.15f, targetValue = 1.15f,
        animationSpec = infiniteRepeatable(tween(5000, easing = LinearEasing)),
        label = "ambientFieldScan131"
    )
    val breathing by ambient.animateFloat(
        initialValue = .16f, targetValue = .6f,
        animationSpec = infiniteRepeatable(tween(1750), repeatMode = RepeatMode.Reverse),
        label = "stadiumPulse131"
    )
    val progress = remember { Animatable(0f) }
    LaunchedEffect(cue?.key) {
        progress.snapTo(0f)
        if (cue != null) progress.animateTo(1f, tween(1500))
    }
    val home = cue?.side == IncidentSide129.HOME
    val tint = when (cue?.kind) {
        IncidentKind129.GOAL -> cueGreen129
        IncidentKind129.RED_CARD -> Color(0xFFFF707C)
        IncidentKind129.YELLOW_CARD -> cueGold129
        IncidentKind129.SHOT_ON, IncidentKind129.SHOT_OFF,
        IncidentKind129.CORNER, IncidentKind129.PENALTY -> cueGold129
        else -> cueGreen129
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val stroke = 1.5.dp.toPx()
            drawRect(Brush.verticalGradient(listOf(
                Color(0xFF247954), Color(0xFF14583E), Color(0xFF103E36)
            )))
            repeat(12) { i ->
                if (i % 2 == 0) drawRect(
                    Color.White.copy(alpha = .042f),
                    Offset(w * i / 12f, 0f), Size(w / 12f, h)
                )
            }
            for (row in 1..7) {
                drawLine(Color.White.copy(alpha = .022f),
                    Offset(0f, h * row / 8f), Offset(w, h * row / 8f),
                    strokeWidth = .6.dp.toPx())
            }
            drawRect(Brush.horizontalGradient(listOf(
                Color(0x55091F1C), Color.Transparent, Color(0x44091F1C)
            )))
            // Continuous soft moving light, intentionally distinct from the
            // event-triggered attack direction. No fake ball marker.
            drawRect(brush = Brush.linearGradient(
                colors = listOf(Color.Transparent,
                    Color(0xFF93FBC9).copy(alpha = .105f * breathing),
                    Color.Transparent),
                start = Offset(w * (scan - .20f), 0f),
                end = Offset(w * (scan + .20f), h)
            ))
            // The narrow scan beam visibly traverses the entire pitch even
            // when an upstream match counter has not changed.
            drawLine(
                color = Color(0xFFB1FFE0).copy(alpha = .14f + breathing * .16f),
                start = Offset(w * scan, h * .07f),
                end = Offset(w * scan, h * .93f),
                strokeWidth = 2.dp.toPx()
            )
            drawLine(
                color = Color(0xFFB1FFE0).copy(alpha = .10f + breathing * .09f),
                start = Offset(w * .5f, h * .06f),
                end = Offset(w * .5f, h * .94f),
                strokeWidth = 2.dp.toPx()
            )
            val line = Color(0xFFF1FFF5).copy(alpha = .74f)
            drawRect(line, Offset(w * .035f, h * .06f),
                Size(w * .93f, h * .88f), style = Stroke(stroke))
            drawLine(line, Offset(w * .5f, h * .06f),
                Offset(w * .5f, h * .94f), stroke)
            drawCircle(line, min(w * .115f, h * .20f),
                Offset(w * .5f, h * .5f), style = Stroke(stroke))
            drawCircle(line, stroke * 1.2f, Offset(w * .5f, h * .5f))
            drawRect(line, Offset(w * .035f, h * .255f),
                Size(w * .165f, h * .49f), style = Stroke(stroke))
            drawRect(line, Offset(w * .80f, h * .255f),
                Size(w * .165f, h * .49f), style = Stroke(stroke))
            drawRect(line, Offset(w * .035f, h * .38f),
                Size(w * .07f, h * .24f), style = Stroke(stroke))
            drawRect(line, Offset(w * .895f, h * .38f),
                Size(w * .07f, h * .24f), style = Stroke(stroke))
            // Penalty spots and goal mouths add clarity without depicting players.
            drawCircle(line, stroke * 1.2f, Offset(w * .13f, h * .5f))
            drawCircle(line, stroke * 1.2f, Offset(w * .87f, h * .5f))
            drawLine(line.copy(alpha = .8f), Offset(w * .035f, h * .41f),
                Offset(w * .005f, h * .41f), stroke)
            drawLine(line.copy(alpha = .8f), Offset(w * .035f, h * .59f),
                Offset(w * .005f, h * .59f), stroke)
            drawLine(line.copy(alpha = .8f), Offset(w * .965f, h * .41f),
                Offset(w * .995f, h * .41f), stroke)
            drawLine(line.copy(alpha = .8f), Offset(w * .965f, h * .59f),
                Offset(w * .995f, h * .59f), stroke)
            if (cue != null) {
                val p = progress.value
                val direction = if (home) 1f else -1f
                val x = w * (if (home) .16f + p * .65f else .84f - p * .65f)
                val y = h * .5f
                val visibleAlpha = (1f - p * .35f).coerceIn(0f, 1f)
                // These are illustrative attack-lane streaks, NOT a moving football.
                drawCircle(
                    brush = Brush.radialGradient(
                        listOf(tint.copy(alpha = .22f * visibleAlpha), Color.Transparent),
                        center = Offset(x, y), radius = h * .36f
                    ),
                    radius = h * .36f, center = Offset(x, y)
                )
                for (trail in 0..4) {
                    val trailX = x - direction * w * trail * .058f
                    if (trailX in w * .03f..w * .97f) {
                        drawLine(tint.copy(alpha = (0.43f - trail * .07f) * visibleAlpha),
                            Offset(trailX - direction * w * .035f, y),
                            Offset(trailX + direction * w * .015f, y),
                            strokeWidth = (4 - trail).dp.toPx())
                    }
                }
                val arrow = Path().apply {
                    moveTo(x + direction * w * .038f, y)
                    lineTo(x - direction * w * .012f, y - h * .09f)
                    lineTo(x - direction * w * .012f, y + h * .09f)
                    close()
                }
                drawPath(arrow, tint.copy(alpha = .55f * visibleAlpha))
                drawRect(tint.copy(alpha = .10f * visibleAlpha),
                    Offset(if (home) w * .60f else w * .035f, h * .06f),
                    Size(w * .36f, h * .88f))
            }
        }
        AnimatedVisibility(
            visible = cue != null,
            enter = fadeIn(tween(220)) + scaleIn(initialScale = .82f),
            exit = fadeOut(tween(260)) + scaleOut(targetScale = .92f),
            modifier = Modifier.align(Alignment.TopCenter)
                .fillMaxWidth(.67f).padding(top = 7.dp)
        ) {
            if (cue != null) {
                val title = incidentCaption129(cue.kind, fa)
                val team = if (cue.side == IncidentSide129.HOME)
                    match.home.name else match.away.name
                val serious = cue.kind == IncidentKind129.GOAL
                Surface(
                    color = Color(0xED061E25),
                    shape = RoundedCornerShape(12.dp),
                    shadowElevation = 12.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp, tint.copy(alpha = .75f))
                ) {
                    Column(Modifier
                        .background(Brush.verticalGradient(
                            listOf(tint.copy(alpha = .14f), Color.Transparent)))
                        .padding(horizontal = 8.dp, vertical = 7.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        val graphic = when(cue.kind) {
                            IncidentKind129.CORNER -> Icons.Default.Flag
                            IncidentKind129.RED_CARD, IncidentKind129.YELLOW_CARD,
                            IncidentKind129.FOUL, IncidentKind129.OFFSIDE -> Icons.Default.Warning
                            IncidentKind129.ATTACK, IncidentKind129.DANGEROUS_ATTACK ->
                                Icons.Default.Bolt
                            else -> Icons.Default.SportsSoccer
                        }
                        Icon(graphic, contentDescription = null, tint = tint,
                            modifier = Modifier.size(if (serious) 19.dp else 16.dp))
                        Text(title, color = cueWhite129, fontWeight = FontWeight.Black,
                            fontSize = if (serious) 12.sp else 11.sp,
                            textAlign = TextAlign.Center)
                        Text(team, color = tint, fontWeight = FontWeight.Bold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            fontSize = 9.sp)
                        Text(
                            (if (cue.confirmedScore) {
                                tr(activeLang177, "Verified score change", "نتیجهٔ تأییدشده")
                            } else {
                                tr(activeLang177, "Stat update +", "تغییر آمار +")
                            }) + (if (cue.confirmedScore) "" else cue.amount.toString()) +
                                "  ·  " + (cue.minute?.toString()?.plus("′") ?: "LIVE"),
                            color = Color(0xFFD1DFE0), fontSize = 7.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun IncidentStatsCue129(cue: LiveIncidentCue129?, match: Match, fa: Boolean) {
    val activeLang177 = LocalNativeLanguage176.current
    AnimatedVisibility(visible = cue != null,
        enter = fadeIn(), exit = fadeOut()) {
        if(cue != null) {
            val team = if (cue.side == IncidentSide129.HOME) match.home.name else match.away.name
            Text(
                team + " · " + incidentCaption129(cue.kind, fa) + " +" + cue.amount,
                modifier = Modifier.fillMaxWidth().background(
                    Color(0xFF1D6148), RoundedCornerShape(9.dp))
                    .padding(horizontal = 9.dp, vertical = 6.dp),
                color = Color.White, fontSize = 10.sp, maxLines = 1,
                overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center
            )
        }
    }
}
