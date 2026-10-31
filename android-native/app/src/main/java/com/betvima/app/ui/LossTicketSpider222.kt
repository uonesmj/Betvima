package com.betvima.app.ui

import com.betvima.app.R

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.sin

/**
 * Photo-based spider animation.
 * The asset is a real transparent WEBP cutout generated for BetVima.
 * No Canvas body or legs are drawn and no plate/glow/background is created.
 */
internal const val LOSS_SPIDER_DELAY_MS_222 = 340L
internal const val LOSS_SPIDER_DURATION_MS_222 = 3200
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
        progress.animateTo(1f, tween(LOSS_SPIDER_DURATION_MS_222, easing = LinearEasing))
        onComplete()
    }

    // Compose displays the actual image; the photo's alpha channel means there
    // is never a rectangular background. Only a small graphics-layer transform
    // is animated, avoiding the earlier complex Canvas Path renderer.
    BoxWithConstraints(modifier) {
        val target = badgeTarget ?: return@BoxWithConstraints
        val w = constraints.maxWidth.toFloat()
        val h = constraints.maxHeight.toFloat()
        if (w < 100f || h < 90f) return@BoxWithConstraints
        val density = LocalDensity.current
        val imageWidth = with(density) { 69.dp.toPx() }
        val imageHeight = with(density) { 51.dp.toPx() }
        val route = spiderRoute226(routeVariant)
        val start = lossSpiderStart224(route, w, h)
        val end = lossSpiderBadgeEntry224(target, route, with(density) { 1.dp.toPx() })
        val t = progress.value
        if (t >= 1f) return@BoxWithConstraints

        val point = lossSpiderPoint222(start, end, w, h, t)
        val p0 = lossSpiderPoint222(start, end, w, h, (t - .005f).coerceAtLeast(0f))
        val p1 = lossSpiderPoint222(start, end, w, h, (t + .005f).coerceAtMost(1f))
        val dx = p1.x - p0.x
        val dy = p1.y - p0.y
        // The spider image's face points down in its original orientation.
        val direction = atan2(dy.toDouble(), dx.toDouble()).toFloat() *
            (180f / PI.toFloat()) - 90f
        val gait = sin((t * 27f * PI).toDouble()).toFloat()
        val close = ((t - .87f) / .13f).coerceIn(0f, 1f)
        val scale = (1f - close * .78f) * (1f + gait * .012f)

        Image(
            painter = painterResource(R.drawable.spider_realistic_226),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(width = 69.dp, height = 51.dp).graphicsLayer {
                translationX = point.x - imageWidth * .5f + gait * 0.7f
                translationY = point.y - imageHeight * .5f
                rotationZ = direction + gait * 2.1f
                scaleX = scale
                scaleY = scale * (1f + gait * .01f)
                alpha = (1f - close * close).coerceIn(0f, 1f)
            }
        )
    }
}
