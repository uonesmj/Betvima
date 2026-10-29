package com.betvima.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Premium visual effect, not a representation of a wager or new payout.
 * Runs only while a confirmed winning ticket is expanded.
 * An energetic gold/mint opening burst transitions into a soft, indefinite
 * orbit of luminous particles, edge glow and travelling light. Never touches
 * financial state, network, clicks, or the settlement result.
 */
internal const val WIN_TICKET_LOOP_MS_207 = 6400
internal const val WIN_TICKET_INTRO_MS_207 = 1700

@Composable
internal fun WinTicketSparklers(replay: Int, modifier: Modifier = Modifier) {
    val intro = remember { Animatable(0f) }
    val loopTransition = rememberInfiniteTransition(label = "winningTicketAurora207")
    val loop by loopTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = WIN_TICKET_LOOP_MS_207, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "continuousMintGoldParticles207"
    )
    LaunchedEffect(replay) {
        intro.snapTo(0f)
        intro.animateTo(1f, tween(WIN_TICKET_INTRO_MS_207, easing = LinearEasing))
    }

    Canvas(modifier) {
        val w = size.width
        val h = size.height
        if (w <= 1f || h <= 1f) return@Canvas
        val golden = Color(0xFFFFCD72)
        val mint = Color(0xFF00D49A)
        val pearl = Color(0xFFF6FFF8)
        val lap = loop * (2f * PI).toFloat()
        val softPulse = (sin(lap.toDouble()).toFloat() + 1f) * .5f

        // A continuously breathing, low-opacity halo at the ticket's top edge.
        val halo = Brush.radialGradient(
            colors = listOf(mint.copy(alpha = .14f + softPulse * .09f),
                golden.copy(alpha = .04f), Color.Transparent),
            center = Offset(w * .52f, h * .10f),
            radius = (w * .67f).coerceAtLeast(2f)
        )
        drawCircle(brush = halo, radius = w * .67f,
            center = Offset(w * .52f, h * .10f))

        // Continuous travelling gleam on the green winning outline.
        drawRoundRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    mint.copy(alpha = .25f),
                    golden.copy(alpha = .52f + .22f * softPulse),
                    pearl.copy(alpha = .36f),
                    mint.copy(alpha = .20f)
                ),
                start = Offset(w * (loop - .23f), 0f),
                end = Offset(w * (loop + .64f), h * .55f)
            ),
            cornerRadius = CornerRadius(18.dp.toPx()),
            style = Stroke(width = 2.1.dp.toPx())
        )

        // 66 light motes; stable spatial seeds, slow drifting and elegant fades.
        repeat(66) { i ->
            val seed = i.toFloat()
            val phase = (loop + seed * .07831f) % 1f
            val xBase = ((i * 47 + 17) % 101) / 101f
            val sway = sin((phase * 2f * PI + seed * .83f).toDouble()).toFloat()
            val center = Offset(
                (w * (xBase + sway * .018f)).coerceIn(4f, w - 4f),
                h * (1.06f - phase * 1.13f)
            )
            val alpha = sin((phase * PI).toDouble()).toFloat()
                .coerceAtLeast(0f) * (if (i % 5 == 0) .75f else .41f)
            val c = when (i % 4) { 0, 1 -> golden; 2 -> mint; else -> pearl }
            val particleRadius = (if (i % 7 == 0) 2.3f else 1.35f).dp.toPx()
            drawCircle(c.copy(alpha = alpha * .21f), radius = particleRadius * 3.1f,
                center = center)
            drawCircle(c.copy(alpha = alpha), radius = particleRadius, center = center)
            if (i % 11 == 0) {
                val ray = 5.2.dp.toPx()
                drawLine(c.copy(alpha = alpha * .48f),
                    Offset(center.x - ray, center.y),
                    Offset(center.x + ray, center.y), strokeWidth = .8.dp.toPx())
                drawLine(c.copy(alpha = alpha * .48f),
                    Offset(center.x, center.y - ray),
                    Offset(center.x, center.y + ray), strokeWidth = .8.dp.toPx())
            }
        }

        // Opening cascade: three large, staggered champagne/mint fireworks.
        val open = intro.value
        repeat(3) { burst ->
            val launchDelay = burst * .145f
            val phase = ((open - launchDelay) / .68f).coerceIn(0f, 1f)
            if (open < launchDelay || phase >= 1f) return@repeat
            val fade = (1f - phase) * (1f - phase)
            val center = Offset(
                w * (0.20f + burst * .30f),
                h * (0.16f + (burst % 2) * .20f)
            )
            val color = if (burst % 2 == 0) golden else mint
            drawCircle(color.copy(alpha = .20f * fade),
                radius = (26f + 61f * phase).dp.toPx(), center = center)
            drawCircle(color.copy(alpha = .58f * fade),
                radius = (9f + 65f * phase).dp.toPx(),
                center = center, style = Stroke(width = 1.6.dp.toPx()))
            repeat(19) { ray ->
                val angle = ray * (2.0 * PI / 19.0) + burst * .26
                val dx = cos(angle).toFloat()
                val dy = sin(angle).toFloat()
                val length = (9f + (49f + ray % 5 * 6f) * phase).dp.toPx()
                val tail = (12f - 5f * phase).dp.toPx()
                val end = Offset(center.x + dx * length, center.y + dy * length)
                val start = Offset(end.x - dx * tail, end.y - dy * tail)
                val tint = when (ray % 3) { 0 -> golden; 1 -> mint; else -> pearl }
                drawLine(tint.copy(alpha = fade * .91f), start, end,
                    strokeWidth = (if (ray % 4 == 0) 2.5f else 1.35f).dp.toPx(),
                    cap = StrokeCap.Round)
                drawCircle(tint.copy(alpha = fade), center = end,
                    radius = (if (ray % 4 == 0) 3.7f else 2.2f).dp.toPx())
            }
        }
    }
}
