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
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * A grounded, eight-legged black spider. No diagonal air-path or silk trail:
 * it climbs along the left rim of the actual ticket, rounds the upper corner,
 * then crawls across the header directly into the measured Lost badge.
 *
 * Composited over a server-confirmed lost ticket only. No touch handlers,
 * wager writes, balance changes, or changes to win animations.
 */
internal const val LOSS_SPIDER_DELAY_MS_222 = 520L
internal const val LOSS_SPIDER_DURATION_MS_222 = 3600
internal const val LOSS_SPIDER_TOTAL_MS_222 =
    LOSS_SPIDER_DELAY_MS_222 + LOSS_SPIDER_DURATION_MS_222

/**
 * Geometric surface path with near-constant traversal speed. The point starts
 * at the lower-left card rim, walks upward along that rim, rounds a quarter-
 * circle, and continues horizontally over the header to the badge center.
 * Input coordinates are pixels in the ticket's own canvas.
 */
internal fun lossSpiderPoint222(
    start: Offset, end: Offset, width: Float, height: Float, progress: Float
): Offset {
    val t = progress.coerceIn(0f, 1f)
    val radius = (width * .09f).coerceIn(14f, 46f)
    val rimX = start.x.coerceAtMost(end.x - radius - 2f)
    val rimBottom = start.y
    val turnY = end.y + radius
    val firstLength = (rimBottom - turnY).coerceAtLeast(0f)
    val curveLength = radius * (PI.toFloat() / 2f)
    val topStartX = rimX + radius
    val lastLength = (end.x - topStartX).coerceAtLeast(0f)
    val totalLength = (firstLength + curveLength + lastLength).coerceAtLeast(1f)
    val travelled = t * totalLength

    if (travelled <= firstLength) {
        return Offset(rimX, rimBottom - travelled)
    }
    if (travelled <= firstLength + curveLength) {
        val theta = ((travelled - firstLength) / radius).coerceIn(0f, PI.toFloat() / 2f)
        // Start at the left edge with upward tangent, exit with right tangent.
        return Offset(
            topStartX - radius * cos(theta),
            turnY - radius * sin(theta)
        )
    }
    return Offset(
        (topStartX + travelled - firstLength - curveLength).coerceAtMost(end.x),
        end.y
    )
}

