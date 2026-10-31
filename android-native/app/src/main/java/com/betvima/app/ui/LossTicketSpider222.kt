package com.betvima.app.ui

import com.betvima.app.R

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.sin
import kotlin.math.roundToInt
import kotlin.math.floor
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Photo-based spider animation.
 * The asset is a real transparent WEBP cutout generated for BetVima.
 * No Canvas body or legs are drawn and no plate/glow/background is created.
 */
internal const val LOSS_SPIDER_DELAY_MS_222 = 380L
internal const val LOSS_SPIDER_DURATION_MS_222 = 3900
internal const val LOSS_SPIDER_TOTAL_MS_222 =
    LOSS_SPIDER_DELAY_MS_222 + LOSS_SPIDER_DURATION_MS_222
internal const val LOSS_SPIDER_ROUTE_COUNT_224 = 6

// Uses Long so negative Int.MIN_VALUE hashes cannot overflow at runtime.
internal fun lossSpiderEntryIndex225(replay: Int, idHash: Int): Int {
    val count = LOSS_SPIDER_ROUTE_COUNT_224.toLong()
    val value = replay.toLong() + idHash.toLong()
    return ((value % count + count) % count).toInt()
}

private fun spiderRoute226(route: Int): Int =
    ((route % LOSS_SPIDER_ROUTE_COUNT_224) + LOSS_SPIDER_ROUTE_COUNT_224) %
        LOSS_SPIDER_ROUTE_COUNT_224

/**
 * Six different starting points INSIDE the central region of the ticket.
 * No side-edge or bottom-border crawl and no single repeating point.
 */
internal fun lossSpiderStart224(route: Int, width: Float, height: Float): Offset {
    val n = spiderRoute226(route)
    val x = floatArrayOf(.39f, .53f, .45f, .59f, .32f, .62f)[n]
    val y = floatArrayOf(.70f, .59f, .79f, .68f, .54f, .75f)[n]
    return Offset(width * x, height * y)
}

internal fun lossSpiderBadgeEntry224(
    badgeCenter: Offset, route: Int, pixelScale: Float
): Offset {
    val n = spiderRoute226(route)
    val dx = floatArrayOf(-3f, 3f, 0f, 2f, -2f, 1f)[n] * pixelScale
    val dy = floatArrayOf(1f, -2f, 2f, 0f, -1f, 1f)[n] * pixelScale
    return Offset(badgeCenter.x + dx, badgeCenter.y + dy)
}

/** Smooth non-linear, lightly S-shaped cubic Bezier from the card's
 * middle to the actual Lost badge, with a curved lead-in and approach.
 * The curve is pure math and allocates no Path objects during animation.
 */
internal fun lossSpiderPoint222(
    start: Offset, end: Offset, width: Float, height: Float, progress: Float
): Offset {
    val t = progress.coerceIn(0f, 1f)
    if (t <= 0f) return start
    if (t >= 1f) return end
    val bend = if (start.x < width * .48f) -1f else 1f
    val c1 = Offset(
        (start.x + bend * width * .16f).coerceIn(0f, width),
        (start.y - height * .30f).coerceAtLeast(end.y + 20f)
    )
    val c2 = Offset(
        (end.x - width * .22f).coerceIn(0f, width),
        (end.y + height * .16f).coerceAtMost(start.y - 8f)
    )
    val u = 1f - t
    return Offset(
        u*u*u*start.x + 3f*u*u*t*c1.x + 3f*u*t*t*c2.x + t*t*t*end.x,
        u*u*u*start.y + 3f*u*u*t*c1.y + 3f*u*t*t*c2.y + t*t*t*end.y
    )
}


/** Physics-inspired runtime gait: eight independently animated, anchored feet.
 * The old sheet of fixed poses is intentionally not used: a sprite sheet has
 * no knowledge of the body's actual motion and therefore appears to slide.
 */
internal const val SPIDER_IK_STRIDES_229 = 8
internal const val SPIDER_IK_STANCE_FRACTION_229 = .68f

