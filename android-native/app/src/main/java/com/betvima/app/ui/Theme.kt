package com.betvima.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.unit.dp

/** Local-only Home color override. Switching back to v0.141 restores light Home. */
internal val LocalDarkHome = compositionLocalOf { false }
internal object DarkHomePalette {
    val canvas = Color(0xFF111113)
    val panel = Color(0xFF222224)
    val outline = Color(0xFF39393D)
    val ink = Color(0xFFF5F6F8)
    val muted = Color(0xFFA9ADB8)
    val soft = Color(0xFF2B2D31)
    val blueSoft = Color(0xFF173550)
}
object Palette {
    val ink = Color(0xFF09131C)
    // Shared canvas for the standard header, My Bets, and its bottom navigation.
    val headerDark = Color(0xFF111113)
    val dark = Color(0xFF14242D)
    val darkElevated = Color(0xFF1D3039)
    val subtle = Color(0xFFEDEEF2)
    val gold = Color(0xFFF5B85F)
    val green = Color(0xFF00D47A)
    val greenLight = Color(0xFFE3FFF2)
    val blue = Color(0xFF087FF5)
    val paper = Color(0xFFE8E9EE)
    val border = Color(0xFFE1E4E8)
    val text = Color(0xFF20242A)
    val muted = Color(0xFF697988)
    val red = Color(0xFFF04A63)
}
private val appScheme = lightColorScheme(
    primary = Palette.green, onPrimary = Palette.ink,
    background = Palette.paper, onBackground = Palette.text,
    surface = Color.White, onSurface = Palette.text,
    secondary = Palette.blue, onSecondary = Color.White,
    error = Palette.red, outline = Palette.border
)
@Composable
fun BetvimaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = appScheme,
        shapes = Shapes(
            extraSmall = RoundedCornerShape(7.dp),
            small = RoundedCornerShape(11.dp),
            medium = RoundedCornerShape(16.dp),
            large = RoundedCornerShape(24.dp),
            extraLarge = RoundedCornerShape(28.dp)
        ),
        content = content
    )
}
