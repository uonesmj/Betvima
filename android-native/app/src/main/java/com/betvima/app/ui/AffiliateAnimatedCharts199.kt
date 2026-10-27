package com.betvima.app.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.floor

/**
 * Decorative chart, not a financial report. Illustrative points are never
 * labeled as partner earnings or passed to the authenticated reporting API.
 * It draws vector shapes at any device width and animates only when visible.
 */
@Composable
internal fun AffiliateAnimatedChart199(
    active: Boolean,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    val enter by animateFloatAsState(
        targetValue = if(active) 1f else 0f,
        animationSpec = tween(1350, easing = FastOutSlowInEasing),
        label = "affiliate-chart-reveal"
    )
    val infinite = rememberInfiniteTransition(label = "affiliate-chart-flow")
    val orbit by infinite.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "affiliate-chart-moving-marker"
    )
    val values = remember { listOf(.26f, .39f, .33f, .51f, .47f, .67f, .58f, .77f, .72f, .94f) }
    Box(modifier.clip(RoundedCornerShape(16.dp))
        .background(Brush.linearGradient(listOf(
            Color(0xFF0C1832), Color(0xFF111D3F), Color(0xFF0A1327)
        )))) {
        Canvas(Modifier.fillMaxSize().padding(horizontal = 13.dp, vertical = 12.dp)) {
            val w = size.width
            val h = size.height
            if (w <= 1f || h <= 1f) return@Canvas
            val graphTop = h * .12f
            val graphBottom = h * (if (compact) .89f else .73f)
            val graphHeight = graphBottom - graphTop
            val chartWidth = w * .94f
            val x0 = w * .03f
            val step = chartWidth / (values.size - 1f)

            // Responsive grid and faint guides.
            repeat(4) { i ->
                val y = graphTop + (i / 3f) * graphHeight
                drawLine(
                    Color(0xFF50658C).copy(alpha=.34f),
                    Offset(x0, y), Offset(x0+chartWidth, y),
                    strokeWidth = 1.dp.toPx()
                )
            }
            repeat(6) { i ->
                val x = x0 + (i / 5f) * chartWidth
                drawLine(
                    Color(0xFF52628A).copy(alpha=.16f),
                    Offset(x,graphTop),Offset(x,graphBottom),
                    strokeWidth = 1.dp.toPx()
                )
            }

            // Secondary mini-histogram with staggered pulse.
            if (!compact) {
                values.forEachIndexed { i, value ->
                    val barH = (h * .21f) * (.25f+value*.76f) * enter
                    val pulse = .85f + .15f * (if (active) orbit else 0f)
                    val width = chartWidth / (values.size * 2.4f)
                    drawRoundRect(
                        brush = Brush.verticalGradient(
                            listOf(Color(0xFF2BE2CA).copy(alpha = .78f * pulse),
                                Color(0xFF2549AF).copy(alpha=.38f))),
                        topLeft = Offset(x0+i*step-width/2f,h-barH),
                        size = Size(width,barH.coerceAtLeast(.2f)),
                        cornerRadius = CornerRadius(4.dp.toPx())
                    )
                }
            }
            val positions = values.mapIndexed { i,v ->
                Offset(x0+i*step, graphBottom-v*graphHeight)
            }
            val progress = (enter*(positions.size-1)).coerceIn(0f,(positions.size-1).toFloat())
            val whole = floor(progress).toInt()
            val frac = progress-whole
            val line = Path().apply {
                moveTo(positions[0].x,positions[0].y)
                for (i in 1..whole) lineTo(positions[i].x,positions[i].y)
                if (whole < positions.lastIndex) {
                    val a=positions[whole];val b=positions[whole+1]
                    lineTo(a.x+(b.x-a.x)*frac,a.y+(b.y-a.y)*frac)
                }
            }
            drawPath(line, brush=Brush.horizontalGradient(listOf(
                Color(0xFF58C6FF),Color(0xFF5B98FF),Color(0xFF43F0BC)
            )),style=Stroke(width=3.dp.toPx(),cap=StrokeCap.Round))
            for (i in 0..whole) {
                drawCircle(Color(0xFF80FFE7),radius=2.8.dp.toPx(),center=positions[i])
            }
            if(active && enter > .98f) {
                val z=(orbit*positions.lastIndex).coerceIn(0f,positions.lastIndex.toFloat())
                val at=floor(z).toInt().coerceIn(0,positions.lastIndex)
                val bt=(at+1).coerceAtMost(positions.lastIndex)
                val f=z-at
                val dot=Offset(
                    positions[at].x+(positions[bt].x-positions[at].x)*f,
                    positions[at].y+(positions[bt].y-positions[at].y)*f
                )
                drawCircle(Color(0xFF42F7CC).copy(alpha=.19f),radius=14.dp.toPx(),center=dot)
                drawCircle(Color.White,radius=4.1.dp.toPx(),center=dot)
            }
        }
        if(!compact) {
            Text("BETVIMA · ILLUSTRATIVE",
                modifier=Modifier.align(Alignment.TopStart).padding(12.dp),
                color=Color(0xFFC0D1F4),fontSize=9.sp,fontWeight=FontWeight.Bold)
        }
    }
}

/** Animated earnings-free bar illustration accompanying the line visualization. */
@Composable
internal fun AffiliateAnimatedBars199(
    active:Boolean,
    modifier:Modifier=Modifier
) {
    val values = remember { listOf(.23f,.49f,.38f,.67f,.45f,.80f,.61f,1f) }
    val animation = rememberInfiniteTransition(label="affiliate-bars-breathing")
    val light by animation.animateFloat(
        initialValue=.68f, targetValue=1f,
        animationSpec=infiniteRepeatable(tween(1800,easing=EaseInOutSine),
            RepeatMode.Reverse),label="affiliate-bars-luminance")
    BoxWithConstraints(modifier) {
        Row(Modifier.fillMaxSize(),horizontalArrangement=Arrangement.spacedBy(8.dp),
            verticalAlignment=Alignment.Bottom) {
            values.forEachIndexed { i,value ->
                val target=if(active) value else .015f
                val level by animateFloatAsState(targetValue=target,
                    animationSpec=tween(750+i*88,easing=FastOutSlowInEasing),
                    label="affiliate-bar-$i")
                Box(Modifier.weight(1f).fillMaxHeight(level.coerceAtLeast(.01f))
                    .clip(RoundedCornerShape(topStart=9.dp,topEnd=9.dp))
                    .background(Brush.verticalGradient(
                        if(i==5 || i==7) listOf(
                            Color(0xFF6BFFDB).copy(alpha=light),
                            Color(0xFF3054BB))
                        else listOf(
                            Color(0xFF4A80F4).copy(alpha=.7f+light*.24f),
                            Color(0xFF202F55))
                    )))
            }
        }
    }
}
