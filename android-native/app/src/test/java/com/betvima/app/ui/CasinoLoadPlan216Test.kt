package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CasinoLoadPlan216Test {
    @Test fun lobbyStartsWithOnlyTwoShelves() {
        val plan=casinoLoadPlan216("", "", "", false)
        assertEquals(listOf("slots", "live"), plan.categories)
        assertEquals(1, plan.pages)
    }
    @Test fun offscreenGroupsOnlyAfterScroll() {
        assertEquals(listOf("slots","live","instant","crash","table"),
            casinoLoadPlan216("", "", "", true).categories)
    }
    @Test fun liveAndQuickInitialPageIsBounded() {
        assertEquals(1, casinoLoadPlan216("live","","",false).pages)
        assertEquals(4, casinoLoadPlan216("live","","",true).pages)
        assertEquals(3, casinoLoadPlan216("instant","","",true).pages)
        assertEquals(listOf("crash","instant"),
            casinoLoadPlan216("crash","","",false).categories)
    }
    @Test fun filtersAndSearchSkipShowcaseCalls() {
        assertTrue(casinoLoadPlan216("", "Some studio", "", true).categories.isEmpty())
        assertTrue(casinoLoadPlan216("", "", "football", true).categories.isEmpty())
        assertTrue(casinoLoadPlan216("table", "", "", false).categories.isEmpty())
    }
}
