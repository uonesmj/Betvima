package com.betvima.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

object Palette {
    val ink = Color(0xFF09131C)
    val dark = Color(0xFF122632)
    val green = Color(0xFF00D47A)
    val greenLight = Color(0xFFE3FFF2)
    val blue = Color(0xFF087FF5)
    val paper = Color(0xFFF5F7F9)
    val border = Color(0xFFE1E4E8)
    val text = Color(0xFF20242A)
    val muted = Color(0xFF697784)
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
            small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(16.dp),
            large = RoundedCornerShape(24.dp)
        ),
        content = content
    )
}
