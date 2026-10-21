package com.betvima.app.ui

import com.betvima.app.data.Match
import java.time.Instant
import java.util.Locale

/**
 * Strict fixture-only taxonomy. Never infer country, competition, or sport
 * from a participant, loosely matching string, or borrowed logo URL.
 */
internal data class UpcomingNode(
    val key: String, val label: String, val count: Int, val sport: String,
    val country: String = "", val sample: Match? = null
)

internal val upcomingSports = listOf(
    "football" to "Football", "tennis" to "Tennis",
    "basketball" to "Basketball", "hockey" to "Ice Hockey",
    "table-tennis" to "Table Tennis", "volleyball" to "Volleyball",
    "baseball" to "Baseball", "esports" to "Esports",
    "esports:cs2" to "CS2", "esports:dota2" to "Dota 2",
    "esports:lol" to "League of Legends", "esports:valorant" to "Valorant",
    "handball" to "Handball", "cricket" to "Cricket",
    "mma" to "MMA", "boxing" to "Boxing",
    "american-football" to "American Football",
    "darts" to "Darts", "snooker" to "Snooker",
    "futsal" to "Futsal", "badminton" to "Badminton",
    "rugby-union" to "Rugby", "other" to "Other sports"
)

internal fun upcomingSportIdentity(sport: String): String = when (
    sport.lowercase(Locale.ROOT).trim()
) {
    "ice-hockey" -> "hockey"
    "soccer" -> "football"
    "table tennis", "table_tennis" -> "table-tennis"
    "e-sports" -> "esports"
    else -> sport.lowercase(Locale.ROOT).trim()
}

internal fun tournamentCountryKey(raw: String): String {
    val value = raw.trim()
    // These are distinct competition federations. An ISO "GB" fallback
    // must NEVER collapse England, Scotland, Wales and Northern Ireland.
    when (value.lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")) {
        "england" -> return "home-nation:england"
        "scotland" -> return "home-nation:scotland"
        "wales" -> return "home-nation:wales"
        "northern ireland" -> return "home-nation:northern-ireland"
    }
    recognizedCountryCode(value)?.let { return it }
    val simple = value.lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")
    return when (simple) {
        "", "unknown", "n/a", "none", "other", "global", "international" -> "international"
        "world", "worldwide" -> "world"
        "europe" -> "europe"
        "asia" -> "asia"
        "africa" -> "africa"
        "south america" -> "south-america"
        "north america", "north and central america" -> "north-america"
        "oceania" -> "oceania"
        else -> "unverified:" + simple
    }
}

internal fun tournamentCountryName(key: String, source: String): String = when (key) {
    "international" -> "International"
    "home-nation:england" -> "England"
    "home-nation:scotland" -> "Scotland"
    "home-nation:wales" -> "Wales"
    "home-nation:northern-ireland" -> "Northern Ireland"
    "world" -> "World"
    "europe" -> "Europe"
    "asia" -> "Asia"
    "africa" -> "Africa"
    "south-america" -> "South America"
    "north-america" -> "North and Central America"
    "oceania" -> "Oceania"
    else -> if (key.startsWith("unverified:")) source.ifBlank { "International" }
        else if (source.length > 3 && recognizedCountryCode(source) == key) source
        else countryDisplayName(key)
}

private fun cleanTournamentPart(input: String): String =
    input.trim().lowercase(Locale.ROOT).replace(Regex("\\s+"), " ").take(180)

/**
 * The provider league ID has priority. All keys include sport+country so
 * two different competitions cannot accidentally merge across those levels.
 * With missing provider IDs, exact names are an explicit limited fallback.
 */
internal fun esportsGameIdentity(game: String): String = when (
    game.trim().lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "")
) {
    "cs2", "counterstrike2" -> "cs2"
    "dota2", "defenseoftheancients2" -> "dota2"
    "lol", "leagueoflegends" -> "lol"
    "valorant" -> "valorant"
    else -> ""
}

internal fun upcomingLeagueKey(match: Match): String {
    val baseSport = upcomingSportIdentity(match.sport)
    val game = if (baseSport == "esports") esportsGameIdentity(match.esportsGame) else ""
    val sport = if (game.isNotBlank()) "esports:" + game else baseSport
    val country = tournamentCountryKey(match.country)
    val competition = match.leagueId.trim().takeIf { it.isNotBlank() }
        ?.let { "id:" + cleanTournamentPart(it) }
        ?: "name:" + cleanTournamentPart(match.league)
    return sport + "|" + country + "|" + competition
}

