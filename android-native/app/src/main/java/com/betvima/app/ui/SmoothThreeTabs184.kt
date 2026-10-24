package com.betvima.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

/** Three independent, immutable positions with a single sliding active surface. */
internal data class SmoothTab184<T>(val value: T, val label: String)

internal fun <T> smoothTabIndex184(options: List<SmoothTab184<T>>, selected: T): Int =
    options.indexOfFirst { it.value == selected }.coerceAtLeast(0)

internal fun nextSmoothTab184(index: Int, lastIndex: Int, dragDelta: Float): Int =
    (index + if (dragDelta < 0f) 1 else -1).coerceIn(0, lastIndex)

/**
 * Same three-tab control shared by My Bets and Notifications.
 * Animates one blue surface across slots, rather than instantly recoloring a
 * clicked box. Supports a horizontal swipe without changing route/network logic.
 */
@Composable
internal fun <T> SmoothThreeTabs184(
    selected: T,
    options: List<SmoothTab184<T>>,
    modifier: Modifier = Modifier,
    height: Dp = 43.dp,
    textSize: androidx.compose.ui.unit.TextUnit = 11.sp,
    onSelect: (T) -> Unit
) {
    require(options.size == 3)
    val index = smoothTabIndex184(options, selected)
    val density = LocalDensity.current
    val thresholdPx = with(density) { 42.dp.toPx() }
    var draggedPx by remember { mutableFloatStateOf(0f) }
    val radius = RoundedCornerShape(14.dp)
    BoxWithConstraints(
        modifier = modifier.height(height)
            .clip(radius)
            .background(Color(0xFF29292C))
            .border(1.dp, Color(0xFF3B3D43), radius)
            .pointerInput(index, options.map { it.value }) {
                detectHorizontalDragGestures(
                    onDragStart = { draggedPx = 0f },
                    onHorizontalDrag = { change, dx ->
                        draggedPx += dx
                        change.consume()
                    },
                    onDragCancel = { draggedPx = 0f },
                    onDragEnd = {
                        if (abs(draggedPx) >= thresholdPx) {
                            val target = nextSmoothTab184(index, options.lastIndex, draggedPx)
                            if (target != index) onSelect(options[target].value)
                        }
                        draggedPx = 0f
                    }
                )
            }
            .padding(3.dp),
    ) {
        val slot = maxWidth / options.size
        val offset by animateDpAsState(
            targetValue = slot * index,
            animationSpec = tween(durationMillis = 330, easing = FastOutSlowInEasing),
            label = "smooth184SelectedPosition"
        )
        Box(
            Modifier.offset(x = offset)
                .width(slot).fillMaxHeight()
                .clip(RoundedCornerShape(11.dp))
                .background(
                    androidx.compose.ui.graphics.Brush.horizontalGradient(
                        listOf(Color(0xFF168EFF), Color(0xFF097AF0))
                    )
                )
        )
        Row(Modifier.fillMaxSize()) {
            options.forEach { tab ->
                val active = tab.value == selected
                val color by animateColorAsState(
                    targetValue = if (active) Color.White else Color(0xFFCACBD3),
                    animationSpec = tween(210),
                    label = "smooth184Caption"
                )
                Box(
                    modifier = Modifier.weight(1f).fillMaxHeight()
                        .clip(RoundedCornerShape(11.dp))
                        .clickable(
                            interactionSource = remember(tab.value) { MutableInteractionSource() },
                            indication = null,
                            role = Role.Tab,
                            onClick = { if (!active) onSelect(tab.value) }
                        )
                        .semantics { this.selected = active },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        tab.label,
                        color = color,
                        fontSize = textSize,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}
