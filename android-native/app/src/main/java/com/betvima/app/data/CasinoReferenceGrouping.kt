package com.betvima.app.data

/**
 * Display-only groupings for the actual vendor catalogue.
 * Never synthesize titles, player counts, profitability, "new" flags or popularity.
 */
enum class CasinoReferenceGroup {
    BACCARAT, GAME_SHOWS, POKER, ROULETTE, BLACKJACK,
    MINES, PLINKO, CRASH, OTHER_INSTANT
}

fun belongsToCasinoReferenceGroup(game: CasinoGame, group: CasinoReferenceGroup): Boolean {
    val name = game.name.lowercase()
    return when (group) {
        CasinoReferenceGroup.BACCARAT ->
            game.category == "live" && name.contains("baccarat")
        CasinoReferenceGroup.GAME_SHOWS ->
            game.category == "live" && listOf(
                "crazy time", "funky time", "dream catcher", "money wheel",
                "mega wheel", "monopoly live", "sweet bonanza candyland",
                "game show", "cash or crash", "deal or no deal", "lightning storm",
                "lightning dice", "football studio"
            ).any(name::contains)
        CasinoReferenceGroup.POKER ->
            game.category == "live" && listOf(
                "poker", "hold'em", "holdem", "texas hold"
            ).any(name::contains)
        CasinoReferenceGroup.ROULETTE ->
            game.category == "live" && name.contains("roulette")
        CasinoReferenceGroup.BLACKJACK ->
            game.category == "live" && name.contains("blackjack")
        CasinoReferenceGroup.MINES ->
            game.category in setOf("crash", "instant", "other") &&
                listOf("mines", "minefield").any(name::contains)
        CasinoReferenceGroup.PLINKO ->
            game.category in setOf("crash", "instant", "other") &&
                name.contains("plinko")
        CasinoReferenceGroup.CRASH ->
            game.category == "crash" &&
                !belongsToCasinoReferenceGroup(game, CasinoReferenceGroup.MINES) &&
                !belongsToCasinoReferenceGroup(game, CasinoReferenceGroup.PLINKO)
        CasinoReferenceGroup.OTHER_INSTANT ->
            game.category == "instant" &&
                !belongsToCasinoReferenceGroup(game, CasinoReferenceGroup.MINES) &&
                !belongsToCasinoReferenceGroup(game, CasinoReferenceGroup.PLINKO)
    }
}
