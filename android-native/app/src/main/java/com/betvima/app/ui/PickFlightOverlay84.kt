package com.betvima.app.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

private val flightBlue = Color(0xFF087FF5)
private val flightCyan = Color(0xFF4FCBFF)

/**
 * A true center-to-center market transfer, using actual measured window
 * coordinates of the tapped selection and Bet Slip FAB. No fixed bottom
 * margins, device-height guesses, or fake destination. Visual layer only.
 */
@Composable
internal fun PickFlightOverlay84(
    flight: PickFlight84?,
    windowOrigin: Offset,
    targetWindowCenter: Offset,
    onLanded: (Long) -> Unit
) {
    if (flight == null) return
    var launched by remember(flight.revision) { mutableStateOf(false) }
    val progress by animateFloatAsState(
        if (launched) 1f else 0f,
        animationSpec = tween(490, easing = FastOutSlowInEasing),
        label = "blueOddsToActualSlip")
    val shimmer = rememberInfiniteTransition(label = "movingOddsBlue")
    val pulse by shimmer.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 290, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "pulsingBlueOdds")
    LaunchedEffect(flight.revision) {
        // A short frame for the FAB's measured bounds to become available.
        withFrameNanos { }
        launched = true
        delay(520L)
        onLanded(flight.revision)
    }
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val screenW = constraints.maxWidth.toFloat()
        val screenH = constraints.maxHeight.toFloat()
        val sourceX = if (flight.originX.isFinite())
            (flight.originX - windowOrigin.x).coerceIn(0f, screenW)
        else screenW / 2f
        val sourceY = if (flight.originY.isFinite())
            (flight.originY - windowOrigin.y).coerceIn(0f, screenH)
        else screenH * .5f
        val destinationX = if (targetWindowCenter.x.isFinite())
            targetWindowCenter.x - windowOrigin.x else screenW / 2f
        val destinationY = if (targetWindowCenter.y.isFinite())
            targetWindowCenter.y - windowOrigin.y else screenH - with(density) { 86.dp.toPx() }

        // Ends EXACTLY at the measured button center. A gentle upward arc
        // keeps the motion legible without overshooting or falling short.
        val bend = with(density) { 37.dp.toPx() } * 4f * progress * (1f-progress)
        val x = sourceX + (destinationX-sourceX)*progress
        val y = sourceY + (destinationY-sourceY)*progress - bend
        val halfWidth = with(density) { 35.dp.toPx() }
        val halfHeight = with(density) { 18.dp.toPx() }
        val vanish = ((1f-progress)*5f).coerceIn(0f, 1f)

        Canvas(Modifier.fillMaxSize()) {
            val d = 1f-progress
            if (d > 0.05f) {
                drawCircle(flightBlue.copy(alpha = .18f*d),
                    radius = 20.dp.toPx()*(.8f+pulse*.4f),
                    center = Offset(x,y))
                drawCircle(flightCyan.copy(alpha = .32f*d),
                    radius = 4.dp.toPx(), center = Offset(
                        x-(x-sourceX)*.15f, y-(y-sourceY)*.15f))
                drawCircle(flightBlue.copy(alpha = .20f*d),
                    radius = 3.dp.toPx(), center = Offset(
                        x-(x-sourceX)*.31f, y-(y-sourceY)*.31f))
            }
            if (progress > .76f) {
                val impact = (progress-.76f)/.24f
                drawCircle(
                    color = flightCyan.copy(alpha = (1f-impact)*.58f),
                    center = Offset(destinationX,destinationY),
                    radius = 18.dp.toPx()+18.dp.toPx()*impact,
                    style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
                )
            }
        }
        Surface(
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.2.dp, Color(0xFF99E3FF)),
            color = flightBlue,
            shadowElevation = 10.dp,
            modifier = Modifier
                .offset {
                    IntOffset(
                        (x-halfWidth).roundToInt(),
                        (y-halfHeight).roundToInt()
                    )
                }
                .width(70.dp).height(36.dp)
                .graphicsLayer {
                    // The chip is alive while flying: a gentle wobble/pulse,
                    // then it shrinks and visibly enters the actual blue FAB.
                    val shrink = (1f - .87f*progress)
                    val breathe = 1f + .07f*pulse*(1f-progress)
                    scaleX = shrink*breathe
                    scaleY = shrink*breathe
                    rotationZ = (1f-progress)*(pulse*8f-4f)
                    alpha = vanish
                }
        ) {
            Row(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(listOf(
                        Color(0xFF0062D9), flightBlue, Color(0xFF23B7FF)))),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.ConfirmationNumber, null,
                    tint = Color.White, modifier = Modifier.size(15.dp)
                        .graphicsLayer { rotationZ = (pulse-.5f)*12f })
                Spacer(Modifier.width(4.dp))
                Text(flight.oddsText, fontSize = 12.sp,
                    color = Color.White, fontWeight = FontWeight.Black)
            }
        }
    }
}
