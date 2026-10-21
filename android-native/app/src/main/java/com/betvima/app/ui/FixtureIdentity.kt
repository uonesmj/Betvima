package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.Match
import java.util.Locale

/** Identity is never guessed from a similar-sounding club or league. */
internal fun verifiedLogoUrl(candidate: String?): String? {
    val value = candidate?.trim()?.takeIf {
        it.isNotEmpty() && it.length <= 2048 &&
            it.none { char -> char.isWhitespace() || char == '\\' }
    } ?: return null
    return when {
        value.startsWith("https://", ignoreCase = true) -> value
        value.startsWith("/") && !value.startsWith("//") ->
            "https://betvima.com" + value
        else -> null
    }
}

internal fun teamBadgeInitials(team: String): String {
    val words = team.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    if (words.isEmpty()) return "?"
    // Ignore FC/CF/SC suffixes only when other words are present.
    val meaningful = words.filterNot {
        it.uppercase(Locale.ROOT) in setOf("FC", "CF", "SC", "AC", "FK", "AFC")
    }.ifEmpty { words }
    return (if (meaningful.size == 1) meaningful[0].take(2)
            else meaningful.take(2).joinToString("") { it.take(1) })
        .uppercase(Locale.ROOT)
}

private val countryAliases = mapOf(
    "KOREA, REPUBLIC OF" to "KR", "REPUBLIC OF KOREA" to "KR",
    "KOREA REPUBLIC" to "KR", "KOREA, SOUTH" to "KR",
    "NORTH KOREA" to "KP", "KOREA, NORTH" to "KP",
    "TURKIYE" to "TR", "VIETNAM" to "VN", "VIET NAM" to "VN",
    "BOSNIA AND HERZEGOVINA" to "BA", "CZECH REPUBLIC" to "CZ",
    "TAIWAN" to "TW", "HONG KONG" to "HK", "MACAU" to "MO",
    "NORTH MACEDONIA" to "MK", "GEORGIA" to "GE",
    "AZERBAIJAN" to "AZ", "AFGHANISTAN" to "AF",
    "INDONESIA" to "ID", "THAILAND" to "TH",
    "MALAYSIA" to "MY", "SINGAPORE" to "SG",
    "PAKISTAN" to "PK", "SRI LANKA" to "LK",
    "BANGLADESH" to "BD", "QATAR" to "QA",
    "IRAQ" to "IQ", "JORDAN" to "JO", "OMAN" to "OM",
    "TUNISIA" to "TN", "ALGERIA" to "DZ", "NIGERIA" to "NG",
    "GHANA" to "GH", "KENYA" to "KE", "ETHIOPIA" to "ET",
    "CHILE" to "CL", "PERU" to "PE", "URUGUAY" to "UY",
    "PARAGUAY" to "PY", "ECUADOR" to "EC", "COSTA RICA" to "CR",
    "ROMANIA" to "RO", "BULGARIA" to "BG", "HUNGARY" to "HU",
    "SLOVENIA" to "SI", "ESTONIA" to "EE", "LATVIA" to "LV",
    "LITHUANIA" to "LT",
    "USA" to "US", "UNITED STATES" to "US", "UNITED STATES OF AMERICA" to "US",
    "UK" to "GB", "UNITED KINGDOM" to "GB", "GREAT BRITAIN" to "GB",
    "GERMANY" to "DE", "FRANCE" to "FR", "SPAIN" to "ES",
    "ITALY" to "IT", "NETHERLANDS" to "NL", "PORTUGAL" to "PT",
    "JAPAN" to "JP", "CHINA" to "CN", "SOUTH KOREA" to "KR",
    "REPUBLIC OF KOREA" to "KR", "BRAZIL" to "BR", "ARGENTINA" to "AR",
    "TURKEY" to "TR", "TÜRKIYE" to "TR", "IRAN" to "IR",
    "AUSTRALIA" to "AU", "CANADA" to "CA", "SWEDEN" to "SE",
    "NORWAY" to "NO", "DENMARK" to "DK", "FINLAND" to "FI",
    "POLAND" to "PL", "CZECH REPUBLIC" to "CZ", "CZECHIA" to "CZ",
    "AUSTRIA" to "AT", "SWITZERLAND" to "CH", "BELGIUM" to "BE",
    "GREECE" to "GR", "CROATIA" to "HR", "SERBIA" to "RS",
    "RUSSIA" to "RU", "UKRAINE" to "UA", "MEXICO" to "MX",
    "COLOMBIA" to "CO", "SAUDI ARABIA" to "SA", "UAE" to "AE",
    "UNITED ARAB EMIRATES" to "AE", "INDIA" to "IN",
    "SOUTH AFRICA" to "ZA", "NEW ZEALAND" to "NZ",
    "EGYPT" to "EG", "MOROCCO" to "MA", "IRELAND" to "IE",
    "SCOTLAND" to "GB", "WALES" to "GB", "ENGLAND" to "GB",
    // Additional official national identities in the supplied sportsbook
    // reference. Only exact country names map to ISO flags; never infer from
    // a league, club or provider badge.
    "ARMENIA" to "AM", "BAHRAIN" to "BH", "BELARUS" to "BY",
    "BOLIVIA" to "BO", "CAMBODIA" to "KH", "CYPRUS" to "CY",
    "CHINESE TAIPEI" to "TW", "EL SALVADOR" to "SV",
    "GUATEMALA" to "GT", "ICELAND" to "IS", "ISRAEL" to "IL",
    "KAZAKHSTAN" to "KZ", "MALTA" to "MT", "MONTENEGRO" to "ME",
    "MYANMAR" to "MM", "NORTHERN IRELAND" to "GB",
    "PHILIPPINES" to "PH", "PUERTO RICO" to "PR", "RWANDA" to "RW",
    "SLOVAKIA" to "SK", "UGANDA" to "UG", "UZBEKISTAN" to "UZ",
    "VENEZUELA" to "VE"
)

