package com.betvima.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Shared section-header semantics must stay consistent across the home screen.
 * These identifiers select visual treatment only; they do not affect matches,
 * markets, odds, balances, or View all navigation.
 */
class HomeSectionIdentityTest {
    @Test fun homeSectionEmblemsAreDistinct() {
        assertEquals(HomeSectionIdentity.LIVE, homeSectionIdentity("Live"))
        assertEquals(HomeSectionIdentity.TOP_BETS, homeSectionIdentity("Top Bets"))
        assertEquals(HomeSectionIdentity.UPCOMING, homeSectionIdentity("Upcoming"))
    }

    @Test fun unexpectedSectionsKeepGenericFallback() {
        assertEquals(HomeSectionIdentity.OTHER, homeSectionIdentity("Support"))
        assertEquals(HomeSectionIdentity.OTHER, homeSectionIdentity(""))
    }
}
