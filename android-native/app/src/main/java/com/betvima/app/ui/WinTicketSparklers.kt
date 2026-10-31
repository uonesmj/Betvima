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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Premium, quiet winning celebration.
 *
 * Tiny glassy mint, ice-white and champagne particles burst organically when
 * the confirmed win ticket opens. Fine comet tails and soft lens gleams replace
 * the previous large opaque explosive balls and concentric circles. A sparse
 * ambient drift persists while expanded, without changing the green outline.
 */
internal const val WIN_TICKET_LOOP_MS_207 = 7800
internal const val WIN_TICKET_INTRO_MS_207 = 2200

internal fun winBurstPhase223(open: Float, index: Int): Float =
    ((open - index * .115f) / .66f).coerceIn(0f, 1f)

@Composable
internal fun WinTicketSparklers(replay: Int, modifier: Modifier = Modifier) {
    val intro = remember { Animatable(0f) }
    val loopTransition = rememberInfiniteTransition(label = "winAmbientGleams223")
    val drift by loopTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(WIN_TICKET_LOOP_MS_207, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "refinedWinningParticles223"
    )
    LaunchedEffect(replay) {
        intro.snapTo(0f)
        intro.animateTo(1f, tween(WIN_TICKET_INTRO_MS_207, easing = LinearEasing))
    }

    Canvas(modifier) {
        val w = size.width
        val h = size.height
        if (w <= 1f || h <= 1f) return@Canvas

        val mint = Color(0xFF00CE95)
        val emerald = Color(0xFF067E6B)
        val ice = Color(0xFFF4FFFC)
        val champagne = Color(0xFFFFDBA0)
        val lap = drift * (2.0 * PI).toFloat()
        val breathing = (.5f + .5f * sin(lap.toDouble()).toFloat())

        // A restrained inner sheen rather than a border or a solid light ball.
        val upperLight = Offset(w * .51f, h * .075f)
        val halo = Brush.radialGradient(
            colors = listOf(
                mint.copy(alpha = .11f + breathing * .045f),
                ice.copy(alpha = .025f),
                Color.Transparent
            ),
            center = upperLight,
            radius = (w * .46f).coerceAtLeast(1f)
        )
        drawCircle(brush = halo, radius = (w * .46f).coerceAtLeast(1f),
            center = upperLight)

        // Quiet floating motes; deterministic positions, no random flicker.
        repeat(38) { i ->
            val seed = i.toFloat()
            val phase = (drift + seed * .08671f) % 1f
            val xSeed = ((i * 31 + 11) % 97) / 97f
            val sway = sin((phase * 2f * PI + seed * .72f).toDouble()).toFloat() * .014f
            val x = (w * (xSeed + sway)).coerceIn(4f, w - 4f)
            val y = h * (1.08f - 1.17f * phase)
            val opacity = (sin(phase * PI).toFloat().coerceAtLeast(0f)) *
                (if (i % 7 == 0) .48f else .26f)
            val center = Offset(x, y)
            val tint = when (i % 5) {
                0 -> champagne
                1, 3 -> ice
                else -> mint
            }
            val dot = (if (i % 8 == 0) 1.8f else 1.05f).dp.toPx()
            drawCircle(tint.copy(alpha = opacity * .15f), radius = dot * 3f,
                center = center)
            drawCircle(tint.copy(alpha = opacity), radius = dot,
                center = center)
        }

        // Four asymmetric, staggered clusters of fine, spherical sparks.
        // Each spark has a narrow tapered tail and decelerates with light gravity.
        val open = intro.value
        repeat(4) { burst ->
            val p = winBurstPhase223(open, burst)
            if (open < burst * .115f || p >= 1f) return@repeat

            val center = Offset(
                w * listOf(.17f, .76f, .43f, .64f)[burst],
                h * listOf(.14f, .19f, .38f, .53f)[burst]
            )
            val fade = (1f - p) * (1f - p)
            // Compact glass lens glint at the instant of release.
            val gleamSize = (5.0f + 14f * p).dp.toPx()
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(ice.copy(alpha = fade * .26f),
                        mint.copy(alpha = fade * .07f), Color.Transparent),
                    center = center, radius = gleamSize.coerceAtLeast(1f)
                ),
                radius = gleamSize.coerceAtLeast(1f),
                center = center
            )
            val count = 17 + (burst % 2) * 4
            repeat(count) { i ->
                val angle = 2.0 * PI * ((i + .19 * burst) / count) +
                    .22 * sin((i * 7 + burst * 3).toDouble())
                val vx = cos(angle).toFloat()
                val vy = sin(angle).toFloat()
                val variation = .71f + ((i * 13 + burst * 7) % 11) * .036f
                val distance = (13f + (40f + (i % 5) * 5f) * (p - .10f * p * p)) *
                    variation * .8f
                val rise = h.coerceAtMost(750f) * .028f * p * p
                val position = Offset(
                    center.x + vx * distance.dp.toPx(),
                    center.y + vy * distance.dp.toPx() + rise
                )
                val tail = 5.7.dp.toPx() * (1f - p * .62f)
                val prev = Offset(position.x - vx * tail, position.y - vy * tail)
                val tint = when (i % 6) {
                    0 -> champagne
                    1, 3 -> ice
                    2 -> emerald
                    else -> mint
                }
                val opacity = fade * (if (i % 4 == 0) .89f else .71f)
                val size = (if (i % 7 == 0) 2.35f else 1.4f).dp.toPx()
                drawLine(
                    tint.copy(alpha = opacity * .47f),
                    start = prev, end = position,
                    strokeWidth = (if (i % 7 == 0) 1.0f else .68f).dp.toPx(),
                    cap = StrokeCap.Round
                )
                drawCircle(tint.copy(alpha = opacity * .16f),
                    radius = size * 2.65f, center = position)
                drawCircle(tint.copy(alpha = opacity),
                    radius = size, center = position)
                if (i % 9 == 0) {
                    val line = (3.5f + p * 2f).dp.toPx()
                    drawLine(ice.copy(alpha = opacity * .4f),
                        Offset(position.x - line, position.y),
                        Offset(position.x + line, position.y),
                        strokeWidth = .65.dp.toPx())
                    drawLine(ice.copy(alpha = opacity * .4f),
                        Offset(position.x, position.y - line),
                        Offset(position.x, position.y + line),
                        strokeWidth = .65.dp.toPx())
                }
            }
        }
    }
}