internal fun recognizedCountryCode(value: String): String? {
    val text = value.trim().uppercase(Locale.ROOT)
    if (text.isBlank() || text in setOf("WORLD", "INTERNATIONAL", "EUROPE", "GLOBAL",
            "ASIA", "AFRICA", "AMERICAS", "ESPORTS", "OTHER", "UNKNOWN")) return null
    val code = countryAliases[text] ?: text
    val iso2 = Locale.getISOCountries().toSet()
    if (code.length == 2 && code in iso2) return code
    // Odds feeds sometimes deliver ISO 3166-1 alpha-3.
    if (code.length == 3) return iso2.firstOrNull {
        runCatching { Locale("", it).getISO3Country().equals(code, ignoreCase = true) }
            .getOrDefault(false)
    }
    return null
}

internal fun countryFlag(value: String): String? {
    val code = recognizedCountryCode(value) ?: return null
    val first = Character.toChars(0x1F1E6 + code[0].code - 'A'.code)
    val second = Character.toChars(0x1F1E6 + code[1].code - 'A'.code)
    return String(first) + String(second)
}

internal fun countryDisplayName(value: String): String {
    val trimmed = value.trim()
    val code = recognizedCountryCode(trimmed)
    return if (code != null && trimmed.length <= 3)
        Locale("", code).getDisplayCountry(Locale.ENGLISH).ifBlank { trimmed }
    else trimmed
}