internal fun spiderWalkingDistance228(progress: Float): Float {
    val t = progress.coerceIn(0f, 1f)
    return (t - .024f * sin((4f * PI.toFloat() * t).toDouble()).toFloat())
        .coerceIn(0f, 1f)
}

private fun spiderHeading229(
    start: Offset, end: Offset, width: Float, height: Float, progress: Float
): Offset {
    val a = lossSpiderPoint222(start, end, width, height, (progress - .002f).coerceAtLeast(0f))
    val b = lossSpiderPoint222(start, end, width, height, (progress + .002f).coerceAtMost(1f))
    val dx = b.x - a.x
    val dy = b.y - a.y
    val length = hypot(dx.toDouble(), dy.toDouble()).toFloat().coerceAtLeast(.01f)
    return Offset(dx / length, dy / length)
}

private fun spiderFootAnchor229(
    leg: Int, touchdown: Float, start: Offset, end: Offset,
    width: Float, height: Float, pixelScale: Float
): Offset {
    val t = touchdown.coerceIn(0f, 1f)
    val body = lossSpiderPoint222(start, end, width, height, t)
    val heading = spiderHeading229(start, end, width, height, t)
    val normal = Offset(-heading.y, heading.x)
    val row = leg % 4
    val sign = if (leg < 4) -1f else 1f
    val forward = floatArrayOf(21f, 7f, -10f, -22f)[row] * pixelScale
    val spread = floatArrayOf(27f, 32f, 32f, 28f)[row] * pixelScale
    return body + heading * forward + normal * (spread * sign)
}

/** The foot is *identical* in card/world coordinates for the entire stance.
 * Only during swing does it interpolate to the next planted touchdown, with
 * a small inward projection standing in for z-axis lift in this 2D overlay.
 * Absolutely no mutable animation state or allocations of native Path objects.
 */
internal fun spiderFoot229(
    leg: Int, progress: Float,
    start: Offset, end: Offset, width: Float, height: Float, pixelScale: Float
): Offset {
    require(leg in 0..7)
    val offset = if ((leg + (leg / 4)) % 2 == 0) 0f else .5f
    val cycle = progress.coerceIn(0f, 1f) * SPIDER_IK_STRIDES_229 + offset
    val whole = floor(cycle.toDouble()).toInt()
    val phase = cycle - whole
    val firstTouchdown = (whole - offset) / SPIDER_IK_STRIDES_229
    val planted = spiderFootAnchor229(
        leg, firstTouchdown, start, end, width, height, pixelScale
    )
    if (phase <= SPIDER_IK_STANCE_FRACTION_229) return planted
    val next = spiderFootAnchor229(
        leg, firstTouchdown + 1f / SPIDER_IK_STRIDES_229,
        start, end, width, height, pixelScale
    )
    val swing = ((phase - SPIDER_IK_STANCE_FRACTION_229) /
        (1f - SPIDER_IK_STANCE_FRACTION_229)).coerceIn(0f, 1f)
    val eased = swing * swing * (3f - 2f * swing)
    val heading = spiderHeading229(start, end, width, height, progress)
    val normal = Offset(-heading.y, heading.x)
    val side = if (leg < 4) -1f else 1f
    val lift = sin((swing * PI).toDouble()).toFloat() * 3.3f * pixelScale
    return planted * (1f - eased) + next * eased + normal * (-side * lift)
}

/** Dynamic knee placement: hips follow the body, foot stays planted, elbow
 * flexes outward with the changing hip-to-foot displacement.
 */
