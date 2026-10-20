package com.betvima.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyBetsLoadingStateTest {
    @Test
    fun emptyHistoryShowsTicketSkeletonOnlyWhileLoading() {
        assertTrue(needsMyBetsSkeleton(isLoading = true, hasTickets = false))
        assertFalse(needsMyBetsSkeleton(isLoading = false, hasTickets = false))
    }

    @Test
    fun refreshingPreviouslyLoadedBetsKeepsThemVisible() {
        assertFalse(needsMyBetsSkeleton(isLoading = true, hasTickets = true))
        assertFalse(needsMyBetsSkeleton(isLoading = false, hasTickets = true))
    }
}
