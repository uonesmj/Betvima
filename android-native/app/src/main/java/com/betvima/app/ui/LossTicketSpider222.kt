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
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.atan2
import kotlin.math.roundToInt
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

// Pure arithmetic, no Android platform Math.floorMod() calls in rendering.
internal fun lossSpiderEntryIndex225(replay: Int, idHash: Int): Int =
    ((replay.toLong() + idHash.toLong()) % LOSS_SPIDER_ROUTE_COUNT_224)
        .let { ((it + LOSS_SPIDER_ROUTE_COUNT_224) % LOSS_SPIDER_ROUTE_COUNT_224).toInt() }

private fun spiderRoute225(route: Int): Int =
    ((route % LOSS_SPIDER_ROUTE_COUNT_224) + LOSS_SPIDER_ROUTE_COUNT_224) %
        LOSS_SPIDER_ROUTE_COUNT_224

internal fun lossSpiderStart224(
    route: Int, width: Float, height: Float
): Offset {
    val n = spiderRoute225(route)
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
    val n = spiderRoute225(route)
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

/**
 * A photoreal, background-free alpha WebP spider replaces the basic vector
 * geometry. The small asset is decoded once per composition and only its
 * transformed pixels are painted. No additional background or vector body.
 */
@Composable
internal fun LossTicketSpider222(
    replay: Int,
    routeVariant: Int,
    badgeTarget: Offset?,
    modifier: Modifier = Modifier,
    onComplete: () -> Unit
) {
    val context = LocalContext.current.applicationContext
    val spiderImage = remember(context) {
        runCatching {
            val encoded = context.assets.open("betvima_spider_photo226.webp.base64")
                .bufferedReader().use { it.readText() }
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
        }.getOrNull()
    }
    val progress = remember { Animatable(0f) }
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
        val photo = spiderImage ?: return@Canvas
        val target = badgeTarget ?: return@Canvas
        val width = size.width
        val height = size.height
        if (width < 60f || height < 70f) return@Canvas
        val t = progress.value
        if (t >= 1f) return@Canvas

        val route = spiderRoute225(routeVariant)
        val sideMargin = min(38.dp.toPx(), width * .11f)
        val origin = lossSpiderStart224(route, width, height).let { p ->
            Offset(if (route % 2 == 0) sideMargin else width - sideMargin, p.y)
        }
        val destination = lossSpiderBadgeEntry224(target, route, 1.dp.toPx()).let {
            Offset(it.x.coerceIn(32.dp.toPx(), width - 18.dp.toPx()),
                it.y.coerceIn(16.dp.toPx(), height - 40.dp.toPx()))
        }
        val position = lossSpiderPoint222(origin, destination, width, height, t)
        val before = lossSpiderPoint222(origin, destination, width, height,
            (t - .003f).coerceAtLeast(0f))
        val after = lossSpiderPoint222(origin, destination, width, height,
            (t + .003f).coerceAtMost(1f))
        val direction = after - before
        val length = hypot(direction.x.toDouble(), direction.y.toDouble())
            .toFloat().coerceAtLeast(.001f)
        val dx = direction.x / length
        val dy = direction.y / length

        // Gentle scuttle: small footfall sway, never floating above the ticket.
        val gait = t * 25f * PI.toFloat()
        val sway = sin(gait.toDouble()).toFloat()
        val contact = Offset(
            position.x - dy * sway * .65.dp.toPx(),
            position.y + dx * sway * .65.dp.toPx()
        )
        val vanish = ((t - .905f) / .095f).coerceIn(0f, 1f)
        val opacity = (1f - vanish * vanish).coerceIn(0f, 1f)
        val spriteWidth = (58.dp.toPx() * (1f - vanish * .68f))
            .roundToInt().coerceAtLeast(1)
        val spriteHeight = (spriteWidth * photo.height.toFloat() / photo.width)
            .roundToInt().coerceAtLeast(1)

        // The source photo's face points down (+Y), hence the 90-degree offset.
        val facing = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble()))
            .toFloat() - 90f + sway * 2.6f
        rotate(degrees = facing, pivot = contact) {
            drawImage(
                image = photo,
                dstOffset = IntOffset(
                    (contact.x - spriteWidth / 2f).roundToInt(),
                    (contact.y - spriteHeight / 2f).roundToInt()
                ),
                dstSize = IntSize(spriteWidth, spriteHeight),
                alpha = opacity
            )
        }
    }
}
