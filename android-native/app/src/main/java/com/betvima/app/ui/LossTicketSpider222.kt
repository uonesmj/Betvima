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
import androidx.compose.ui.graphics.Path
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
    val progress = remember { Animatable(0f) }
    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(
            1f,
            tween(durationMillis = LOSS_SPIDER_DURATION_MS_222, easing = LinearEasing)
        )
        onComplete()
    }

    Canvas(modifier) {
        val badge = badgeTarget ?: return@Canvas
        val w = size.width
        val h = size.height
        if (w < 100f || h < 90f) return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas

        // dp keeps drawing proportions identical on low/high DPI devices.
        val density = 1.dp.toPx()
        val n = Math.floorMod(routeVariant, LOSS_SPIDER_ROUTE_COUNT_224)
        val margin = min(39f * density, w * .11f)
        val origin = lossSpiderStart224(n, w, h).let {
            Offset(if (n % 2 == 0) margin else w - margin, it.y)
        }
        val destination = lossSpiderBadgeEntry224(badge, n, density).let {
            Offset(it.x.coerceIn(35f * density, w - 22f * density),
                it.y.coerceIn(16f * density, h - 60f * density))
        }
        val position = lossSpiderPoint222(origin, destination, w, h, t)
        val prev = lossSpiderPoint222(origin, destination, w, h, (t - .0025f).coerceAtLeast(0f))
        val next = lossSpiderPoint222(origin, destination, w, h, (t + .0025f).coerceAtMost(1f))
        val heading = next - prev
        val headingLength = hypot(heading.x.toDouble(), heading.y.toDouble())
            .toFloat().coerceAtLeast(.001f)
        val fx = heading.x / headingLength
        val fy = heading.y / headingLength
        val lx = -fy
        val ly = fx

        val disappear = ((t - .925f) / .075f).coerceIn(0f, 1f)
        val opacity = (1f - disappear * disappear).coerceIn(0f, 1f)
        val unit = 10.dp.toPx() * (1f - disappear * .78f)
        // Anatomical bob is less than 0.5 dp: legs remain in contact.
        val gait = t * 21f * PI.toFloat()
        val bob = .26.dp.toPx() * sin(gait.toDouble()).toFloat()
        val center = Offset(position.x + lx * bob, position.y + ly * bob)
        fun local(forward: Float, across: Float): Offset =
            Offset(center.x + fx * forward + lx * across,
                center.y + fy * forward + ly * across)

        val jet = Color(0xFF050608).copy(alpha = opacity)
        val charcoal = Color(0xFF1A1C1E).copy(alpha = opacity)
        val graphite = Color(0xFF37393C).copy(alpha = opacity)

        // An oriented anatomical ellipse, not a circular image backdrop.
        fun bodyOval(at: Offset, longitudinal: Float, lateral: Float, fill: Color) {
            fun point(a: Float, b: Float) = Offset(
                at.x + fx * a + lx * b, at.y + fy * a + ly * b
            )
            val k = .5522848f
            val p0 = point(longitudinal, 0f)
            val p1 = point(0f, lateral)
            val p2 = point(-longitudinal, 0f)
            val p3 = point(0f, -lateral)
            val q = Path().apply {
                moveTo(p0.x, p0.y)
                val a = point(longitudinal, lateral * k)
                val b = point(longitudinal * k, lateral)
                cubicTo(a.x, a.y, b.x, b.y, p1.x, p1.y)
                val c = point(-longitudinal * k, lateral)
                val d = point(-longitudinal, lateral * k)
                cubicTo(c.x, c.y, d.x, d.y, p2.x, p2.y)
                val e = point(-longitudinal, -lateral * k)
                val f = point(-longitudinal * k, -lateral)
                cubicTo(e.x, e.y, f.x, f.y, p3.x, p3.y)
                val g = point(longitudinal * k, -lateral)
                val j = point(longitudinal, -lateral * k)
                cubicTo(g.x, g.y, j.x, j.y, p0.x, p0.y)
                close()
            }
            drawPath(q, fill)
        }

        // Four legs on each side, with individually articulated coxa, femur,
        // tibia, and tarsus. Alternating diagonals use an independent gait;
        // the last segment remains planted for part of each stride.
        for (side in listOf(-1f, 1f)) {
            for (leg in 0 until 4) {
                val fore = 1.20f - leg * .80f
                val phase = gait + leg * 1.6f +
                    if (side > 0f) PI.toFloat() else 0f
                val stride = sin(phase.toDouble()).toFloat()
                val raised = max(0f, cos(phase.toDouble()).toFloat())
                val root = local(unit * (fore * .37f + .10f), unit * side * .34f)
                val hip = local(unit * (fore * .62f), unit * side * .72f)
                val knee = local(
                    unit * (fore * 1.04f + stride * .17f),
                    unit * side * (1.32f - raised * .08f)
                )
                val ankle = local(
                    unit * (fore * 1.16f + stride * .29f),
                    unit * side * (1.87f - raised * .08f)
                )
                val toe = local(
                    unit * (fore * 1.21f + stride * .32f),
                    unit * side * 2.03f
                )
                val line = (1.35f - disappear * .70f).dp.toPx()
                drawLine(charcoal, root, hip, strokeWidth = line * 1.65f,
                    cap = StrokeCap.Round)
                drawLine(graphite, hip, knee, strokeWidth = line * 1.22f,
                    cap = StrokeCap.Round)
                drawLine(jet, hip, knee, strokeWidth = line * .85f,
                    cap = StrokeCap.Round)
                drawLine(charcoal, knee, ankle, strokeWidth = line * 1.04f,
                    cap = StrokeCap.Round)
                drawLine(jet, ankle, toe, strokeWidth = line * .70f,
                    cap = StrokeCap.Round)
                drawCircle(jet, radius = line * .67f, center = knee)
            }
        }

        // Correct spider proportions: larger oval abdomen connected to a
        // smaller cephalothorax via a slim pedicel.
        val abdomen = local(-unit * .77f, 0f)
        val thorax = local(unit * .60f, 0f)
        drawLine(jet, abdomen, thorax, strokeWidth = unit * .33f,
            cap = StrokeCap.Round)
        bodyOval(abdomen, unit * 1.14f, unit * .85f, charcoal)
        bodyOval(local(-unit * .85f, 0f), unit * 1.05f, unit * .79f, jet)
        bodyOval(thorax, unit * .69f, unit * .59f, charcoal)
        bodyOval(local(unit * .65f, 0f), unit * .62f, unit * .52f, jet)

        // Low-contrast abdominal carapace texture and tiny realistic eyes.
        // None of these primitives paints a background behind the spider.
        for (i in 0 until 5) {
            val f = (-1.30f + i * .24f) * unit
            drawCircle(graphite.copy(alpha = .23f * opacity),
                radius = .42.dp.toPx(), center = local(f, ((i % 2) * 2 - 1) * unit * .34f))
        }
        for (side in listOf(-1f, 1f)) {
            drawCircle(Color(0xFF8B9199).copy(alpha = opacity * .8f),
                radius = .62.dp.toPx(),
                center = local(unit * .98f, side * unit * .22f))
            drawLine(jet, local(unit * .99f, side * unit * .26f),
                local(unit * 1.26f, side * unit * .40f),
                strokeWidth = .8.dp.toPx(), cap = StrokeCap.Round)
        }
    }
}
