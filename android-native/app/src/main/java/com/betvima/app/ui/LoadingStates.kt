package com.betvima.app.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Stable-sized placeholders avoid an abrupt empty-state flash while refreshing
 * the sports catalogue. Never fabricate matches, prices or expected winnings.
 */
@Composable
fun FixtureSkeleton(modifier: Modifier = Modifier) {
    val movement = rememberInfiniteTransition(label = "fixturePlaceholder")
    val opacity by movement.animateFloat(
        initialValue = .42f, targetValue = .88f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse), label = "placeholderOpacity")
    val darkHome = LocalDarkHome.current
    val pale = (if (darkHome) Color(0xFF4D4E55) else Color(0xFFCFD5DE))
        .copy(alpha = opacity)
    Surface(color = if (darkHome) DarkHomePalette.panel else Color.White,
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 1.dp) {
        Column(Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row {
                Box(Modifier.size(28.dp).clip(CircleShape).background(pale))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.fillMaxWidth(.65f).height(10.dp)
                        .clip(RoundedCornerShape(6.dp)).background(pale))
                    Box(Modifier.fillMaxWidth(.42f).height(8.dp)
                        .clip(RoundedCornerShape(6.dp)).background(pale))
                }
            }
            Spacer(Modifier.height(3.dp))
            repeat(2) {
                Row {
                    Box(Modifier.size(28.dp).clip(CircleShape).background(pale))
                    Spacer(Modifier.width(9.dp))
                    Box(Modifier.fillMaxWidth(.6f).height(13.dp)
                        .clip(RoundedCornerShape(6.dp)).background(pale))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                repeat(3) {
                    Box(Modifier.weight(1f).height(48.dp)
                        .clip(RoundedCornerShape(10.dp)).background(pale))
                }
            }
        }
    }
}
