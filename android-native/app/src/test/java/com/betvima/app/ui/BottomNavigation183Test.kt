package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Regression: the highlight is visual-only; tabs, ordering and state must not change. */
class BottomNavigation183Test {
    @Test fun originalFiveTabsKeepTheirOrder() {
        assertEquals(
            listOf("menu", "home", "casino", "bets", "sports"),
            fixedBottomNavigationIds
        )
    }

    @Test fun highlightStillFollowsCurrentScreen() {
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
    }

    @Test fun tabMappingIsLanguageIndependent() {
        val base = AppState()
        for (language in Lang.entries) {
            assertEquals("home", selectedBottomNavigationId(base.copy(lang = language), false))
            assertEquals("menu", selectedBottomNavigationId(base.copy(lang = language), true))
            assertEquals("sports", selectedBottomNavigationId(
                base.copy(lang = language, tab = Tab.SPORTS), false))
        }
    }
}
