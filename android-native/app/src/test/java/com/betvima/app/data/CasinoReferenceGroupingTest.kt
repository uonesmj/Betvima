package com.betvima.app.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CasinoReferenceGroupingTest {
    private fun game(name: String, category: String) = CasinoGame(
        id = "id-$name", name = name, category = category,
        provider = "evolution", providerName = "Evolution",
        imageUrl = null, demoSupported = false
    )

    @Test fun liveBaccaratDoesNotLeakIntoPoker() {
        val baccarat = game("Speed Baccarat A", "live")
        assertTrue(belongsToCasinoReferenceGroup(baccarat, CasinoReferenceGroup.BACCARAT))
        assertFalse(belongsToCasinoReferenceGroup(baccarat, CasinoReferenceGroup.POKER))
        assertFalse(belongsToCasinoReferenceGroup(game("Speed Baccarat", "slots"), CasinoReferenceGroup.BACCARAT))
    }

    @Test fun liveGroupClassification() {
        assertTrue(belongsToCasinoReferenceGroup(game("XXXTREME Lightning Roulette", "live"),
            CasinoReferenceGroup.ROULETTE))
        assertTrue(belongsToCasinoReferenceGroup(game("Crazy Time", "live"),
            CasinoReferenceGroup.GAME_SHOWS))
        assertTrue(belongsToCasinoReferenceGroup(game("Texas Hold'em Bonus Poker", "live"),
            CasinoReferenceGroup.POKER))
        assertTrue(belongsToCasinoReferenceGroup(game("Blackjack 17", "live"),
            CasinoReferenceGroup.BLACKJACK))
    }

    @Test fun quickGamesHaveDisjointMinesPlinkoCrashCategories() {
        val mines = game("Zeus Mines", "crash")
        val plinko = game("Plinko 2", "instant")
        val crash = game("Aviator", "crash")
        assertTrue(belongsToCasinoReferenceGroup(mines, CasinoReferenceGroup.MINES))
        assertFalse(belongsToCasinoReferenceGroup(mines, CasinoReferenceGroup.CRASH))
        assertTrue(belongsToCasinoReferenceGroup(plinko, CasinoReferenceGroup.PLINKO))
        assertTrue(belongsToCasinoReferenceGroup(crash, CasinoReferenceGroup.CRASH))
    }
}
