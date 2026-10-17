package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportChatLayoutTest {
    @Test fun shortMessagesMustNotUseAFullWidthBubble() {
        val screenWidthDp = 360
        val maxDp = supportChatBubbleCapDp(screenWidthDp)
        assertTrue(maxDp < screenWidthDp * .8f)
        assertEquals(273.6f, maxDp, 0.01f)
    }

    @Test fun bubbleCapScalesWithDeviceWidth() {
        assertEquals(296.4f, supportChatBubbleCapDp(390), 0.01f)
        assertEquals(456f, supportChatBubbleCapDp(600), 0.01f)
    }

    @Test fun composerReservesRealSpaceForGestureBarButNotFullSpaceForKeyboard() {
        assertEquals(32, supportChatBottomClearanceDp(false))
        assertEquals(8, supportChatBottomClearanceDp(true))
    }
}
