package com.betvima.app.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.*
import org.junit.Test

/** Appearance-only regression checks; no server, wallet or bet state is touched. */
class ThemeState204Test {
    @Test fun lightPaletteHasReadableSurfacesAndConsistentNavigation() {
        val prior = NativeThemeState.mode
        val priorSystem = NativeThemeState.systemDark
        try {
            NativeThemeState.systemDark = true
            NativeThemeState.mode = "light"
            assertTrue(NativeThemeState.isLight)
            assertEquals(Color(0xFFF4F6FA), ThemeTokens.canvas)
            assertEquals(Color.White, DarkHomePalette.panel)
            assertEquals(ThemeTokens.canvas, Palette.headerDark)
            assertEquals(ThemeTokens.ink, DarkHomePalette.ink)
            assertNotEquals(ThemeTokens.panel, ThemeTokens.ink)
            NativeThemeState.mode = "dark"
            assertFalse(NativeThemeState.isLight)
            assertEquals(Color(0xFF111113), ThemeTokens.canvas)
            assertEquals(Color(0xFF222224), DarkHomePalette.panel)
            assertEquals(ThemeTokens.canvas, Palette.headerDark)
        } finally {
            NativeThemeState.mode = prior
            NativeThemeState.systemDark = priorSystem
        }
    }

    @Test fun automaticModeFollowsSystemAndManualOverridesIt() {
        val prior = NativeThemeState.mode
        val priorSystem = NativeThemeState.systemDark
        try {
            NativeThemeState.mode = "system"
            NativeThemeState.systemDark = true
            assertFalse(NativeThemeState.isLight)
            NativeThemeState.systemDark = false
            assertTrue(NativeThemeState.isLight)
            NativeThemeState.mode = "dark"
            assertFalse(NativeThemeState.isLight)
            NativeThemeState.mode = "light"
            assertTrue(NativeThemeState.isLight)
        } finally {
            NativeThemeState.mode = prior
            NativeThemeState.systemDark = priorSystem
        }
    }
}