@Composable
fun CountryIdentity(country: String, modifier: Modifier = Modifier, compact: Boolean = true) {
    val flag = remember(country) { countryFlag(country) }
    val label = remember(country) { countryDisplayName(country) }
    Row(modifier, verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Surface(color = Color(0xFFF0F5FB), shape = RoundedCornerShape(6.dp),
            border = BorderStroke(1.dp, Color(0xFFE0E9F3))) {
            Box(Modifier.size(if (compact) 19.dp else 26.dp), contentAlignment = Alignment.Center) {
                if (flag != null) Text(flag, fontSize = if (compact) 13.sp else 18.sp,
                    lineHeight = if (compact) 15.sp else 21.sp)
                else Icon(Icons.Default.Public, contentDescription = null,
                    modifier = Modifier.size(if (compact) 12.dp else 17.dp),
                    tint = Color(0xFF087FF5))
            }
        }
        if (!compact && label.isNotBlank()) {
            Text(label, fontSize = 11.sp, color = Color(0xFF697988),
                fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Do not invent a country when a league covers multiple countries.
 * Only fill an upstream International/blank value for unmistakably local leagues.
 */
internal fun resolvedCompetitionCountry(country: String, league: String): String {
    if (recognizedCountryCode(country) != null) return country
    if (country.trim().lowercase(Locale.ROOT) !in
        setOf("", "world", "international", "global", "unknown", "other")) return country
    val name = league.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), " ").trim()
    return when (name) {
        "a league", "a league men", "a league women" -> "Australia"
        "kbo", "kbo league", "k league 1", "k league 2" -> "South Korea"
        "npb", "nippon professional baseball", "j1 league", "j2 league" -> "Japan"
        "turkey super lig", "turkey super league", "turkish super lig",
        "turkish super league", "super lig turkey" -> "Turkey"
        else -> country
    }
}

/** Explicitly named competition fallback; this is not an official crest. */
internal fun leagueBadgeInitials(league: String): String {
    val words = league.trim().split(Regex("[^\\p{L}\\p{N}]+"))
        .filter { it.isNotBlank() }
    if (words.isEmpty()) return "?"
    val useful = words.filterNot { it.lowercase(Locale.ROOT) in
        setOf("league", "championship", "international", "of", "the", "men", "women") }
        .ifEmpty { words }
    return (if (useful.size == 1) useful.first().take(3)
            else useful.take(2).joinToString("") { it.take(1) })
        .uppercase(Locale.ROOT)
}

/** First-party league artwork already served by the BetVima website.
 * Matches strict competition phrases so one league cannot borrow another's crest.
 * Provider/logo-worker artwork always has priority over these local assets.
 */
internal fun firstPartyLeagueLogo(league: String): String? {
    val name = league.lowercase(Locale.ROOT)
        .replace(Regex("[^a-z0-9]+"), " ").trim()
    fun includes(term: String) = (" $name ").contains(" $term ")
    val asset = when {
        includes("europa league") && !includes("conference") -> "europa-league.svg"
        includes("champions league") -> "champions-league.svg"
        includes("premier league") && !includes("russia") -> "premier-league.svg"
        includes("la liga") || includes("laliga") -> "laliga.svg"
        includes("bundesliga") && !includes("austria") -> "bundesliga.svg"
        includes("serie a") && !includes("brazil") -> "serie-a.svg"
        includes("ligue 1") -> "ligue-1.png"
        includes("eredivisie") -> "eredivisie.svg"
        includes("primeira liga") || includes("liga portugal") -> "liga-portugal.svg"
        includes("major league soccer") || includes("mls") -> "mls.svg"
        includes("nba") && !includes("preseason") && !includes("replays") -> "nba.svg"
        else -> null
    }
    return asset?.let { "https://betvima.com/sports/leagues/$it" }
}

/** Fallback artwork is sport-specific and is never presented as an official crest. */
internal fun sportFallbackAsset(sport: String): String? = when (
    sport.lowercase(Locale.ROOT).replace("-", " ").trim()
) {
    "tennis", "table tennis" -> "https://betvima.com/sports/leagues/tennis.svg"
    "volleyball" -> "https://betvima.com/sports/leagues/volleyball.svg"
    "cricket" -> "https://betvima.com/sports/leagues/cricket.svg"
    "esports", "e sports" -> "https://betvima.com/sports/leagues/esports.svg"
    "mma", "ufc", "boxing", "mixed martial arts" ->
        "https://betvima.com/sports/leagues/mma.svg"
    else -> null
}

/** Exact public-domain/textlogo sources: no fuzzy club/competition matching.
 * These URLs are attempted only after provider art; failed remote requests fall back safely.
 */
internal fun knownPublicLeagueLogo(league: String): String? {
    val name = league.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), " ").trim()
    return when (name) {
        "npb", "nippon professional baseball" ->
            "https://commons.wikimedia.org/wiki/Special:Redirect/file/NPB_logo.svg"
        "kbo", "kbo league" ->
            "https://commons.wikimedia.org/wiki/Special:Redirect/file/Korea_Baseball_Organization_-_2022_wordmark.svg"
        else -> null
    }
}

