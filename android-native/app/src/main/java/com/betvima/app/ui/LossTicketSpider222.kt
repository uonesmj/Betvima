package com.betvima.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.sin

/** Purely decorative, one-shot animation shown only on a confirmed lost ticket.
 * Starts at the lower-left edge, crawls along a curved line, then shrinks into
 * the actual Lost status chip. Does not change financial or selection state.
 */
internal const val LOSS_SPIDER_DELAY_MS_222 = 460L
internal const val LOSS_SPIDER_DURATION_MS_222 = 1900
internal const val LOSS_SPIDER_TOTAL_MS_222 =
    LOSS_SPIDER_DELAY_MS_222 + LOSS_SPIDER_DURATION_MS_222

/** Keep the curve independent of pixels and avoid any layout-specific hardcoded badge X. */
internal fun lossSpiderPoint222(
    start: Offset, end: Offset, width: Float, height: Float, progress: Float
): Offset {
    val t = progress.coerceIn(0f, 1f)
    val remaining = 1f - t
    val c1 = Offset(width * .06f, height * .56f)
    val c2 = Offset(width * .60f, height * .16f)
    return start * (remaining * remaining * remaining) +
        c1 * (3f * remaining * remaining * t) +
        c2 * (3f * remaining * t * t) +
        end * (t * t * t)
}

@Composable
internal fun LossTicketSpider222(
    replay: Int,
    badgeTarget: Offset?,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    val progress = remember { Animatable(0f) }

    // The badge must be laid out before the spider can accurately enter it.
    // Cancellation on card close stops the effect immediately, with no loop.
    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(
            1f, animationSpec = tween(
                durationMillis = LOSS_SPIDER_DURATION_MS_222,
                easing = FastOutSlowInEasing
            )
        )
        onComplete()
    }

    Canvas(modifier) {
        val end = badgeTarget ?: return@Canvas
        val w = size.width
        val h = size.height
        if (w <= 1f || h <= 1f) return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas

        val start = Offset(24.dp.toPx(), h - 22.dp.toPx())
        val destination = Offset(
            end.x.coerceIn(12.dp.toPx(), w - 12.dp.toPx()),
            end.y.coerceIn(12.dp.toPx(), h - 12.dp.toPx())
        )
        val center = lossSpiderPoint222(start, destination, w, h, t)
        // The spider appears from below the ticket and becomes smaller as it
        // enters the pale-pink Lost chip, instead of covering the status label.
        val exit = ((t - .76f) / .24f).coerceIn(0f, 1f)
        val visibility = (1f - exit * exit).coerceIn(0f, 1f)
        val bodySize = 12.dp.toPx() * (1f - exit * .78f)
        val violet = Color(0xFF652044)
        val pink = Color(0xFFDE668D)
        val cream = Color(0xFFFFF3FA)

        // A short, vanishing silk trace emphasizes the diagonal crawl.
        // It never forms an outer border around the ticket.
        for (i in 0 until 10) {
            val from = (t - (i + 1) * .016f).coerceAtLeast(0f)
            val to = (t - i * .016f).coerceAtLeast(0f)
            if (to <= from || t <= .01f) continue
            drawLine(
                color = pink.copy(alpha = (.29f - i * .024f) * visibility),
                start = lossSpiderPoint222(start, destination, w, h, from),
                end = lossSpiderPoint222(start, destination, w, h, to),
                strokeWidth = 1.45.dp.toPx(),
                cap = StrokeCap.Round
            )
        }

        drawCircle(pink.copy(alpha = .14f * visibility),
            radius = bodySize * 2.15f, center = center)

        // Eight articulated legs; a subtle alternating phase makes the crawl
        // feel organic without repeating or running while the ticket is closed.
        for (side in listOf(-1f, 1f)) {
            for (leg in 0 until 4) {
                val row = leg - 1.5f
                val gait = sin((t * 27f + leg * 1.42f + (if (side > 0) PI else 0.0)).toDouble()).toFloat()
                val root = Offset(
                    center.x + side * bodySize * .30f,
                    center.y + row * bodySize * .24f
                )
                val knee = Offset(
                    center.x + side * bodySize * (1.04f + leg * .035f),
                    center.y + row * bodySize * .55f - gait * bodySize * .13f
                )
                val foot = Offset(
                    center.x + side * bodySize * (1.40f + (1.5f - kotlin.math.abs(row)) * .17f),
                    center.y + row * bodySize * .98f + gait * bodySize * .14f
                )
                val legPath = Path().apply {
                    moveTo(root.x, root.y)
                    quadraticBezierTo(knee.x, knee.y, foot.x, foot.y)
                }
                drawPath(
                    path = legPath, color = cream.copy(alpha = visibility * .94f),
                    style = Stroke(width = 3.25.dp.toPx() * (bodySize / 12.dp.toPx()),
                        cap = StrokeCap.Round)
                )
                drawPath(
                    path = legPath, color = violet.copy(alpha = visibility),
                    style = Stroke(width = 1.85.dp.toPx() * (bodySize / 12.dp.toPx()),
                        cap = StrokeCap.Round)
                )
            }
        }
        drawCircle(cream.copy(alpha = visibility),
            radius = bodySize * .93f, center = Offset(center.x, center.y + bodySize * .30f))
        drawCircle(violet.copy(alpha = visibility),
            radius = bodySize * .78f, center = Offset(center.x, center.y + bodySize * .30f))
        drawCircle(cream.copy(alpha = visibility),
            radius = bodySize * .67f, center = Offset(center.x, center.y - bodySize * .63f))
        drawCircle(violet.copy(alpha = visibility),
            radius = bodySize * .53f, center = Offset(center.x, center.y - bodySize * .63f))
        for (side in listOf(-1f, 1f)) {
            drawCircle(cream.copy(alpha = visibility), radius = bodySize * .125f,
                center = Offset(
                    center.x + side * bodySize * .18f,
                    center.y - bodySize * .76f
                )
            )
        }

        if (t > .88f) {
            val impact = ((t - .88f) / .12f).coerceIn(0f, 1f)
            drawCircle(
                color = pink.copy(alpha = (1f - impact) * .52f),
                radius = (8f + impact * 13f).dp.toPx(),
                center = destination,
                style = Stroke(width = 1.5.dp.toPx())
            )
        }
    }
}
