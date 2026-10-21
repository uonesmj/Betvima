package com.betvima.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FooterFloatingSlipTest {
    @Test fun slipStaysVisibleWhenFooterIsNotComposed() {
        assertFalse(footerCoversFloatingSlip(null, 1000, 78))
    }

    @Test fun slipStaysVisibleBeforeFooterEntersFloatingArea() {
        assertFalse(footerCoversFloatingSlip(960, 1000, 78))
    }

    @Test fun slipDisappearsWhenFooterReachesFloatingArea() {
        assertTrue(footerCoversFloatingSlip(922, 1000, 78))
        assertTrue(footerCoversFloatingSlip(400, 1000, 78))
    }

    @Test fun slipReturnsWhenFooterScrollsBelowFloatingArea() {
        assertFalse(footerCoversFloatingSlip(940, 1000, 78))
        assertFalse(footerCoversFloatingSlip(null, 1000, 78))
    }
}
