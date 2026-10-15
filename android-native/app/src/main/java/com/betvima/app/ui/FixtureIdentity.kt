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
internal fun verifiedLogoUrl(candidate: String?): String? =
    candidate?.trim()?.takeIf {
        it.startsWith("https://", ignoreCase = true) &&
            !it.contains(' ') && it.length <= 2048
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
    "SCOTLAND" to "GB", "WALES" to "GB", "ENGLAND" to "GB"
)

internal fun recognizedCountryCode(value: String): String? {
    val text = value.trim().uppercase(Locale.ROOT)
    if (text.isBlank() || text in setOf("WORLD", "INTERNATIONAL", "EUROPE", "GLOBAL",
            "ASIA", "AFRICA", "AMERICAS", "ESPORTS", "OTHER", "UNKNOWN")) return null
    val code = countryAliases[text] ?: text
    return code.takeIf { it.length == 2 && it in Locale.getISOCountries().toSet() }
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

@Composable
fun LeagueIdentityBadge(match: Match, size: Int = 41) {
    val safe = verifiedLogoUrl(match.leagueLogo) ?: firstPartyLeagueLogo(match.league)
    var loaded by remember(safe) { mutableStateOf(false) }
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
                    "football" -> Icons.Default.SportsSoccer
                    "basketball" -> Icons.Default.SportsBasketball
                    "tennis", "table-tennis" -> Icons.Default.SportsTennis
                    "baseball" -> Icons.Default.SportsBaseball
                    "volleyball" -> Icons.Default.SportsVolleyball
                    "hockey" -> Icons.Default.SportsHockey
                    "esports" -> Icons.Default.SportsEsports
                    else -> Icons.Default.EmojiEvents
                }
                Icon(sportIcon, contentDescription = null, tint = tint,
                    modifier = Modifier.size((size * .53f).dp))
            }
            if (safe != null) {
                AsyncImage(model = safe, contentDescription = match.league,
                    contentScale = ContentScale.Fit,
                    onSuccess = { loaded = true },
                    onError = { loaded = false },
                    modifier = Modifier.fillMaxSize().padding(4.dp)
                        .clip(RoundedCornerShape((size / 4).dp))
                        .graphicsLayer { alpha = if (loaded) 1f else 0f }
                )
            }
        }
    }
}
