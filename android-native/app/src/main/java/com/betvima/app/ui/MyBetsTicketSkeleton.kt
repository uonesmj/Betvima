package com.betvima.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon

private val skeletonCard = Color(0xFF222224)
private val skeletonStroke = Color(0xFF39393D)
private val skeletonBase = Color(0xFF333337)
private val skeletonHighlight = Color(0xFF4C4D52)

/**
 * Only replace an *empty* history with placeholders.
 * Refreshes and pagination keep already fetched tickets on screen.
 */
internal fun needsMyBetsSkeleton(isLoading: Boolean, hasTickets: Boolean): Boolean =
    isLoading && !hasTickets

/**
 * A native, dark, collapsed-ticket-sized loading state. Never inserts a
 * white sports/fixture skeleton or invented bet figures in account history.
 */
@Composable
internal fun MyBetsTicketSkeleton(modifier: Modifier = Modifier) {
    val shimmer = rememberInfiniteTransition(label = "myBetsShimmer")
    val phase by shimmer.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(durationMillis = 1600, easing = LinearEasing)
        ),
        label = "myBetsShimmerTravel"
    )
    val start = -360f + phase * 1260f
    val brush = Brush.linearGradient(
        colors = listOf(skeletonBase, skeletonHighlight, skeletonBase),
        start = Offset(start, 0f), end = Offset(start + 320f, 0f)
    )
    val chipShape = RoundedCornerShape(11.dp)
    Box(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 3.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(skeletonCard)
                .border(1.dp, skeletonStroke, RoundedCornerShape(18.dp))
                .padding(horizontal = 13.dp, vertical = 17.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.size(39.dp).clip(chipShape).background(brush))
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.fillMaxWidth(.48f).height(12.dp)
                    .clip(RoundedCornerShape(6.dp)).background(brush))
                Box(Modifier.fillMaxWidth(.72f).height(9.dp)
                    .clip(RoundedCornerShape(6.dp)).background(brush))
            }
            Spacer(Modifier.width(11.dp))
            Box(Modifier.width(54.dp).height(29.dp)
                .clip(chipShape).background(brush))
            Spacer(Modifier.width(12.dp))
            Box(Modifier.width(15.dp).height(10.dp)
                .clip(RoundedCornerShape(4.dp)).background(brush))
        }
        // Match the same notched silhouette as real My Bets tickets.
        Box(
            modifier = Modifier.align(Alignment.CenterStart)
                .size(15.dp)
                .background(Palette.headerDark, CircleShape)
        )
        Box(
            modifier = Modifier.align(Alignment.CenterEnd)
                .size(15.dp)
                .background(Palette.headerDark, CircleShape)
        )
        Box(
            modifier = Modifier.align(Alignment.TopCenter)
                .width(28.dp).height(7.dp)
                .background(Palette.headerDark,
                    RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
        )
        Box(
            modifier = Modifier.align(Alignment.BottomCenter)
                .width(28.dp).height(7.dp)
                .background(Palette.headerDark,
                    RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
        )
    }
}

/** Spins only during background refresh with existing tickets. */
@Composable
internal fun MyBetsRefreshGlyph(loading: Boolean, modifier: Modifier = Modifier) {
    if (loading) {
        val transition = rememberInfiniteTransition(label = "myBetsRefresh")
        val angle by transition.animateFloat(
            initialValue = 0f, targetValue = 360f,
            animationSpec = infiniteRepeatable(
                tween(durationMillis = 1100, easing = LinearEasing)),
            label = "refreshSpin"
        )
        Icon(Icons.Default.Refresh, contentDescription = null,
            tint = Color(0xFFB7B9C0),
            modifier = modifier.rotate(angle))
    } else {
        Icon(Icons.Default.Refresh, contentDescription = null,
            tint = Color(0xFFB7B9C0),
            modifier = modifier)
    }
}
