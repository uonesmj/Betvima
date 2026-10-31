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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Read-only losing-ticket celebration, a red counterpart to the existing
 * WinTicketSparklers. Does not touch the Win implementation or any bet state.
 * The effect finishes once after each real card expansion, never looping.
 */
internal const val LOSS_BURST_INTRO_MS_232 = 1950

internal fun lossBurstPhase232(open: Float, burst: Int): Float =
    ((open - burst * .11f) / .64f).coerceIn(0f, 1f)

@Composable
internal fun LossTicketSparklers232(
    replay: Int,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit = {}
) {
    val intro = remember { Animatable(0f) }

    LaunchedEffect(replay) {
        intro.snapTo(0f)
        intro.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = LOSS_BURST_INTRO_MS_232,
                easing = LinearEasing
            )
        )
        onComplete()
    }

    Canvas(modifier) {
        val w = size.width
        val h = size.height
        if (w <= 1f || h <= 1f) return@Canvas
        val open = intro.value
        if (open >= 1f) return@Canvas

        val ruby = Color(0xFFEF496A)
        val crimson = Color(0xFFB51B44)
        val coral = Color(0xFFFF8195)
        val rose = Color(0xFFFFE5E9)
        val scarlet = Color(0xFFFF354F)

        // A brief glassy reflection over the burgundy ticket header,
        // rather than a new border, red sheet, or distracting full-card flash.
        val sweep = ((open - .04f) / .46f).coerceIn(0f, 1f)
        if (sweep < 1f && open >= .04f) {
            val sheen = sin(sweep * PI).toFloat().coerceAtLeast(0f)
            val center = Offset(w * (.16f + .72f * sweep), h * .065f)
            val radius = (w * .20f).coerceAtLeast(1f)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        rose.copy(alpha = .17f * sheen),
                        coral.copy(alpha = .07f * sheen),
                        Color.Transparent
                    ),
                    center = center, radius = radius
                ),
                radius = radius, center = center
            )
        }

        // Four slightly staggered miniature bursts, matching the restrained
        // glass-particle aesthetic of Win without modifying that component.
        repeat(4) { burst ->
            val p = lossBurstPhase232(open, burst)
            if (open < burst * .11f || p >= 1f) return@repeat
            val origin = Offset(
                w * listOf(.19f, .78f, .43f, .65f)[burst],
                h * listOf(.13f, .17f, .34f, .48f)[burst]
            )
            val fade = (1f - p) * (1f - p)
            val glowRadius = (7f + 19f * p).dp.toPx()
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        rose.copy(alpha = fade * .21f),
                        ruby.copy(alpha = fade * .11f),
                        Color.Transparent
                    ),
                    center = origin,
                    radius = glowRadius
                ),
                radius = glowRadius, center = origin
            )

            val count = 18 + (burst % 2) * 4
            repeat(count) { i ->
                val angle = 2.0 * PI * (i.toDouble() / count +
                    burst * .037) + .17 * sin((i * 5 + burst * 7).toDouble())
                val vx = cos(angle).toFloat()
                val vy = sin(angle).toFloat()
                val speed = .68f + ((i * 11 + burst * 3) % 9) * .056f
                val distance = ((8f + (26f + (i % 5) * 4.6f) *
                    (p - p * p * .15f)) * speed).dp.toPx()
                val gravity = (p * p * (12f + i % 5)).dp.toPx()
                val center = Offset(
                    origin.x + vx * distance,
                    origin.y + vy * distance + gravity
                )
                val tailLength = (5f * (1f - p * .66f)).dp.toPx()
                val prev = Offset(
                    center.x - vx * tailLength,
                    center.y - vy * tailLength
                )
                val tint = when (i % 7) {
                    0 -> rose
                    1, 4 -> coral
                    2 -> crimson
                    3 -> scarlet
                    else -> ruby
                }
                val strength = fade * (if (i % 5 == 0) .92f else .71f)
                val particleRadius = (if (i % 8 == 0) 1.9f else 1.15f).dp.toPx()
                drawLine(
                    color = tint.copy(alpha = strength * .48f),
                    start = prev, end = center,
                    strokeWidth = .8.dp.toPx(), cap = StrokeCap.Round
                )
                drawCircle(
                    color = tint.copy(alpha = strength * .15f),
                    radius = particleRadius * 2.4f, center = center
                )
                drawCircle(
                    color = tint.copy(alpha = strength),
                    radius = particleRadius, center = center
                )
                if (i % 10 == 0) {
                    val ray = 3.2.dp.toPx()
                    drawLine(
                        rose.copy(alpha = strength * .48f),
                        Offset(center.x - ray, center.y),
                        Offset(center.x + ray, center.y),
                        strokeWidth = .7.dp.toPx()
                    )
                    drawLine(
                        rose.copy(alpha = strength * .48f),
                        Offset(center.x, center.y - ray),
                        Offset(center.x, center.y + ray),
                        strokeWidth = .7.dp.toPx()
                    )
                }
            }
        }

        // Rare drifting ember dust that naturally fades without ever looping.
        repeat(22) { i ->
            val t = ((open + i * .071f) % 1f)
            val fade = sin(t * PI).toFloat().coerceAtLeast(0f) *
                (1f - open) * .28f
            val x = w * (((i * 41 + 17) % 97) / 97f)
            val y = h * (1.03f - 1.10f * t)
            val center = Offset(x, y)
            drawCircle(
                color = (if (i % 4 == 0) rose else ruby).copy(alpha = fade),
                radius = (if (i % 6 == 0) 1.6f else 1.05f).dp.toPx(),
                center = center
            )
        }
    }
}