internal fun leagueLogoCandidates(match: Match): List<String> = listOfNotNull(
    verifiedLogoUrl(match.leagueLogo),
    firstPartyLeagueLogo(match.league),
    knownPublicLeagueLogo(match.league),
    sportFallbackAsset(match.sport)
).distinct()

@Composable
fun LeagueIdentityBadge(match: Match, size: Int = 41) {
    val candidates = remember(match.leagueLogo, match.league, match.sport) {
        leagueLogoCandidates(match)
    }
    var candidateIndex by remember(candidates) { mutableIntStateOf(0) }
    var loaded by remember(candidates) { mutableStateOf(false) }
    val safe = candidates.getOrNull(candidateIndex)
    val tint = when (match.sport.lowercase(Locale.ROOT)) {
        "football" -> Color(0xFF087FF5)
        "basketball" -> Color(0xFFEE8438)
        "tennis", "table-tennis" -> Color(0xFF00A47A)
        "baseball" -> Color(0xFFE91F70)
        else -> Color(0xFF087FF5)
    }
    Surface(
        modifier = Modifier.size(size.dp),
        shape = RoundedCornerShape((size / 3).dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFE0E7EF))
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (!loaded) {
                val sportIcon = when (match.sport.lowercase(Locale.ROOT)) {
                    "football", "soccer" -> Icons.Default.SportsSoccer
                    "basketball" -> Icons.Default.SportsBasketball
                    "tennis", "table-tennis" -> Icons.Default.SportsTennis
                    "baseball" -> Icons.Default.SportsBaseball
                    "volleyball" -> Icons.Default.SportsVolleyball
                    "hockey", "ice-hockey" -> Icons.Default.SportsHockey
                    "esports" -> Icons.Default.SportsEsports
                    "mma", "boxing", "ufc" -> Icons.Default.SportsMma
                    "cricket" -> Icons.Default.SportsCricket
                    "american-football" -> Icons.Default.SportsFootball
                    "rugby" -> Icons.Default.SportsRugby
                    "golf" -> Icons.Default.SportsGolf
                    "motorsport", "formula-1", "formula1" -> Icons.Default.SportsMotorsports
                    "cycling" -> Icons.Default.DirectionsBike
                    "darts" -> Icons.Default.GpsFixed
                    "snooker", "billiards" -> Icons.Default.Sports
                    else -> Icons.Default.EmojiEvents
                }
                val monogram = leagueBadgeInitials(match.league)
                if (monogram == "?") {
                    Icon(sportIcon, contentDescription = null, tint = tint,
                        modifier = Modifier.size((size * .53f).dp))
                } else {
                    Text(monogram, fontWeight = FontWeight.Black, maxLines = 1,
                        fontSize = (size * if (monogram.length > 2) .22f else .32f).sp,
                        color = tint)
                }
            }
            if (safe != null) {
                AsyncImage(model = safe, contentDescription = match.league,
                    contentScale = ContentScale.Fit,
                    onSuccess = { loaded = true },
                    onError = {
                        loaded = false
                        if (candidateIndex < candidates.lastIndex) candidateIndex += 1
                    },
                    modifier = Modifier.fillMaxSize().padding(4.dp)
                        .clip(RoundedCornerShape((size / 4).dp))
                        .graphicsLayer { alpha = if (loaded) 1f else 0f }
                )
            }
        }
    }
}
