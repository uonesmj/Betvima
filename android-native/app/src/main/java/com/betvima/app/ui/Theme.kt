package com.betvima.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Device-wide observable appearance. Palette lookups read Compose snapshot state,
 * so existing native screens repaint immediately without navigation or logout.
 */
internal object NativeThemeState {
    var mode by mutableStateOf("dark")
    var systemDark by mutableStateOf(true)
    val isLight: Boolean get() = mode == "light" || (mode == "system" && !systemDark)
}

internal object ThemeTokens {
    val canvas: Color get() = if (NativeThemeState.isLight) Color(0xFFF4F6FA) else Color(0xFF111113)
    val panel: Color get() = if (NativeThemeState.isLight) Color.White else Color(0xFF222224)
    val elevated: Color get() = if (NativeThemeState.isLight) Color(0xFFEDF1F6) else Color(0xFF2B2D31)
    val outline: Color get() = if (NativeThemeState.isLight) Color(0xFFDCE2EA) else Color(0xFF39393D)
    val ink: Color get() = if (NativeThemeState.isLight) Color(0xFF182534) else Color(0xFFF5F6F8)
    val muted: Color get() = if (NativeThemeState.isLight) Color(0xFF596A7D) else Color(0xFFA9ADB8)
    val accent: Color get() = if (NativeThemeState.isLight) Color(0xFF008D56) else Color(0xFF00D47A)
    val blueSoft: Color get() = if (NativeThemeState.isLight) Color(0xFFE1EFFE) else Color(0xFF173550)
}

/** Preserves Home's separate card treatment while following the app-wide choice. */
internal val LocalDarkHome = compositionLocalOf { true }
internal object DarkHomePalette {
    val canvas: Color get() = ThemeTokens.canvas
    val panel: Color get() = ThemeTokens.panel
    val outline: Color get() = ThemeTokens.outline
    val ink: Color get() = ThemeTokens.ink
    val muted: Color get() = ThemeTokens.muted
    val soft: Color get() = ThemeTokens.elevated
    val blueSoft: Color get() = ThemeTokens.blueSoft
}

object Palette {
    val ink = Color(0xFF09131C)
    val headerDark: Color get() = ThemeTokens.canvas
    val dark = Color(0xFF14242D)
    val darkElevated: Color get() = if (NativeThemeState.isLight) Color(0xFFE7EDF5) else Color(0xFF1D3039)
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

private val lightScheme = lightColorScheme(
    primary = Color(0xFF008D56), onPrimary = Color.White,
    background = Color(0xFFF4F6FA), onBackground = Color(0xFF182534),
    surface = Color.White, onSurface = Color(0xFF182534),
    surfaceVariant = Color(0xFFEDF1F6), onSurfaceVariant = Color(0xFF596A7D),
    secondary = Palette.blue, onSecondary = Color.White,
    error = Palette.red, outline = Color(0xFFDCE2EA)
)
private val darkScheme = darkColorScheme(
    primary = Palette.green, onPrimary = Palette.ink,
    background = Color(0xFF111113), onBackground = Color(0xFFF5F6F8),
    surface = Color(0xFF222224), onSurface = Color(0xFFF5F6F8),
    surfaceVariant = Color(0xFF2B2D31), onSurfaceVariant = Color(0xFFA9ADB8),
    secondary = Palette.blue, onSecondary = Color.White,
    error = Palette.red, outline = Color(0xFF39393D)
)

@Composable
fun BetvimaTheme(content: @Composable () -> Unit) {
    val systemDark = isSystemInDarkTheme()
    SideEffect { NativeThemeState.systemDark = systemDark }
    val light = NativeThemeState.isLight
    MaterialTheme(
        colorScheme = if (light) lightScheme else darkScheme,
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
