package com.betvima.app.ui

import com.betvima.app.R

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.ImageBitmap
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

internal const val SPIDER_WALK_FRAME_COUNT_227 = 16
internal const val SPIDER_WALK_FRAME_WIDTH_227 = 224
internal const val SPIDER_WALK_FRAME_HEIGHT_227 = 176
internal const val SPIDER_WALK_STRIDES_227 = 7

/** A distinct leg pose every 22-35 ms while the spider crawls.
 * Alternating feet are displaced in the actual transparent photograph.
 */
internal fun spiderWalkFrame227(progress: Float): Int =
    ((progress.coerceIn(0f, .99999f) *
        (SPIDER_WALK_FRAME_COUNT_227 * SPIDER_WALK_STRIDES_227)).toInt()) %
        SPIDER_WALK_FRAME_COUNT_227

@Composable
internal fun LossTicketSpider222(
    replay: Int,
    routeVariant: Int,
    badgeTarget: Offset?,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    val progress = remember { Animatable(0f) }
    // The actual photo has sixteen different articulated leg poses. The entire
    // sprite sheet is decoded once and only source rectangles change on frames.
    val sprite = ImageBitmap.imageResource(id = R.drawable.spider_walk_cycle_227)
    val density = LocalDensity.current
    val visualWidth = with(density) { 87.dp.toPx() }
    val visualHeight = with(density) { 69.dp.toPx() }
    val scaleUnit = with(density) { 1.dp.toPx() }

    LaunchedEffect(replay, badgeTarget != null) {
        if (badgeTarget == null) return@LaunchedEffect
        progress.snapTo(0f)
        delay(LOSS_SPIDER_DELAY_MS_222)
        progress.animateTo(
            1f, tween(durationMillis = LOSS_SPIDER_DURATION_MS_222,
                easing = LinearEasing)
        )
        onComplete()
    }

    Canvas(modifier) {
        val chip = badgeTarget ?: return@Canvas
        val w = size.width
        val h = size.height
        if (w < 110f || h < 95f) return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas

        val route = spiderRoute226(routeVariant)
        val start = lossSpiderStart224(route, w, h)
        val destination = lossSpiderBadgeEntry224(chip, route, scaleUnit)
        val now = lossSpiderPoint222(start, destination, w, h, t)
        val before = lossSpiderPoint222(
            start, destination, w, h, (t - .004f).coerceAtLeast(0f)
        )
        val after = lossSpiderPoint222(
            start, destination, w, h, (t + .004f).coerceAtMost(1f)
        )
        // The source photo faces down; the vector derivative rotates its face
        // into the direction of crawling. A tiny rhythmic yaw tracks the legs.
        val direction = (atan2(
            (after.y - before.y).toDouble(),
            (after.x - before.x).toDouble()
        ) * 180.0 / PI).toFloat() - 90f
        val phase = (t * SPIDER_WALK_STRIDES_227 * 2f * PI).toDouble()
        val bob = .65f * scaleUnit * sin(phase * 2.0).toFloat()
        val yaw = 1.4f * sin(phase).toFloat()
        val complete = ((t - .89f) / .11f).coerceIn(0f, 1f)
        val shrink = 1f - .75f * complete
        val alpha = (1f - complete * complete).coerceIn(0f, 1f)
        val frame = spiderWalkFrame227(t)

        rotate(degrees = direction + yaw, pivot = now) {
            val destW = (visualWidth * shrink).roundToInt().coerceAtLeast(1)
            val destH = (visualHeight * shrink).roundToInt().coerceAtLeast(1)
            drawImage(
                image = sprite,
                srcOffset = IntOffset(frame * SPIDER_WALK_FRAME_WIDTH_227, 0),
                srcSize = IntSize(SPIDER_WALK_FRAME_WIDTH_227,
                    SPIDER_WALK_FRAME_HEIGHT_227),
                dstOffset = IntOffset(
                    (now.x - destW / 2f).roundToInt(),
                    (now.y + bob - destH / 2f).roundToInt()
                ),
                dstSize = IntSize(destW, destH),
                alpha = alpha,
                filterQuality = FilterQuality.Medium
            )
        }
    }
}
