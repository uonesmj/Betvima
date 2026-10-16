package com.betvima.app.ui

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

/** Native Android-style nine-dot pattern, gesture trace plus accessible tap sequence. */
@Composable
internal fun PatternPad88(
    onComplete: (String) -> Unit,
    label: String = "Draw or tap at least four different dots"
) {
    val nodes = remember { mutableStateListOf<Int>() }
    var finger by remember { mutableStateOf<Offset?>(null) }
    val callback by rememberUpdatedState(onComplete)
    fun select(index: Int) {
        if (index < 0 || index > 8 || index in nodes) return
        if (nodes.isNotEmpty()) {
            val last = nodes.last()
            val dx = index % 3 - last % 3
            val dy = index / 3 - last / 3
            if (abs(dx) == 2 && abs(dy) == 2 ||
                (abs(dx) == 2 && dy == 0) || (abs(dy) == 2 && dx == 0)) {
                val middle = ((last / 3 + index / 3) / 2) * 3 +
                    (last % 3 + index % 3) / 2
                if (middle !in nodes) nodes.add(middle)
            }
        }
        nodes.add(index)
    }
    fun match(point: Offset, width: Float, height: Float): Int {
        val delta = (minOf(width, height) / 4f)
        var closest = -1
        var best = delta * .62f
        for (i in 0..8) {
            val center = Offset(width * ((i % 3) + 1) / 4f,
                height * ((i / 3) + 1) / 4f)
            val d = hypot(point.x - center.x, point.y - center.y)
            if (d < best) { best = d; closest = i }
        }
        return closest
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(label, fontSize = 11.sp, color = Color(0xFFADB7CC))
        Canvas(
            Modifier.size(236.dp)
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { point ->
                            nodes.clear(); finger = point
                            val n = match(point, size.width.toFloat(), size.height.toFloat())
                            select(n)
                        },
                        onDragEnd = {
                            finger = null
                            if (nodes.size >= 4) callback(nodes.joinToString("-"))
                            nodes.clear()
                        },
                        onDragCancel = { nodes.clear(); finger = null },
                        onDrag = { change, _ ->
                            finger = change.position
                            val n = match(change.position, size.width.toFloat(),
                                size.height.toFloat())
                            select(n)
                            change.consume()
                        }
                    )
                }
                .pointerInput(Unit) {
                    detectTapGestures { point ->
                        select(match(point, size.width.toFloat(), size.height.toFloat()))
                    }
                }
        ) {
            val centers = (0..8).map { index ->
                Offset(size.width * ((index % 3) + 1) / 4f,
                    size.height * ((index / 3) + 1) / 4f)
            }
            if (nodes.size >= 2) nodes.zipWithNext { a, b ->
                drawLine(Color(0xFF168CFF), centers[a], centers[b],
                    strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round)
            }
            if (nodes.isNotEmpty() && finger != null)
                drawLine(Color(0xFF7CAEFF), centers[nodes.last()], finger!!,
                    strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round)
            centers.forEachIndexed { i, center ->
                val selected = i in nodes
                drawCircle(if (selected) Color(0xFF168CFF) else Color(0xFF555D71),
                    radius = if (selected) 17.dp.toPx() else 15.dp.toPx(),
                    center = center, style = Stroke(width = 2.7.dp.toPx()))
                drawCircle(if (selected) Color(0xFFB4D4FF) else Color(0xFFA2AEC2),
                    radius = if (selected) 6.dp.toPx() else 5.dp.toPx(), center = center)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { nodes.clear(); finger = null }) {
                Text("Reset", color = Color(0xFFADB7CC))
            }
            TextButton(enabled = nodes.size >= 4, onClick = {
                callback(nodes.joinToString("-"))
                nodes.clear(); finger = null
            }) { Text("Confirm pattern", color = Color(0xFF67B0FF)) }
        }
    }
}
