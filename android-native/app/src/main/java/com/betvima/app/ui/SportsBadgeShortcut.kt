package com.betvima.app.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawImage
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

/** The eight owner-approved illustrations packed in one offline 4x2 atlas.
 * All pixels are bundled in drawable-nodpi, so shortcuts work without network access.
 */
@Composable
fun SportsBadgeShortcut(
    label: String, index: Int, selected: Boolean, onClick: () -> Unit
) {
    val context = LocalContext.current
    val bitmap = remember(context) {
        BitmapFactory.decodeResource(context.resources, R.drawable.betvima_sport_badges)
            .asImageBitmap()
    }
    val slot = index.coerceIn(0, 7)
    val width = bitmap.width / 4
    val height = bitmap.height / 2
    val scale by animateFloatAsState(
        if (selected) 1.07f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow),
        label = "sportBadgeScale"
    )
    val edge by animateColorAsState(
        if (selected) Palette.blue else Color(0xFFB5C6D8),
        label = "sportBadgeBorder"
    )
    Column(
        Modifier.width(84.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            shape = CircleShape,
            color = Color(0xFF07121B),
            border = BorderStroke(if (selected) 2.dp else 1.dp, edge),
            modifier = Modifier.size(78.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale }
                .shadow(if (selected) 7.dp else 2.dp, CircleShape)
        ) {
            Canvas(Modifier.fillMaxSize().clip(CircleShape)) {
                drawImage(
                    image = bitmap,
                    srcOffset = IntOffset((slot % 4) * width, (slot / 4) * height),
                    srcSize = IntSize(width, height),
                    dstSize = IntSize(size.width.toInt(), size.height.toInt())
                )
            }
        }
        Spacer(Modifier.height(7.dp))
        Text(
            label, fontSize = 10.sp, lineHeight = 13.sp,
            fontWeight = if (selected) FontWeight.Black else FontWeight.SemiBold,
            color = Palette.text, textAlign = TextAlign.Center,
            maxLines = 2, overflow = TextOverflow.Ellipsis
        )
    }
}
