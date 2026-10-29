package com.betvima.app.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ChromeTokens205Test {
    @Test fun shellPaletteDoesNotChangeWithPageTheme() {
        val oldMode = NativeThemeState.mode
        val oldSystem = NativeThemeState.systemDark
        try {
            for (mode in listOf("light", "dark", "system")) {
                for (systemDark in listOf(false, true)) {
                    NativeThemeState.mode = mode
                    NativeThemeState.systemDark = systemDark
                    assertEquals(Color(0xFF101114), ChromeTokens.black)
                    assertEquals(Color(0xFFF5F7FA), ChromeTokens.ink)
                    assertEquals(Color(0xFFACB5C2), ChromeTokens.muted)
                    assertEquals(Color(0xFF3EA2FF), ChromeTokens.active)
                }
            }
        } finally {
            NativeThemeState.mode = oldMode
            NativeThemeState.systemDark = oldSystem
        }
    }
    @Test fun pageBodyRemainsAppearanceSensitive() {
        val oldMode = NativeThemeState.mode
        try {
            NativeThemeState.mode = "light"
            val lightCanvas = ThemeTokens.canvas
            val lightInk = ThemeTokens.ink
            NativeThemeState.mode = "dark"
            assertNotEquals(lightCanvas, ThemeTokens.canvas)
            assertNotEquals(lightInk, ThemeTokens.ink)
        } finally { NativeThemeState.mode = oldMode }
    }
}
