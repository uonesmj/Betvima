package com.betvima.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * A discreet, one-shot celebration over a *confirmed winning* ticket.
 *
 * The caller increments [replay] only for a user-initiated open. This Canvas
 * has no touch handling, runs for under 1.1s, and never changes bet data.
 * The draw path is deterministic and does not allocate images or spawn jobs.
 */
@Composable
internal fun WinTicketSparklers(replay: Int, modifier: Modifier = Modifier) {
    val timeline = remember { Animatable(1f) }
    LaunchedEffect(replay) {
        if (replay > 0) {
            timeline.snapTo(0f)
            timeline.animateTo(1f, tween(durationMillis = 1060, easing = LinearEasing))
        }
    }

    if (timeline.value >= 1f) return

    Canvas(modifier) {
        val progress = timeline.value
        val colors = listOf(
            Color(0xFFFFD68C), // warm champagne
            Color(0xFFB5FFE3), // BetVima mint
            Color(0xFFFAFFF8)  // white sparkle
        )
        for (burst in 0 until 3) {
            // Sequential miniature fireworks: not a screen-wide confetti shower.
            val delay = burst * 0.115f
            val phase = ((progress - delay) / 0.67f).coerceIn(0f, 1f)
            if (progress < delay || phase >= 1f) continue
            val fade = (1f - phase) * (1f - phase)
            val center = Offset(
                size.width * (0.24f + burst * 0.26f),
                (37f + if (burst == 1) 13f else 0f).dp.toPx()
            )

            // Faint halo/ring gives the burst a luminous beginning.
            drawCircle(
                color = colors[burst].copy(alpha = 0.14f * fade),
                radius = (11f + 20f * phase).dp.toPx(),
                center = center
            )
            drawCircle(
                color = colors[burst].copy(alpha = 0.37f * fade),
                radius = (5f + 21f * phase).dp.toPx(),
                center = center,
                style = Stroke(width = 1.1.dp.toPx())
            )

            repeat(11) { ray ->
                val angle = (ray * (2.0 * PI / 11.0)) + (burst * 0.28)
                val directionX = cos(angle).toFloat()
                val directionY = sin(angle).toFloat()
                val length = (8f + (35f + ray % 3 * 3f) * phase).dp.toPx()
                val tail = (6.5f - 2.5f * phase).dp.toPx()
                val end = Offset(center.x + directionX * length,
                    center.y + directionY * length + 4.dp.toPx() * phase * phase)
                val start = Offset(end.x - directionX * tail, end.y - directionY * tail)
                val tint = colors[(ray + burst) % colors.size]
                drawLine(
                    color = tint.copy(alpha = fade * 0.86f),
                    start = start, end = end,
                    strokeWidth = (if (ray % 3 == 0) 1.8f else 1.1f).dp.toPx(),
                    cap = StrokeCap.Round
                )
                drawCircle(
                    color = tint.copy(alpha = fade),
                    center = end,
                    radius = (if (ray % 3 == 0) 2.5f else 1.7f).dp.toPx() *
                        (1f - 0.45f * phase)
                )
            }
        }
    }
}
