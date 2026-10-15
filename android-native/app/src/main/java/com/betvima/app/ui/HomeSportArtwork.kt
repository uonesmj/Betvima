package com.betvima.app.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.R

/**
 * The 8 approved original AI artwork badges are compiled into one efficient offline
 * WebP atlas, in this fixed order: football, tennis, basketball, hockey,
 * table tennis, volleyball, baseball, esports (4 columns × 2 rows).
 */
@Composable
fun SportsBadgeShortcut(
    label: String, index: Int, selected: Boolean = false,
    onClick: () -> Unit
) {
    require(index in 0..7)
    val context = LocalContext.current
    val atlas = remember(context) {
        BitmapFactory.decodeResource(context.resources,
            R.drawable.betvima_sport_badges).asImageBitmap()
    }
    val rim by animateColorAsState(
        if (selected) Palette.blue else Color(0xFFB8C6D3),
        label = "sportBadgeRim")
    val scale by animateFloatAsState(
        if (selected) 1.06f else 1f,
        animationSpec = spring(), label = "sportBadgeScale")
    Column(Modifier.width(86.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(
            modifier = Modifier.size(75.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale },
            shape = CircleShape,
            border = BorderStroke(if (selected) 2.dp else 1.dp, rim),
            color = Color(0xFF0A1522)
        ) {
            Canvas(Modifier.fillMaxSize().clip(CircleShape)) {
                val tile = 112
                drawImage(
                    image = atlas,
                    srcOffset = IntOffset((index % 4) * tile, (index / 4) * tile),
                    srcSize = IntSize(tile, tile),
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(size.width.toInt(), size.height.toInt()),
                    filterQuality = FilterQuality.High
                )
            }
        }
        Spacer(Modifier.height(7.dp))
        Text(label, textAlign = TextAlign.Center,
            fontWeight = if (selected) FontWeight.Black else FontWeight.SemiBold,
            fontSize = 10.sp, lineHeight = 13.sp,
            color = Palette.text, maxLines = 2,
            overflow = TextOverflow.Ellipsis)
    }
}


/**
 * Curated competition artwork supplied by the user, offline and bundled with
 * the application. Four strips contain exactly 16 original round badges, with
 * no poster captions or network dependency. Each tile is 112 x 112 pixels.
 */
@Composable
fun LeagueBadgeShortcut(label: String, index: Int, onClick: () -> Unit) {
    require(index in 0..15) { "Unknown competition artwork index: $index" }
    val context = LocalContext.current
    val strip = index / 4
    val resId = when (strip) {
        0 -> R.drawable.betvima_league_row_0
        1 -> R.drawable.betvima_league_row_1
        2 -> R.drawable.betvima_league_row_2
        else -> R.drawable.betvima_league_row_3
    }
    val atlas = remember(context, resId) {
        BitmapFactory.decodeResource(context.resources, resId).asImageBitmap()
    }
    Column(
        Modifier.width(70.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            modifier = Modifier.size(64.dp),
            shape = CircleShape,
            color = Color.White,
            border = BorderStroke(1.dp, Color(0xFFD4DEE8))
        ) {
            Canvas(Modifier.fillMaxSize().clip(CircleShape)) {
                drawImage(
                    image = atlas,
                    srcOffset = IntOffset((index % 4) * 112, 0),
                    srcSize = IntSize(112, 112),
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(size.width.toInt(), size.height.toInt()),
                    filterQuality = FilterQuality.High
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            label, textAlign = TextAlign.Center,
            color = Palette.text,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 10.sp,
            lineHeight = 13.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}
