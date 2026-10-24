package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Regression: motion and sizing updates may not alter original navigation. */
class BottomNavigation182Test {
    @Test fun originalFiveDestinationsNeverReorder() {
        assertEquals(
            listOf("menu", "home", "casino", "bets", "sports"),
            fixedBottomNavigationIds
        )
    }

    @Test fun selectionStillTracksTheCurrentPageAndDrawer() {
        val state = AppState()
        assertEquals("home", selectedBottomNavigationId(state, false))
        assertEquals("menu", selectedBottomNavigationId(state, true))
        assertEquals("casino", selectedBottomNavigationId(
            state.copy(feature = Feature.CASINO), false))
        assertEquals("bets", selectedBottomNavigationId(
            state.copy(tab = Tab.BETS), false))
        assertEquals("sports", selectedBottomNavigationId(
            state.copy(tab = Tab.SPORTS), false))
        assertEquals("sports", selectedBottomNavigationId(
            state.copy(tab = Tab.LIVE), false))
        assertEquals("", selectedBottomNavigationId(
            state.copy(feature = Feature.PROFILE), false))
    }

    @Test fun translatedCaptionsNeverChangeTheDestinationIdentity() {
        val state = AppState()
        for (language in Lang.entries) {
            assertEquals("home", selectedBottomNavigationId(state.copy(lang = language), false))
            assertEquals("menu", selectedBottomNavigationId(state.copy(lang = language), true))
            assertEquals("sports", selectedBottomNavigationId(
                state.copy(lang = language, tab = Tab.SPORTS), false))
        }
    }
}
