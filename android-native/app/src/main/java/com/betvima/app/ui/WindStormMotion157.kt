package com.betvima.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.matchParentSize
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * A lightweight, swipe-driven wind trail. It uses real native horizontal
 * scroll position: no timer, no infinite animation, no images to decode and
 * no pointer-blocking effects above actionable cards.
 */
internal fun windStormIntensity(value: Float): Float =
    if (value.isFinite()) value.coerceIn(0f, 1f) else 0f

internal fun windStormDirection(
    previousIndex: Int, previousOffset: Int, index: Int, offset: Int
): Float = when {
    index > previousIndex -> -1f
    index < previousIndex -> 1f
    offset > previousOffset -> -1f
    offset < previousOffset -> 1f
    else -> 0f
}

/** Smooth artwork on top of a real LazyRow. Does not take ownership of gestures. */
@Composable
fun WindStormScrollFrame(
    scrollState: LazyListState,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    var direction by remember(scrollState) { mutableFloatStateOf(-1f) }
    LaunchedEffect(scrollState) {
        var previousIndex = scrollState.firstVisibleItemIndex
        var previousOffset = scrollState.firstVisibleItemScrollOffset
        snapshotFlow {
            Triple(
                scrollState.firstVisibleItemIndex,
                scrollState.firstVisibleItemScrollOffset,
                scrollState.isScrollInProgress
            )
        }.collect { (index, offset, moving) ->
            if (moving) {
                val measured = windStormDirection(previousIndex, previousOffset, index, offset)
                if (measured != 0f) direction = measured
            }
            previousIndex = index
            previousOffset = offset
        }
    }

    val intensity by animateFloatAsState(
        targetValue = if (scrollState.isScrollInProgress) 1f else 0f,
        animationSpec = tween(
            durationMillis = if (scrollState.isScrollInProgress) 115 else 290,
            easing = FastOutSlowInEasing
        ),
        label = "windStormScrollIntensity"
    )
    val drift = scrollState.firstVisibleItemIndex * 0.61f +
        scrollState.firstVisibleItemScrollOffset / 110f
    Box(modifier) {
        content()
        WindStormTrails(intensity, direction, drift, Modifier.matchParentSize())
    }
}

/**
 * When the provider has no Live fixtures there is no list to scroll.
 * A small springy horizontal response still gives the empty card the same
 * visual feedback without creating imaginary matches or changing Refresh.
 * detectHorizontalDragGestures waits for a horizontal gesture and lets the
 * parent LazyColumn continue handling vertical scrolling.
 */
@Composable
fun WindStormEmptyLiveCard(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    var horizontalDrag by remember { mutableFloatStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }
    var lastDirection by remember { mutableFloatStateOf(-1f) }
    val displacement by animateFloatAsState(
        targetValue = horizontalDrag,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "emptyLiveCardSpring"
    )
    val intensity by animateFloatAsState(
        targetValue = if (dragging) 1f else 0f,
        animationSpec = tween(durationMillis = if (dragging) 110 else 320),
        label = "emptyLiveWindFade"
    )
    Box(
        modifier.fillMaxWidth()
            .clip(RoundedCornerShape(23.dp))
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dragging = true },
                    onHorizontalDrag = { change, amount ->
                        change.consume()
                        lastDirection = if (amount >= 0f) 1f else -1f
                        horizontalDrag = (horizontalDrag + amount * .32f)
                            .coerceIn(-34f, 34f)
                    },
                    onDragEnd = { dragging = false; horizontalDrag = 0f },
                    onDragCancel = { dragging = false; horizontalDrag = 0f }
                )
            }
    ) {
        Box(Modifier.fillMaxWidth().offsetPixels(displacement)) {
            content()
        }
        WindStormTrails(
            intensity = intensity,
            direction = lastDirection,
            drift = abs(displacement) / 9f,
            modifier = Modifier.matchParentSize()
        )
    }
}

private fun Modifier.offsetPixels(dx: Float): Modifier =
    this.then(Modifier.offset { IntOffset(dx.roundToInt(), 0) })

/** Blue-white currents, curved gusts and tiny suspended particles.
 * The frame is deterministic from the swipe offset and draws nothing at rest.
 */
@Composable
private fun WindStormTrails(
    intensity: Float,
    direction: Float,
    drift: Float,
    modifier: Modifier = Modifier
) {
    val reducedMotion = android.provider.Settings.Global.getFloat(
        LocalContext.current.contentResolver,
        android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f
    ) == 0f
    val strength = if (reducedMotion) 0f else windStormIntensity(intensity)
    Canvas(modifier) {
        if (strength <= .008f || size.width <= 0f || size.height <= 0f) return@Canvas
        val w = size.width
        val h = size.height
        val fromLeft = direction > 0f
        val blue = Color(0xFF128CFB)
        val frost = Color(0xFFCBEFFF)
        // A translucent edge front makes the airflow legible but leaves
        // labels, odds, icons and Refresh buttons readable and tappable.
        drawRect(
            Brush.horizontalGradient(
                if (fromLeft)
                    listOf(blue.copy(alpha = .21f * strength),
                        frost.copy(alpha = .045f * strength), Color.Transparent)
                else
                    listOf(Color.Transparent, frost.copy(alpha = .045f * strength),
                        blue.copy(alpha = .21f * strength))
            ),
            size = size
        )
        for (n in 0 until 21) {
            val seed = ((n * 0.618034f) % 1f)
            val progression = ((seed + drift * (0.26f + (n % 5) * .04f)) % 1f + 1f) % 1f
            val y = h * (.13f + ((n * .27183f) % 1f) * .75f)
            val lane = progression * w * .66f
            val x = if (fromLeft) lane else w - lane
            val length = (16f + (n % 6) * 7f).dp.toPx()
            val tip = Offset(x, y)
            val tail = Offset(x - direction * length, y + (n % 3 - 1) * 4.dp.toPx())
            val fade = (1f - lane / (w * .9f)).coerceIn(.08f, 1f)
            drawLine(
                color = if (n % 4 == 0) frost.copy(alpha = strength * .64f * fade)
                    else blue.copy(alpha = strength * .36f * fade),
                start = tail,
                end = tip,
                strokeWidth = (if (n % 4 == 0) 1.4f else .9f).dp.toPx(),
                cap = StrokeCap.Round
            )
            if (n % 3 == 0) {
                drawCircle(
                    color = frost.copy(alpha = strength * .55f * fade),
                    radius = (1.5f + (n % 2)).dp.toPx(),
                    center = tip
                )
            }
        }
        // Three sweeping storm fronts curve toward the swipe direction.
        repeat(3) { lane ->
            val middleY = h * (.25f + lane * .25f)
            val originX = if (fromLeft) -w * .11f else w * 1.11f
            val endX = if (fromLeft) w * .36f else w * .64f
            val current = Path().apply {
                moveTo(originX, middleY + h * .09f)
                cubicTo(
                    originX + direction * w * .16f, middleY - h * .17f,
                    endX - direction * w * .12f, middleY + h * .19f,
                    endX, middleY - h * .04f
                )
            }
            drawPath(
                path = current,
                color = frost.copy(alpha = strength * (.13f - lane * .025f)),
                style = Stroke(width = (1.9f - lane * .35f).dp.toPx(), cap = StrokeCap.Round)
            )
        }
    }
}
