package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Navigation design refresh must never change action routing or destination order. */
class BottomNavigation181Test {
    @Test fun fiveDestinationsAndOriginalOrderNeverChange() {
        assertEquals(
            listOf("menu", "home", "casino", "bets", "sports"),
            fixedBottomNavigationIds
        )
        assertEquals(5, fixedBottomNavigationIds.distinct().size)
    }

    @Test fun homeStillSelectedForDefaultEnglishLanding() {
        val state = AppState()
        assertEquals(Lang.EN, state.lang)
        assertEquals("home", selectedBottomNavigationId(state, menuOpen = false))
    }

    @Test fun allFiveActionsRemainSelectable() {
        val home = AppState()
        assertEquals("menu", selectedBottomNavigationId(home, menuOpen = true))
        assertEquals("casino", selectedBottomNavigationId(
            home.copy(feature = Feature.CASINO), menuOpen = false))
        assertEquals("bets", selectedBottomNavigationId(
            home.copy(tab = Tab.BETS), menuOpen = false))
        assertEquals("sports", selectedBottomNavigationId(
            home.copy(tab = Tab.SPORTS), menuOpen = false))
        assertEquals("sports", selectedBottomNavigationId(
            home.copy(tab = Tab.LIVE), menuOpen = false))
        assertEquals("home", selectedBottomNavigationId(
            home.copy(tab = Tab.HOME), menuOpen = false))
    }

    @Test fun drawerPriorityAndNonNavFeatureRemainUnchanged() {
        val casino = AppState(feature = Feature.CASINO)
        assertEquals("menu", selectedBottomNavigationId(casino, true))
        assertEquals("casino", selectedBottomNavigationId(casino, false))
        assertEquals("", selectedBottomNavigationId(
            AppState(feature = Feature.PROFILE), false))
    }

    @Test fun localeSelectionDoesNotChangeRoutes() {
        val base = AppState()
        for (lang in Lang.entries) {
            assertEquals("home", selectedBottomNavigationId(base.copy(lang = lang), false))
            assertEquals("sports", selectedBottomNavigationId(
                base.copy(lang = lang, tab = Tab.SPORTS), false))
        }
    }
}