@Composable
internal fun LossTicketSpider222(
    replay: Int,
    badgeTarget: Offset?,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    val progress = remember { Animatable(0f) }

    // Keeps the first frame still until the expansion and real badge layout end.
    // Closing the ticket removes this composable and cancels its coroutine.
    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(1f, tween(LOSS_SPIDER_DURATION_MS_222, easing = LinearEasing))
        onComplete()
    }

    Canvas(modifier) {
        val target = badgeTarget ?: return@Canvas
        val w = size.width
        val h = size.height
        if (w < 60f || h < 70f) return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas

        val start = Offset(23.dp.toPx(), h - 25.dp.toPx())
        val end = Offset(
            target.x.coerceIn(48.dp.toPx(), w - 12.dp.toPx()),
            target.y.coerceIn(12.dp.toPx(), h - 45.dp.toPx())
        )
        val contact = lossSpiderPoint222(start, end, w, h, t)
        val before = lossSpiderPoint222(start, end, w, h, (t - .003f).coerceAtLeast(0f))
        val after = lossSpiderPoint222(start, end, w, h, (t + .003f).coerceAtMost(1f))
        val delta = after - before
        val length = hypot(delta.x.toDouble(), delta.y.toDouble()).toFloat().coerceAtLeast(.001f)
        val fx = delta.x / length
        val fy = delta.y / length
        val sideX = -fy
        val sideY = fx
        val scaleOut = ((t - .88f) / .12f).coerceIn(0f, 1f)
        val alpha = (1f - scaleOut * scaleOut).coerceIn(0f, 1f)
        val unit = 10.5.dp.toPx() * (1f - scaleOut * .65f)
        val gait = t * 23f * PI.toFloat()
        val step = sin(gait.toDouble()).toFloat()
        val bodyLift = (0.65f + .35f * step) * .55.dp.toPx()
        val center = Offset(contact.x - sideX * bodyLift, contact.y - sideY * bodyLift)

        fun local(forward: Float, lateral: Float): Offset =
            Offset(center.x + fx * forward + sideX * lateral,
                center.y + fy * forward + sideY * lateral)

        val black = Color(0xFF090B0E)
        val darkGraphite = Color(0xFF202328)
        val glint = Color(0xFF9EA7B5)

        // Small stationary contact shadow directly beneath the feet, rather than
        // a glowing aura or a floating trail. Drawn before the legs and abdomen.
        drawCircle(Color.Black.copy(alpha = .20f * alpha),
            radius = unit * 1.55f, center = contact)
        drawCircle(Color.White.copy(alpha = .11f * alpha),
            radius = unit * 1.06f, center = contact)

        // Legs alternate in diagonal pairs. Each has a fixed knee geometry,
        // an independently stepping foot and two articulated dark segments.
        for (side in listOf(-1f, 1f)) {
            for (leg in 0 until 4) {
                val row = 1.35f - leg * .9f
                val phase = gait + leg * 1.46f + if (side > 0f) PI.toFloat() else 0f
                val swing = sin(phase.toDouble()).toFloat()
                val footLift = kotlin.math.max(0f, cos(phase.toDouble()).toFloat()) * .16f
                val root = local(unit * row * .36f, unit * side * .34f)
                val joint = local(
                    unit * (row * .79f + swing * .13f),
                    unit * side * (1.00f + .08f * leg)
                )
                val foot = local(
                    unit * (row * 1.12f + swing * .29f),
                    unit * side * (1.72f + .11f * kotlin.math.abs(row) - footLift)
                )
                drawLine(
                    glint.copy(alpha = alpha * .66f),
                    root, joint, strokeWidth = 3.9.dp.toPx() * (unit / 10.5.dp.toPx()),
                    cap = StrokeCap.Round
                )
                drawLine(
                    black.copy(alpha = alpha),
                    root, joint, strokeWidth = 2.6.dp.toPx() * (unit / 10.5.dp.toPx()),
                    cap = StrokeCap.Round
                )
                drawLine(
                    glint.copy(alpha = alpha * .65f),
                    joint, foot, strokeWidth = 3.6.dp.toPx() * (unit / 10.5.dp.toPx()),
                    cap = StrokeCap.Round
                )
                drawLine(
                    darkGraphite.copy(alpha = alpha),
                    joint, foot, strokeWidth = 2.5.dp.toPx() * (unit / 10.5.dp.toPx()),
                    cap = StrokeCap.Round
                )
                drawCircle(
                    black.copy(alpha = alpha), center = foot,
                    radius = 1.6.dp.toPx() * (unit / 10.5.dp.toPx())
                )
            }
        }

        val abdomen = local(-unit * .50f, 0f)
        val head = local(unit * .60f, 0f)
        drawCircle(glint.copy(alpha = alpha * .90f), unit * .94f, abdomen)
        drawCircle(black.copy(alpha = alpha), unit * .83f, abdomen)
        drawCircle(darkGraphite.copy(alpha = alpha), unit * .48f, head)
        drawCircle(black.copy(alpha = alpha), unit * .54f, head)
        drawCircle(glint.copy(alpha = alpha * .57f),
            unit * .22f, local(-unit * .65f, -unit * .20f))
        for (side in listOf(-1f, 1f)) {
            drawCircle(
                Color(0xFFE2E6ED).copy(alpha = alpha * .93f),
                radius = unit * .095f,
                center = local(unit * .91f, side * unit * .20f)
            )
        }

        // Subtle contact feedback as the spider disappears INSIDE the badge.
        if (t > .91f) {
            val pulse = ((t - .91f) / .09f).coerceIn(0f, 1f)
            drawCircle(
                Color(0xFF59636F).copy(alpha = (1f - pulse) * .37f),
                radius = (6f + 10f * pulse).dp.toPx(),
                center = end,
                style = androidx.compose.ui.graphics.drawscope.Stroke(1.1.dp.toPx())
            )
        }
    }
}
