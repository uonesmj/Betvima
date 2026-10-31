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
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Transparent vector animation: ONLY anatomy is drawn, with no background,
 * plate, glow, circle behind the spider, drop shadow or silk trail.
 *
 * Six alternate starting locations along the left/right ticket surfaces.
 * At each opening the spider takes an edge-following route to the actual
 * measured Lost badge, approaching it from either side. Both route and point
 * of entry inside the badge vary with the saved opening counter.
 */
internal const val LOSS_SPIDER_DELAY_MS_222 = 420L
internal const val LOSS_SPIDER_DURATION_MS_222 = 3400
internal const val LOSS_SPIDER_TOTAL_MS_222 =
    LOSS_SPIDER_DELAY_MS_222 + LOSS_SPIDER_DURATION_MS_222
internal const val LOSS_SPIDER_ROUTE_COUNT_224 = 6

internal fun lossSpiderStart224(
    route: Int, width: Float, height: Float
): Offset {
    val n = Math.floorMod(route, LOSS_SPIDER_ROUTE_COUNT_224)
    val left = n % 2 == 0
    val margin = min(width * .105f, 42f)
    val y = when (n / 2) {
        0 -> height - min(44f, height * .10f)
        1 -> height * .69f
        else -> height * .44f
    }
    return Offset(if (left) margin else width - margin, y)
}

/** Three distinct, small offsets inside the measured Lost badge. */
internal fun lossSpiderBadgeEntry224(
    badgeCenter: Offset, route: Int, pixelScale: Float
): Offset {
    val n = Math.floorMod(route, LOSS_SPIDER_ROUTE_COUNT_224)
    val horizontal = when (n % 3) {
        0 -> -5f
        1 -> 4f
        else -> 0f
    } * pixelScale
    val vertical = when (n / 2) {
        0 -> 3f
        1 -> -3f
        else -> 1f
    } * pixelScale
    return Offset(badgeCenter.x + horizontal, badgeCenter.y + vertical)
}

/**
 * Surface-constrained, arc-length path: up the chosen side rim, around one
 * softly rounded top corner and horizontally along the header into Lost.
 * Right-side routes mirror left-side ones and never cut diagonally through
 * the ticket's content. All offsets are in the ticket Canvas's pixel space.
 */
internal fun lossSpiderPoint222(
    start: Offset, end: Offset, width: Float, height: Float, progress: Float
): Offset {
    val t = progress.coerceIn(0f, 1f)
    if (t <= 0f) return start
    if (t >= 1f) return end
    val direction = if (end.x >= start.x) 1f else -1f
    val available = abs(end.x - start.x)
    val radius = min(min(width * .055f, 25f), available * .42f).coerceAtLeast(1f)
    val startTurnY = end.y + radius
    val climb = max(0f, start.y - startTurnY)
    val turnLength = radius * (PI.toFloat() / 2f)
    val headerLength = max(0f, available - radius)
    val length = (climb + turnLength + headerLength).coerceAtLeast(.01f)
    val travelled = length * t
    if (travelled < climb) return Offset(start.x, start.y - travelled)
    if (travelled < climb + turnLength) {
        val theta = ((travelled - climb) / radius).coerceIn(0f, PI.toFloat() / 2f)
        return Offset(
            start.x + direction * radius * (1f - cos(theta)),
            startTurnY - radius * sin(theta)
        )
    }
    return Offset(
        start.x + direction * min(available, radius + travelled - climb - turnLength),
        end.y
    )
}

@Composable
internal fun LossTicketSpider222(
    replay: Int,
    routeVariant: Int,
    badgeTarget: Offset?,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    // Known-working segment renderer: no complex Path building on the UI thread.
    val progress = remember { Animatable(0f) }
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

        // All entrances and Lost badge destinations come from measured card bounds.
        val n = Math.floorMod(routeVariant, LOSS_SPIDER_ROUTE_COUNT_224)
        val margin = min(38.dp.toPx(), w * .11f)
        val initial = lossSpiderStart224(n, w, h)
        val start = Offset(if (n % 2 == 0) margin else w - margin, initial.y)
        val end = lossSpiderBadgeEntry224(target, n, 1.dp.toPx()).let { badge ->
            Offset(badge.x.coerceIn(32.dp.toPx(), w - 18.dp.toPx()),
                badge.y.coerceIn(16.dp.toPx(), h - 40.dp.toPx()))
        }
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

        // Transparent overlay; only spider body and legs are drawn.
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


    }
}
