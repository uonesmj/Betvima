package com.betvima.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/**
 * A small visual token travels from a clicked, eligible odd to the centered slip FAB.
 * The model owns selection validity; this overlay never mutates prices or stakes.
 * Non-focusable overlay: other betting markets remain responsive during transit.
 */
@Composable
internal fun PickFlightOverlay84(
    flight: PickFlight84?,
    windowOrigin: Offset,
    onLanded: (Long) -> Unit
) {
    if (flight == null) return
    var launched by remember(flight.revision) { mutableStateOf(false) }
    val position by animateFloatAsState(
        targetValue = if (launched) 1f else 0f,
        animationSpec = tween(durationMillis = 430, easing = FastOutSlowInEasing),
        label = "marketToSlipFlight")
    LaunchedEffect(flight.revision) {
        withFrameNanos { }
        launched = true
        delay(450)
        onLanded(flight.revision)
    }
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val width = constraints.maxWidth.toFloat()
        val height = constraints.maxHeight.toFloat()
        val landingY = height - with(density) { 131.dp.toPx() }
        val sourceX = if (flight.originX.isFinite())
            (flight.originX - windowOrigin.x).coerceIn(0f, width) else width / 2f
        val sourceY = if (flight.originY.isFinite())
            (flight.originY - windowOrigin.y).coerceIn(0f, height)
        else height * .42f
        val centerX = sourceX + (width / 2f - sourceX) * position
        // A subtle arc gives a precise sense of "sending" the selected market.
        val arc = with(density) { 30.dp.toPx() } * 4f * position * (1f - position)
        val centerY = sourceY + (landingY - sourceY) * position - arc
        val halfWidth = with(density) { 38.dp.toPx() }
        val halfHeight = with(density) { 20.dp.toPx() }
        Surface(
            shape = RoundedCornerShape(22.dp),
            border = BorderStroke(1.dp, Color(0xFF91FFCB)),
            color = Color(0xFF053D32),
            shadowElevation = 10.dp,
            modifier = Modifier
                .offset {
                    IntOffset(
                        (centerX - halfWidth).roundToInt(),
                        (centerY - halfHeight).roundToInt()
                    )
                }
                .width(76.dp).height(40.dp)
                .graphicsLayer {
                    val s = 1f - .45f * position
                    scaleX = s
                    scaleY = s
                    alpha = (1f - .10f * position).coerceIn(0f, 1f)
                }
        ) {
            Row(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(listOf(
                        Color(0xFF073F35), Color(0xFF065E45)))),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Default.ConfirmationNumber, null,
                    tint = Color(0xFF5EFFB0), modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text(flight.oddsText, fontSize = 13.sp,
                    color = Color.White, fontWeight = FontWeight.Black)
            }
        }
    }
}
