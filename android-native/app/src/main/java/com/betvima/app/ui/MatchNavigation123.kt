package com.betvima.app.ui

import com.betvima.app.data.Match

/**
 * Keep navigation anchored to the fixture that was actually selected while
 * the independent odds/details request is pending. It never invents a fixture.
 */
internal fun selectedMatch123(
    matchId: String,
    current: Match?,
    live: List<Match>,
    upcoming: List<Match>,
    searchedLive: List<Match>,
    searchedUpcoming: List<Match>
): Match? =
    current?.takeIf { it.id == matchId }
        ?: live.firstOrNull { it.id == matchId }
        ?: upcoming.firstOrNull { it.id == matchId }
        ?: searchedLive.firstOrNull { it.id == matchId }
        ?: searchedUpcoming.firstOrNull { it.id == matchId }