internal fun spiderKnee229(root: Offset, foot: Offset, normal: Offset,
                           side: Float, pixelScale: Float): Offset {
    return root + (foot - root) * .52f + normal * (side * 7.4f * pixelScale)
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
    // The photo provides anatomical face/abdomen detail. Legs are generated
    // live by eight stance/swing IK rigs, not a sequence of painted frames.
    val bodyPhoto = ImageBitmap.imageResource(id = R.drawable.spider_realistic_226)
    val density = LocalDensity.current
    val dp = with(density) { 1.dp.toPx() }

    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(
            1f, tween(durationMillis = LOSS_SPIDER_DURATION_MS_222, easing = LinearEasing)
        )
        onComplete()
    }

    Canvas(modifier) {
        val badge = badgeTarget ?: return@Canvas
        val width = size.width
        val height = size.height
        if (width < 110f || height < 95f) return@Canvas
        val time = progress.value
        if (time >= 1f) return@Canvas
        val route = spiderRoute226(routeVariant)
        val start = lossSpiderStart224(route, width, height)
        val end = lossSpiderBadgeEntry224(badge, route, dp)
        val travel = spiderWalkingDistance228(time)
        val arc = SpiderArcPath230(start, end, width, height)
        val distance = arc.distanceAt(travel)
        val center = arc.position(distance)
        val forward = arc.heading(distance)
        val normal = Offset(-forward.y, forward.x)
        val angle = (atan2(forward.y.toDouble(), forward.x.toDouble()) * 180.0 /
            PI).toFloat() + 90f
        val cycle = distance / (SPIDER_STEP_LENGTH_DP_230 * dp) * 2f * PI.toFloat()
        val bob = .24f * dp * sin(cycle.toDouble()).toFloat()
        val body = center + normal * bob
        val entering = ((time - .89f) / .11f).coerceIn(0f, 1f)
        val shrink = SPIDER_SIZE_MULTIPLIER_230 * (1f - entering * .72f)
        val opacity = (1f - entering * entering).coerceIn(0f, 1f)

        // Eight high-contrast, individually planted articulated legs. The
        // final toe remains motionless through stance even while the body
        // advances: this is what eliminates the former skating motion.
        for (leg in 0 until 8) {
            val row = leg % 4
            val side = if (leg < 4) -1f else 1f
            val hipF = floatArrayOf(11f, 3f, -5f, -12f)[row] * dp
            val root = body + forward * hipF + normal * (side * 3.8f * dp * shrink)
            val foot = spiderFoot230(leg, distance, arc, dp)
            // As the spider disappears into Lost, feet converge naturally.
            val toe = body + (foot - body) * shrink
            val first = root + normal * (side * 6.2f * dp * shrink) +
                forward * ((1.5f - row) * 1.2f * dp)
            val knee = spiderKnee230(first, toe, normal * side, dp * shrink)
            val ankle = knee + (toe - knee) * .78f
            val black = Color(0xFF101114).copy(alpha = opacity)
            val sheen = Color(0xFF535963).copy(alpha = opacity * .77f)
            drawLine(black, root, first, strokeWidth = 2.25f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(sheen, root, first, strokeWidth = .62f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(black, first, knee, strokeWidth = 2.65f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(sheen, first, knee, strokeWidth = .85f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(black, knee, ankle, strokeWidth = 2.1f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(sheen, knee, ankle, strokeWidth = .57f * dp * shrink,
                cap = StrokeCap.Round)
            drawLine(black, ankle, toe, strokeWidth = 1.35f * dp * shrink,
                cap = StrokeCap.Round)
            drawCircle(Color(0xFF25292D).copy(alpha = opacity),
                radius = 1.35f * dp * shrink, center = knee)
            drawCircle(Color(0xFF141619).copy(alpha = opacity),
                radius = .7f * dp * shrink, center = toe)
        }

        // Overlay the real photographic head and abdomen (central crop of the
        // original transparent image). No rectangular background is drawn.
        // Source photo faces toward lower-left, hence anatomical correction.
        rotate(degrees = angle - 135f, pivot = body) {
            val dstWidth = (27f * dp * shrink).roundToInt().coerceAtLeast(1)
            val dstHeight = (31f * dp * shrink).roundToInt().coerceAtLeast(1)
            drawImage(
                image = bodyPhoto,
                srcOffset = IntOffset(51, 14),
                srcSize = IntSize(74, 82),
                dstOffset = IntOffset((body.x - dstWidth / 2f).roundToInt(),
                    (body.y - dstHeight / 2f).roundToInt()),
                dstSize = IntSize(dstWidth, dstHeight),
                alpha = opacity,
                filterQuality = FilterQuality.Medium
            )
        }
    }
}
