package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class NavigationScreenStateTest {
    @Test
    fun outgoingCasinoKeepsDarkCasinoContentWhenHomeBecomesActive() {
        val nowHome = AppState(tab = Tab.HOME, feature = Feature.NONE)
        val exiting = stateForAnimatedDestination("feature-CASINO", nowHome)
        assertEquals(Feature.CASINO, exiting.feature)
        assertEquals(Tab.HOME, exiting.tab)
        assertEquals(Feature.NONE, nowHome.feature)
    }

    @Test
    fun outgoingProfileKeepsItsOwnChromeWhenAnotherTabOpens() {
        val nowBets = AppState(tab = Tab.BETS, feature = Feature.NONE)
        assertEquals(
            Feature.PROFILE,
            stateForAnimatedDestination("feature-PROFILE", nowBets).feature
        )
    }

    @Test
    fun activeDestinationDoesNotCreateAReplacementState() {
        val casino = AppState(feature = Feature.CASINO)
        assertSame(casino, stateForAnimatedDestination("feature-CASINO", casino))
    }

    @Test
    fun nonFeatureAndUnknownRoutesDoNotRewriteModelState() {
        val state = AppState(feature = Feature.NONE)
        assertSame(state, stateForAnimatedDestination("home-TOP", state))
        assertSame(state, stateForAnimatedDestination("tab-WALLET", state))
        assertSame(state, stateForAnimatedDestination("feature-UNKNOWN", state))
    }
}
