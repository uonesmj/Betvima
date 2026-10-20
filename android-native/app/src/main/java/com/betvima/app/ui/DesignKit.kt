package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * BetVima Design System 2.0.
 *
 * A coherent native visual language instead of copying branded assets from another sportsbook.
 * Use the same spacings, stroke, corner radius, and accessibility tap areas on every screen.
 * Visual elements must never imply that a financial action completed.
 */
object BvSpace {
    val screen = 16.dp
    val card = 18.dp
    val section = 20.dp
    val tight = 8.dp
    val tap = 48.dp
    val corner = 20.dp
    val largeCorner = 26.dp
}

val bvHeroBrush get() = Brush.linearGradient(
    listOf(Palette.ink, Color(0xFF0D2733), Color(0xFF104338))
)

@Composable
fun BvPageBanner(
    eyebrow: String,
    title: String,
    subtitle: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    accent: Color = Palette.green,
    content: @Composable ColumnScope.() -> Unit = {}
) {
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(BvSpace.largeCorner))
        .background(bvHeroBrush)) {
        Box(Modifier.align(Alignment.TopEnd).offset(x = 38.dp, y = (-45).dp)
            .size(170.dp).clip(CircleShape)
            .background(accent.copy(alpha = .07f)))
        Box(Modifier.align(Alignment.BottomStart).offset(x = (-60).dp, y = 75.dp)
            .size(155.dp).clip(CircleShape)
            .background(Palette.blue.copy(alpha = .08f)))
        Column(Modifier.fillMaxWidth().padding(21.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = accent.copy(alpha = .14f),
                    shape = RoundedCornerShape(10.dp)) {
                    Icon(icon, null, tint = accent,
                        modifier = Modifier.padding(10.dp).size(21.dp))
                }
                Spacer(Modifier.width(10.dp))
                Text(eyebrow.uppercase(), fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold, letterSpacing = .8.sp,
                    color = accent)
            }
            Text(title, fontSize = 23.sp, lineHeight = 30.sp,
                fontWeight = FontWeight.Black, color = Color.White)
            Text(subtitle, fontSize = 12.sp, lineHeight = 19.sp,
                color = Color(0xFFB6C8CE))
            content()
        }
    }
}

@Composable
fun BvStatCard(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Surface(modifier = modifier, color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
        Column(Modifier.padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Surface(color = accent.copy(alpha = .10f),
                shape = RoundedCornerShape(9.dp)) {
                Icon(icon, null, tint = accent, modifier = Modifier.padding(6.dp).size(17.dp))
            }
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black,
                color = Palette.text, maxLines = 1,
                overflow = TextOverflow.Ellipsis)
            Text(label, color = Palette.muted, fontSize = 10.sp,
                maxLines = 2, lineHeight = 13.sp)
        }
    }
}

@Composable
fun BvInformationStrip(
    text: String, icon: ImageVector = Icons.Default.AutoAwesome,
    modifier: Modifier = Modifier,
    accent: Color = Palette.blue
) {
    val darkHome = LocalDarkHome.current
    Surface(modifier.fillMaxWidth(),
        color = if (darkHome) DarkHomePalette.panel else accent.copy(alpha = .065f),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, accent.copy(alpha = .14f))) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = accent, modifier = Modifier.size(19.dp))
            Spacer(Modifier.width(10.dp))
            Text(text, color = if (darkHome) DarkHomePalette.ink else Palette.text,
                fontSize = 11.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
fun BvFeatureTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(modifier.fillMaxWidth().clickable(onClick = onClick),
        color = Color.White, shape = RoundedCornerShape(17.dp),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
        Row(Modifier.defaultMinSize(minHeight = 75.dp)
            .padding(horizontal = 14.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(13.dp),
                color = accent.copy(alpha = .1f)) {
                Icon(icon, null, tint = accent, modifier = Modifier.padding(11.dp).size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Palette.text)
                Text(subtitle, fontSize = 10.sp, color = Palette.muted,
                    maxLines = 2, lineHeight = 14.sp)
            }
            Spacer(Modifier.width(5.dp))
            Icon(Icons.Default.ArrowForwardIos, null, tint = Palette.muted,
                modifier = Modifier.size(13.dp))
        }
    }
}

@Composable
fun BvPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    Button(onClick = onClick, enabled = enabled, modifier = modifier.heightIn(min = 50.dp),
        shape = RoundedCornerShape(13.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Palette.green, contentColor = Palette.ink,
            disabledContainerColor = Palette.border, disabledContentColor = Palette.muted
        ), contentPadding = PaddingValues(horizontal = 17.dp)) {
        if (icon != null) {
            Icon(icon, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(label, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
    }
}

@Composable
fun BvOutlineCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier = modifier, color = Color.White,
        shape = RoundedCornerShape(BvSpace.corner),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
        Column(Modifier.padding(BvSpace.card), content = content)
    }
}
