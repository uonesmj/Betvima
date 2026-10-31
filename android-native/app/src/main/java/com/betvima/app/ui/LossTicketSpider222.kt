package com.betvima.app.ui

import com.betvima.app.R

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.drawscope.clipPath
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
    val sourcePhoto = ImageBitmap.imageResource(id = R.drawable.spider_realistic_226)
    val density = LocalDensity.current
    val dp = with(density) { 1.dp.toPx() }
    var layoutSize by remember { mutableStateOf(IntSize.Zero) }

    // Cache the 48-sample arc map across frames. The prior version rebuilt all
    // 48 samples inside every draw, introducing visible traversal micro-stutter.
    val path = remember(layoutSize, badgeTarget, routeVariant, dp) {
        val chip = badgeTarget
        if (chip == null || layoutSize.width < 110 || layoutSize.height < 95) null
        else {
            val w = layoutSize.width.toFloat()
            val h = layoutSize.height.toFloat()
            val route = ((routeVariant % LOSS_SPIDER_ROUTE_COUNT_224) +
                LOSS_SPIDER_ROUTE_COUNT_224) % LOSS_SPIDER_ROUTE_COUNT_224
            val start = lossSpiderStart224(route, w, h)
            val end = lossSpiderBadgeEntry224(chip, route, dp)
            SpiderArcPath230(start, end, w, h)
        }
    }

    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(1f,
            tween(durationMillis = LOSS_SPIDER_DURATION_MS_222, easing = LinearEasing))
        onComplete()
    }

    Canvas(modifier.onSizeChanged { next ->
        if (layoutSize != next) layoutSize = next
    }) {
        val arc = path ?: return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas
        val travel = arc.distanceAt(spiderWalkingDistance228(t))
        val center = arc.position(travel)
        val forward = arc.heading(travel)
        val normal = Offset(-forward.y, forward.x)
        val phase = travel / (SPIDER_STEP_LENGTH_DP_231 * dp) * 2f * PI.toFloat()
        val bob = .16f * dp * sin(phase.toDouble()).toFloat()
        val body = center + normal * bob

        val entry = ((t - .90f) / .10f).coerceIn(0f, 1f)
        val shrink = 1f - .78f * entry
        val alpha = (1f - entry * entry).coerceIn(0f, 1f)
        val size = SPIDER_SIZE_MULTIPLIER_231 * shrink
        val black = Color(0xFF111316).copy(alpha = alpha)
        val rim = Color(0xFF66696C).copy(alpha = alpha * .63f)

        // Four pairs radiate away from the thorax at different axial angles,
        // and the feet remain planted in world/card coordinates during stance.
        for (leg in 0 until 8) {
            val row = leg % 4
            val side = if (leg < 4) -1f else 1f
            val outward = normal * side
            val f = floatArrayOf(12f, 3.6f, -6f, -14f)[row]
            val hip = body + forward * (f * dp * size) +
                outward * (3.5f * dp * size)
            val worldFoot = spiderFoot231(leg, travel, arc, dp)
            // Only shrink feet when the animal actually enters Lost.
            val toe = body + (worldFoot - body) * shrink
            val coxa = hip + outward * (6.8f * dp * size) +
                forward * ((1.5f - row) * 1.3f * dp * size)
            val knee = spiderJoint231(
                coxa, toe, forward, outward, row, dp * size
            )
            val ankle = knee + (toe - knee) * .72f
            val width = (1.0f + (if (row == 1 || row == 2) .2f else 0f)) * dp * size
            drawLine(black, hip, coxa, strokeWidth = width * 1.60f,
                cap = StrokeCap.Round)
            drawLine(rim, hip, coxa, strokeWidth = width * .37f,
                cap = StrokeCap.Round)
            drawLine(black, coxa, knee, strokeWidth = width * 2.05f,
                cap = StrokeCap.Round)
            drawLine(rim, coxa, knee, strokeWidth = width * .42f,
                cap = StrokeCap.Round)
            drawLine(black, knee, ankle, strokeWidth = width * 1.58f,
                cap = StrokeCap.Round)
            drawLine(black, ankle, toe, strokeWidth = width * .86f,
                cap = StrokeCap.Round)
            drawCircle(black, radius = .78f * dp * size, center = knee)
        }

        // The old full-photo crop still contained eight legs, causing sixteen
        // overlaid legs. Clip it to a head+abdomen silhouette before drawing:
        // only the photographic torso survives; the rig provides the limbs.
        val rotation = (atan2(forward.y.toDouble(), forward.x.toDouble()) *
            180.0 / PI).toFloat() + 90f
        rotate(degrees = rotation - 135f, pivot = body) {
            val top = body.y - 12f * dp * size
            val bottom = body.y + 13f * dp * size
            val torsoMask = Path().apply {
                addOval(Rect(body.x - 10f * dp * size, top,
                    body.x + 10f * dp * size, body.y + 4f * dp * size))
                addOval(Rect(body.x - 7.3f * dp * size,
                    body.y - 4f * dp * size,
                    body.x + 7.3f * dp * size, bottom))
            }
            clipPath(torsoMask) {
                val w = (28f * dp * size).roundToInt().coerceAtLeast(1)
                val h = (31f * dp * size).roundToInt().coerceAtLeast(1)
                drawImage(
                    image = sourcePhoto,
                    srcOffset = IntOffset(58, 10),
                    srcSize = IntSize(69, 88),
                    dstOffset = IntOffset(
                        (body.x - w / 2f).roundToInt(),
                        (body.y - h / 2f).roundToInt()
                    ),
                    dstSize = IntSize(w, h),
                    alpha = alpha,
                    filterQuality = FilterQuality.Medium
                )
            }
        }
    }
}
