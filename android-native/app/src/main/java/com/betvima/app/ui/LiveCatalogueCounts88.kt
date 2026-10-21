package com.betvima.app.ui

import com.betvima.app.data.Match

/**
 * One source of truth for the Live counter, sport filters and league rows.
 * Totals always count real, currently loaded provider fixtures, including
 * unpriced ones; collapsing only changes how many are visible.
 */
internal val liveSportKeys88 = listOf(
    "football", "basketball", "tennis", "volleyball", "handball",
    "hockey", "baseball", "american-football", "cricket", "mma",
    "boxing", "table-tennis", "esports", "other"
)

internal fun liveSportTotals88(matches: List<Match>): Map<String, Int> =
    matches.groupingBy { it.sport }.eachCount()

internal fun liveSportMatches88(matches: List<Match>, selectedSport: String): List<Match> =
    if (selectedSport == "top" || selectedSport == "all") matches
    else matches.filter { it.sport == selectedSport }

internal fun catalogueGroupKey88(match: Match, live: Boolean): String =
    if (live) match.sport + "|" + match.league + "|" + match.country
    else upcomingLeagueKey(match)

internal fun visibleFixtureCount88(
    groups: Map<String, List<Match>>,
    collapsed: Collection<String>,
): Int = groups.entries.sumOf { (key, matches) ->
    if (key in collapsed) 0 else matches.size
}
