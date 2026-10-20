package com.betvima.app.ui

import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.LiveStat
import org.junit.Assert.*
import org.junit.Test

class PremiumFloatingViews130Test {
    private fun facts(home: Int?, away: Int?, key: String = "dangerous_attacks") =
        LiveMatchFacts(
            fi = "123", minute = 53, clockSeconds = 3180, clockRunning = true,
            score = "1-0", observedAt = "2026-10-20T12:00:00Z",
            stats = listOf(LiveStat(key, key, key, home, away))
        )

    @Test fun percentageUsesOnlyRealProviderCounters() {
        assertEquals(.75f, pressureRatio130(facts(30, 10))!!, .00001f)
        assertEquals(0f, pressureRatio130(facts(0, 3))!!, .00001f)
        assertEquals(1f, pressureRatio130(facts(3, 0))!!, .00001f)
    }

    @Test fun unknownAndZeroDenominatorDoNotFabricatePressure() {
        assertNull(pressureRatio130(null))
        assertNull(pressureRatio130(facts(null, 5)))
        assertNull(pressureRatio130(facts(5, null)))
        assertNull(pressureRatio130(facts(0, 0)))
        assertNull(pressureRatio130(facts(-1, 5)))
        assertNull(pressureRatio130(facts(52, 48, "possession")))
    }

    @Test fun ratioSafeForLargerCounterTotals() {
        assertEquals(.5f, pressureRatio130(facts(100000, 100000))!!, .00001f)
    }
}
