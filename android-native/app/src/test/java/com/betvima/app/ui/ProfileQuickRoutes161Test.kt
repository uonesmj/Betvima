package com.betvima.app.ui

import org.junit.Assert.*
import org.junit.Test

class ProfileQuickRoutes161Test {
    @Test fun fixedProfileGridContainsExactlySixDistinctDestinations() {
        val routes=profileQuickDestinations()
        assertEquals(6,routes.size)
        assertEquals(6,routes.distinct().size)
        assertEquals(
            setOf(ProfileQuickDestination.BONUSES,ProfileQuickDestination.VIP,
                ProfileQuickDestination.BET_HISTORY,ProfileQuickDestination.TRANSACTIONS,
                ProfileQuickDestination.SETTINGS,ProfileQuickDestination.SUPPORT),
            routes.toSet()
        )
    }

    @Test fun removedPartnershipActionDoesNotReturnInProfile() {
        assertFalse(profileQuickDestinations().any {
            it.name.contains("PARTNER") || it.name.contains("AFFILIATE")
        })
    }
}
