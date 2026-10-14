package com.betvima.app.ui

import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * GPU-rendered, resolution-independent loading identity; never displays fabricated
 * progress or holds the screen hostage while the network is slow.
 *
 * Honors system Animator duration scale: users who disable motion receive a
 * static, branded loading state. Main navigation uses real API-driven skeletons.
 */
@Composable
fun PremiumLoadingOverlay(visible: Boolean, lang: Lang) {
    AnimatedVisibility(visible = visible,
        enter = fadeIn(tween(280)), exit = fadeOut(tween(330))) {
        val context = LocalContext.current
        val motionEnabled = remember(context) {
            runCatching {
                Settings.Global.getFloat(context.contentResolver,
                    Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
            }.getOrDefault(true)
        }
        val animation = rememberInfiniteTransition(label = "betvimaLuxuryLoader")
        val rotation by animation.animateFloat(
            initialValue = 0f, targetValue = if (motionEnabled) 360f else 0f,
            animationSpec = infiniteRepeatable(
                tween(if (motionEnabled) 2100 else 100000, easing = LinearEasing)),
            label = "orbitRotation")
        val breathe by animation.animateFloat(
            initialValue = .55f, targetValue = if (motionEnabled) 1f else .75f,
            animationSpec = infiniteRepeatable(
                tween(if (motionEnabled) 1250 else 100000, easing = FastOutSlowInEasing),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse),
            label = "logoBreathing")
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color(0xFF060D16),
                    Color(0xFF101E29), Color(0xFF060D16)))),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(180.dp), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.fillMaxSize()) {
                        val centerRadius = size.minDimension * .35f
                        drawCircle(
                            brush = Brush.radialGradient(listOf(
                                Palette.green.copy(alpha = .19f * breathe),
                                Palette.blue.copy(alpha = .05f), Color.Transparent)),
                            radius = size.minDimension / 2f)
                        drawCircle(Color.White.copy(alpha = .09f),
                            radius = centerRadius,
                            style = Stroke(width = 1.5.dp.toPx()))
                        drawCircle(Palette.green.copy(alpha = .15f),
                            radius = centerRadius * .72f,
                            style = Stroke(width = 2.dp.toPx()))
                        rotate(rotation) {
                            drawArc(Palette.green, startAngle = -90f,
                                sweepAngle = 104f, useCenter = false,
                                topLeft = androidx.compose.ui.geometry.Offset(
                                    center.x - centerRadius, center.y - centerRadius),
                                size = androidx.compose.ui.geometry.Size(
                                    centerRadius * 2f, centerRadius * 2f),
                                style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round))
                        }
                        rotate(-rotation * .7f) {
                            val smallRadius = centerRadius * .75f
                            drawArc(Palette.blue, startAngle = 35f, sweepAngle = 84f,
                                useCenter = false,
                                topLeft = androidx.compose.ui.geometry.Offset(
                                    center.x - smallRadius, center.y - smallRadius),
                                size = androidx.compose.ui.geometry.Size(
                                    smallRadius * 2f, smallRadius * 2f),
                                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
                        }
                    }
                    Text("BV", color = Color.White,
                        fontSize = 35.sp, fontWeight = FontWeight.Black,
                        letterSpacing = (-2).sp)
                }
                Spacer(Modifier.height(21.dp))
                Text("BETVIMA", fontSize = 31.sp, fontWeight = FontWeight.Black,
                    color = Color.White, letterSpacing = 5.sp)
                Spacer(Modifier.height(9.dp))
                Box(Modifier.width(76.dp).height(3.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Brush.horizontalGradient(listOf(
                        Palette.blue, Palette.green, Palette.blue))))
                Spacer(Modifier.height(22.dp))
                Text(tr(lang, "THE GAME. ELEVATED.", "تجربه‌ای فراتر از بازی"),
                    color = Color(0xFFB2C3CF), fontSize = 11.sp,
                    letterSpacing = 1.sp, textAlign = TextAlign.Center)
            }
        }
    }
}
