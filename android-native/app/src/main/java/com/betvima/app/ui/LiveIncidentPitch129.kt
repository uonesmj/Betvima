package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
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
            drawRect(Color(0xFF125E40))
            repeat(10) { i ->
                if (i % 2 == 0) drawRect(
                    Color.White.copy(alpha = .045f),
                    Offset(w * i / 10f, 0f), Size(w / 10f, h)
                )
            }
            val line = Color(0xFFF1FFF5).copy(alpha = .67f)
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
            if (cue != null) {
                val p = progress.value
                val direction = if (home) 1f else -1f
                val x = w * (if (home) .16f + p * .65f else .84f - p * .65f)
                val y = h * .5f
                val visibleAlpha = (1f - p * .35f).coerceIn(0f, 1f)
                // Attack direction is illustrative. No dot is drawn as "ball".
                for (trail in 0..3) {
                    val trailX = x - direction * w * trail * .058f
                    if (trailX in w * .03f..w * .97f) {
                        drawLine(tint.copy(alpha = (0.40f - trail * .07f) * visibleAlpha),
                            Offset(trailX - direction * w * .035f, y),
                            Offset(trailX + direction * w * .015f, y),
                            width = (4 - trail).dp.toPx())
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
            enter = fadeIn(tween(180)) + scaleIn(initialScale = .85f),
            exit = fadeOut(tween(260)) + scaleOut(targetScale = .92f),
            modifier = Modifier.fillMaxWidth(.85f)
        ) {
            if (cue != null) {
                val title = incidentCaption129(cue.kind, fa)
                val team = if (cue.side == IncidentSide129.HOME)
                    match.home.name else match.away.name
                val serious = cue.kind == IncidentKind129.GOAL
                Surface(
                    color = Color(0xED071E24),
                    shape = RoundedCornerShape(15.dp),
                    shadowElevation = 10.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp, tint.copy(alpha = .7f))
                ) {
                    Column(Modifier.padding(horizontal = 9.dp, vertical = 11.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        val graphic = when(cue.kind) {
                            IncidentKind129.CORNER -> Icons.Default.Flag
                            IncidentKind129.RED_CARD, IncidentKind129.YELLOW_CARD,
                            IncidentKind129.FOUL, IncidentKind129.OFFSIDE -> Icons.Default.Warning
                            IncidentKind129.ATTACK, IncidentKind129.DANGEROUS_ATTACK ->
                                Icons.Default.Bolt
                            else -> Icons.Default.SportsSoccer
                        }
                        Icon(graphic, contentDescription = null, tint = tint,
                            modifier = Modifier.size(if (serious) 28.dp else 23.dp))
                        Text(title, color = cueWhite129, fontWeight = FontWeight.Black,
                            fontSize = if (serious) 15.sp else 13.sp,
                            textAlign = TextAlign.Center)
                        Text(team, color = tint, fontWeight = FontWeight.Bold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            fontSize = 10.sp)
                        Text(
                            (if (cue.confirmedScore) {
                                if (fa) "نتیجهٔ تأییدشده" else "Verified score change"
                            } else {
                                if (fa) "تغییر آمار +" else "Stat update +"
                            }) + (if (cue.confirmedScore) "" else cue.amount.toString()) +
                                "  ·  " + (cue.minute?.toString()?.plus("′") ?: "LIVE"),
                            color = Color(0xFFD1DFE0), fontSize = 9.sp,
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
