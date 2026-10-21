package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class WindStormMotion157Test {
    @Test fun stillCarouselHasNoWindUntilItsNativeScrollChanges() {
        assertEquals(0f, windStormDirection(1, 40, 1, 40))
        assertEquals(-1f, windStormDirection(1, 40, 1, 52))
        assertEquals(1f, windStormDirection(1, 52, 1, 40))
    }

    @Test fun itemBoundariesDoNotReverseWindDirection() {
        assertEquals(-1f, windStormDirection(0, 210, 1, 4))
        assertEquals(1f, windStormDirection(2, 5, 1, 198))
    }

    @Test fun artIntensityIsAlwaysFiniteAndBounded() {
        assertEquals(0f, windStormIntensity(-.5f))
        assertEquals(.5f, windStormIntensity(.5f))
        assertEquals(1f, windStormIntensity(2f))
        assertEquals(0f, windStormIntensity(Float.NaN))
        assertEquals(0f, windStormIntensity(Float.POSITIVE_INFINITY))
    }
}