internal fun upcomingForSport(all: List<Match>, sport: String): List<Match> =
    if (sport == "all" || sport == "top") all
    else if (sport.startsWith("esports:")) {
        val game = sport.substringAfter(":")
        all.filter { upcomingSportIdentity(it.sport) == "esports" &&
            esportsGameIdentity(it.esportsGame) == game }
    } else all.filter { upcomingSportIdentity(it.sport) == upcomingSportIdentity(sport) }

internal fun upcomingWithinHours(all: List<Match>, hours: Int?, now: Instant): List<Match> {
    if (hours == null) return all
    require(hours in setOf(1, 2, 4, 6, 12, 24, 48, 72, 168))
    val until = now.plusSeconds(hours * 3600L)
    return all.filter {
        val kickoff = runCatching { Instant.parse(it.starts) }.getOrNull()
        kickoff != null && !kickoff.isBefore(now) && !kickoff.isAfter(until)
    }
}

internal fun tournamentSportNodes(all: List<Match>): List<UpcomingNode> {
    val counts = all.groupingBy { upcomingSportIdentity(it.sport) }.eachCount()
    val gameCounts = all.filter { upcomingSportIdentity(it.sport) == "esports" }
        .mapNotNull { esportsGameIdentity(it.esportsGame).takeIf(String::isNotBlank) }
        .groupingBy { "esports:" + it }.eachCount()
    val known = upcomingSports.map { (key, title) ->
        UpcomingNode("sport:" + key, title,
            if (key.startsWith("esports:")) gameCounts[key] ?: 0 else counts[key] ?: 0, key)
    }
    val extra = counts.filterKeys { key -> upcomingSports.none { it.first == key } }
        .toSortedMap().map { (key, count) ->
            UpcomingNode("sport:" + key,
                key.replace('-', ' ').replaceFirstChar { it.titlecase(Locale.ROOT) },
                count, key)
        }
    return known + extra
}

internal fun tournamentCountryNodes(all: List<Match>, sport: String): List<UpcomingNode> =
    upcomingForSport(all, sport).groupBy { tournamentCountryKey(it.country) }
        .map { (code, items) ->
            UpcomingNode("country:" + sport + ":" + code,
                tournamentCountryName(code, items.first().country),
                items.size, sport, code, items.first())
        }.sortedWith(
            compareByDescending<UpcomingNode> { it.count }.thenBy { it.label }
        )

internal fun tournamentDirectLeagues(all: List<Match>, sport: String): List<UpcomingNode> =
    upcomingForSport(all, sport)
        .groupBy(::upcomingLeagueKey)
        .map { (key, matches) ->
            val first = matches.first()
            UpcomingNode(key, first.league.ifBlank { "Unnamed competition" },
                matches.size, sport, tournamentCountryKey(first.country), first)
        }.sortedWith(compareByDescending<UpcomingNode> { it.count }.thenBy { it.label })

internal fun tournamentTopLeagues(all: List<Match>): List<UpcomingNode> =
    all.groupBy(::upcomingLeagueKey)
        .map { (key, matches) ->
            val first = matches.first()
            UpcomingNode(key, first.league.ifBlank { "Unnamed competition" },
                matches.size, upcomingSportIdentity(first.sport),
                tournamentCountryKey(first.country), first)
        }.sortedWith(compareByDescending<UpcomingNode> { it.count }.thenBy { it.label })

internal fun tournamentDirectSport(sport: String): Boolean =
    sport == "tennis" || sport == "esports" || sport.startsWith("esports:")

internal fun tournamentLeagueNodes(
    all: List<Match>, sport: String, country: String
): List<UpcomingNode> =
    upcomingForSport(all, sport)
        .filter { tournamentCountryKey(it.country) == country }
        .groupBy(::upcomingLeagueKey).map { (key, matches) ->
            val first = matches.first()
            UpcomingNode(key, first.league.ifBlank { "Unnamed competition" },
                matches.size, sport,
                tournamentCountryKey(first.country), first)
        }.sortedWith(compareByDescending<UpcomingNode> { it.count }.thenBy { it.label })

internal fun upcomingMatchesForLeague(
    all: List<Match>, leagueKey: String
): List<Match> = all.filter { upcomingLeagueKey(it) == leagueKey }
