package com.betvima.app.ui

import android.provider.Settings
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.gestures.FlingBehavior
import androidx.compose.foundation.gestures.ScrollableDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.ui.draw.rotate
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.runtime.remember
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
    AnimatedVisibility(
        visible = visible,
        enter = EnterTransition.None,
        exit = fadeOut(tween(260))
    ) {
        val context = LocalContext.current
        val motionEnabled = remember(context) {
            runCatching {
                Settings.Global.getFloat(
                    context.contentResolver,
                    Settings.Global.ANIMATOR_DURATION_SCALE, 1f
                ) > 0f
            }.getOrDefault(true)
        }
        val movement = rememberInfiniteTransition(label = "betvimaWatermarkBounce")
        val verticalBounce by movement.animateFloat(
            initialValue = -24f,
            targetValue = 24f,
            animationSpec = infiniteRepeatable(
                animation = tween(1500, easing = androidx.compose.animation.core.CubicBezierEasing(.42f, 0f, .58f, 1f)),
                repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
            ),
            label = "watermarkVerticalPosition"
        )
        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            // Exactly one subdued BetVima wordmark. No BV icon, orbit,
            // second caption, glow, progress bar, or duplicate watermark.
            Text(
                text = "BetVima",
                color = Color(0xFF73777F).copy(alpha = .28f),
                fontSize = 31.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = -.5.sp,
                modifier = Modifier.offset(
                    y = if (motionEnabled) verticalBounce.dp else 0.dp
                )
            )
        }
    }
}

/**
 * Native Android velocity-based spline fling for vertical and horizontal feeds.
 * The old 460ms tween + hard 2350px travel cap made long lists feel sticky.
 * Compose's default decay permits gesture interruption and nested scrolling.
 */
@Composable
fun rememberPremiumFlingBehavior(): FlingBehavior =
    ScrollableDefaults.flingBehavior()

/** Coordinated expansion and fading, instead of instant if(expanded) removal. */
@Composable
fun SmoothExpandedContent(
    expanded: Boolean,
    content: @Composable () -> Unit
) {
    AnimatedVisibility(
        visible = expanded,
        enter = expandVertically(animationSpec = tween(310, easing = FastOutSlowInEasing)) +
            fadeIn(animationSpec = tween(220)),
        exit = shrinkVertically(animationSpec = tween(270, easing = FastOutSlowInEasing)) +
            fadeOut(animationSpec = tween(170))
    ) {
        content()
    }
}

@Composable
fun SmoothExpandChevron(
    expanded: Boolean,
    description: String? = null,
    tint: Color = Color(0xFF9CA3AF),
    modifier: Modifier = Modifier
) {
    val rotation by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        animationSpec = tween(290, easing = FastOutSlowInEasing),
        label = "betvimaChevron"
    )
    Icon(
        Icons.Default.ExpandMore,
        contentDescription = description,
        tint = tint,
        modifier = modifier.rotate(rotation)
    )
}
