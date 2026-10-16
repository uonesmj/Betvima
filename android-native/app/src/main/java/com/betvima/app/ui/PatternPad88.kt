package com.betvima.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.math.hypot

/**
 * Flexible, large nine-dot pattern control shared by setup, re-auth and app launch.
 * Preserves the legacy node representation ("0-1-4-7"), so existing patterns work.
 */
@Composable
internal fun PatternPad88(
    onComplete: (String) -> Unit,
    label: String = "Connect at least four dots"
) {
    val nodes = remember { mutableStateListOf<Int>() }
    var finger by remember { mutableStateOf<Offset?>(null) }
    val callback by rememberUpdatedState(onComplete)
    val progress by animateFloatAsState(
        targetValue = if (nodes.isEmpty()) 0f else 1f,
        animationSpec = tween(150), label = "patternGlow"
    )

    fun select(index: Int) {
        if (index !in 0..8 || index in nodes) return
        if (nodes.isNotEmpty()) {
            val last = nodes.last()
            val dx = index % 3 - last % 3
            val dy = index / 3 - last / 3
            val crossing = (abs(dx) == 2 && abs(dy) == 2) ||
                (abs(dx) == 2 && dy == 0) || (abs(dy) == 2 && dx == 0)
            if (crossing) {
                val mid = ((last / 3 + index / 3) / 2) * 3 +
                    (last % 3 + index % 3) / 2
                if (mid !in nodes) nodes.add(mid)
            }
        }
        nodes.add(index)
    }

    fun dotAt(point: Offset, width: Float, height: Float): Int {
        var result = -1
        var nearest = minOf(width, height) / 7.3f
        for (i in 0..8) {
            val center = Offset(width * ((i % 3) + 1) / 4f,
                height * ((i / 3) + 1) / 4f)
            val distance = hypot(point.x - center.x, point.y - center.y)
            if (distance < nearest) { nearest = distance; result = i }
        }
        return result
    }
    fun submit() {
        if (nodes.size >= 4) callback(nodes.joinToString("-"))
        nodes.clear()
        finger = null
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(label, fontSize = 12.sp, color = Color(0xFFC1C9D8))
            Text("${nodes.size}/9", fontSize = 11.sp, color = Color(0xFF6DAEFF))
        }
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val dimension = maxWidth.coerceAtMost(314.dp)
            Canvas(Modifier.size(dimension)
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { start ->
                            nodes.clear()
                            finger = start
                            select(dotAt(start, size.width.toFloat(), size.height.toFloat()))
                        },
                        onDragEnd = { submit() },
                        onDragCancel = { nodes.clear(); finger = null },
                        onDrag = { change, _ ->
                            finger = change.position
                            select(dotAt(change.position,
                                size.width.toFloat(), size.height.toFloat()))
                            change.consume()
                        }
                    )
                }
                .pointerInput(Unit) {
                    detectTapGestures { point ->
                        select(dotAt(point, size.width.toFloat(), size.height.toFloat()))
                    }
                }
            ) {
                val centers = (0..8).map { n ->
                    Offset(size.width * ((n % 3) + 1) / 4f,
                        size.height * ((n / 3) + 1) / 4f)
                }
                // Large, contrast-rich targets with gentle blue haloes.
                centers.forEachIndexed { n, p ->
                    val active = n in nodes
                    if (active) {
                        drawCircle(Color(0xFF158BFF).copy(alpha = .14f + progress * .07f),
                            radius = 31.dp.toPx(), center = p)
                    }
                    drawCircle(if (active) Color(0xFF208EFF) else Color(0xFF515B73),
                        radius = 24.dp.toPx(), center = p,
                        style = Stroke(3.dp.toPx()))
                    drawCircle(if (active) Color(0xFF69B6FF) else Color(0xFF9DACC7),
                        radius = 8.dp.toPx(), center = p)
                }
                if (nodes.size >= 2) nodes.zipWithNext { a, b ->
                    drawLine(Color(0xFF208EFF), centers[a], centers[b],
                        strokeWidth = 6.dp.toPx(), cap = StrokeCap.Round)
                }
                finger?.let { drag ->
                    if (nodes.isNotEmpty()) drawLine(Color(0xFF68B8FF).copy(alpha = .8f),
                        centers[nodes.last()], drag, strokeWidth = 4.dp.toPx(),
                        cap = StrokeCap.Round)
                }
                // Repaint selected dots atop stroke for crisp centers.
                nodes.forEach { n ->
                    drawCircle(Color(0xFFE8F4FF), radius = 7.dp.toPx(), center = centers[n])
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(19.dp),
            verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { nodes.clear(); finger = null }) {
                Text("Reset", color = Color(0xFFB3C0D5))
            }
            TextButton(enabled = nodes.size >= 4, onClick = ::submit) {
                Text("Confirm pattern", color = Color(0xFF64B4FF))
            }
        }
    }
}
