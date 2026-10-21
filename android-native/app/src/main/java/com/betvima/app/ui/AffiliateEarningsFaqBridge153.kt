package com.betvima.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/**
 * Seamless, deliberately shaped connector between the earnings CTA and FAQ.
 *
 * The white paint reaches BOTH vertical edges of this composable. Rendered
 * inside the same light parent as the earnings and FAQ, it avoids the black
 * wedges that appear when a rounded FAQ is inserted as a separate LazyColumn
 * item. Blue traces extend to the canvas edges, bridging both panels.
 */
@Composable
internal fun AffiliateEarningsFaqBridge153(modifier: Modifier = Modifier) {
    val white = Color(0xFFF7FAF6)
    val night = Color(0xFF070B09)
    val blue = Color(0xFF43AAFF)

    Canvas(
        modifier.fillMaxWidth().height(73.dp).background(white)
    ) {
        val w = size.width
        val h = size.height

        // The top is a physical continuation of the earnings white panel.
        val upper = Path().apply {
            moveTo(0f, 0f)
            lineTo(w, 0f)
            lineTo(w, h * .31f)
            cubicTo(w * .94f, h * .31f, w * .92f, h * .40f,
                w * .85f, h * .40f)
            lineTo(w * .57f, h * .40f)
            cubicTo(w * .50f, h * .40f, w * .49f, h * .22f,
                w * .43f, h * .22f)
            lineTo(w * .19f, h * .22f)
            cubicTo(w * .10f, h * .22f, w * .10f, h * .43f,
                0f, h * .43f)
            close()
        }

        // The lower white edge grows into the FAQ: no background slivers.
        val lower = Path().apply {
            moveTo(0f, h * .78f)
            lineTo(w * .15f, h * .78f)
            cubicTo(w * .22f, h * .78f, w * .21f, h * .57f,
                w * .29f, h * .57f)
            lineTo(w * .61f, h * .57f)
            cubicTo(w * .69f, h * .57f, w * .71f, h * .82f,
                w * .78f, h * .82f)
            lineTo(w, h * .82f)
            lineTo(w, h)
            lineTo(0f, h)
            close()
        }

        // Dark ribbon is fully enclosed by both white panels.
        drawRect(night)
        drawPath(upper, white)
        drawPath(lower, white)

        // Primary electric-blue trace follows the irregular ribbon, rather
        // than floating as a straight line in empty space.
        val trace = Path().apply {
            moveTo(-2f, h * .61f)
            lineTo(w * .12f, h * .61f)
            lineTo(w * .20f, h * .43f)
            lineTo(w * .34f, h * .43f)
            lineTo(w * .42f, h * .69f)
            lineTo(w * .58f, h * .69f)
            lineTo(w * .66f, h * .49f)
            lineTo(w * .81f, h * .49f)
            lineTo(w * .90f, h * .63f)
            lineTo(w + 2f, h * .63f)
        }
        val secondary = Path().apply {
            moveTo(0f, h * .73f)
            lineTo(w * .10f, h * .73f)
            lineTo(w * .19f, h * .53f)
            lineTo(w * .27f, h * .53f)
            moveTo(w * .53f, h * .78f)
            lineTo(w * .61f, h * .78f)
            lineTo(w * .69f, h * .58f)
            lineTo(w * .78f, h * .58f)
        }
        drawPath(trace, Color(0x33157FFF),
            style = Stroke(width = 13.dp.toPx(), cap = StrokeCap.Round,
                join = StrokeJoin.Round))
        drawPath(trace, Color(0x9944AEFF),
            style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round,
                join = StrokeJoin.Round))
        drawPath(trace, blue,
            style = Stroke(width = 1.55.dp.toPx(), cap = StrokeCap.Round,
                join = StrokeJoin.Round))
        drawPath(secondary, Color(0xFF287CC6),
            style = Stroke(width = 1.1.dp.toPx(), cap = StrokeCap.Round,
                join = StrokeJoin.Round))

        listOf(
            Offset(w * .12f, h * .61f),
            Offset(w * .42f, h * .69f),
            Offset(w * .81f, h * .49f)
        ).forEach { point ->
            drawCircle(Color(0x332B99FF), radius = 10.dp.toPx(), center = point)
            drawCircle(Color(0xFF63C0FF), radius = 4.dp.toPx(), center = point)
            drawCircle(Color.White, radius = 1.8.dp.toPx(), center = point)
        }
    }
}
