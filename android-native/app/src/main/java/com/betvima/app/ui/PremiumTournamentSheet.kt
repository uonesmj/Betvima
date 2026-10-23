package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match
import java.time.Instant
import kotlinx.coroutines.launch

private val pickerWhite = Color(0xFFFFFFFF)
private val pickerInk = Color(0xFF20232B)
private val pickerGray = Color(0xFFEEF0F4)
private val pickerMuted = Color(0xFF687080)
private val pickerBlue = Color(0xFF087FFA)

private fun tournamentSportEmoji(key: String): String = when (key) {
    "football" -> "⚽"
    "tennis" -> "🎾"
    "basketball" -> "🏀"
    "hockey" -> "🏒"
    "table-tennis" -> "🏓"
    "volleyball" -> "🏐"
    "baseball" -> "⚾"
    "esports" -> "🎮"
    "esports:cs2" -> "🎯"
    "esports:dota2" -> "⚔️"
    "esports:lol" -> "🏰"
    "esports:valorant" -> "🎮"
    "boxing" -> "🥊"
    "mma" -> "🥋"
    "handball" -> "🤾"
    "cricket" -> "🏏"
    "american-football" -> "🏈"
    "darts" -> "🎯"
    "badminton" -> "🏸"
    else -> "🏆"
}

private fun homeNationFlag(tag: String): String {
    // Unicode regional subdivision flags: gbeng, gbsct, gbwls.
    return "🏴" + tag.map { String(Character.toChars(0xE0000 + it.code)) }
        .joinToString("") + String(Character.toChars(0xE007F))
}

private fun tournamentPlaceEmoji(code: String): String = when (code) {
    "home-nation:england" -> homeNationFlag("gbeng")
    "home-nation:scotland" -> homeNationFlag("gbsct")
    "home-nation:wales" -> homeNationFlag("gbwls")
    "home-nation:northern-ireland" -> "🌐"
    else -> countryFlag(code) ?: when (code) {
        "world", "international" -> "🌐"
        "europe" -> "🌍"
        "asia" -> "🌏"
        "africa" -> "🌍"
        "south-america", "north-america" -> "🌎"
        else -> "🌐"
    }
}

/**
 * Root sport -> authoritative country/region -> authoritative league.
 * The screenshot reference informs the presentation, but all counts, sports,
 * fixtures, flags and badges come from the actual catalogue.
 *
 * The view NEVER assigns a fixture to a country by inspecting the team name.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumTournamentSheet(
    lang: Lang,
    matches: List<Match>,
    activeSport: String,
    hours: Int?,
    onHoursChange: (Int?) -> Unit,
    onSportChange: (String) -> Unit,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var screen by rememberSaveable { mutableStateOf("sports") }
    var selectedSport by rememberSaveable { mutableStateOf("") }
    var selectedCountry by rememberSaveable { mutableStateOf("") }
    val currentSport = selectedSport.ifBlank { activeSport }
    var filter by rememberSaveable { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val dismiss: () -> Unit = {
        scope.launch { sheetState.hide(); onDismiss() }
    }
    val listState = rememberLazyListState()
    val filtered = remember(matches, hours) {
        upcomingWithinHours(matches, hours, Instant.now())
    }
    val sportNodes = remember(filtered) { tournamentSportNodes(filtered) }
    val countryNodes = remember(filtered, currentSport) {
        tournamentCountryNodes(filtered, currentSport)
    }
    val leagueNodes = remember(filtered, currentSport, selectedCountry) {
        if (tournamentDirectSport(currentSport))
            tournamentDirectLeagues(filtered, currentSport)
        else tournamentLeagueNodes(filtered, currentSport, selectedCountry)
    }
    val searchingSports = screen == "sports" && filter.isNotBlank()
    val allNodes = when (screen) {
        "countries" -> countryNodes
        "leagues" -> leagueNodes
        else -> if (searchingSports) tournamentSearchNodes(filtered, filter) else sportNodes
    }
    val visible = if (searchingSports) allNodes else allNodes.filter {
        filter.isBlank() || it.label.contains(filter.trim(), ignoreCase = true)
    }
    val header = when (screen) {
        "countries" -> upcomingSports.firstOrNull { it.first == currentSport }?.second
            ?: currentSport.replace('-', ' ')
        "leagues" -> if (tournamentDirectSport(currentSport))
            upcomingSports.firstOrNull { it.first == currentSport }?.second ?: currentSport
            else tournamentCountryName(selectedCountry,
                countryNodes.firstOrNull { it.country == selectedCountry }?.label.orEmpty())
        else -> "Sports"
    }
    val subtitle = when (screen) {
        "countries" -> tr(lang, "Select a country or region", "انتخاب کشور یا منطقه")
        "leagues" -> tr(lang, "Select an available league", "انتخاب لیگ موجود")
        else -> tr(lang, "Select a sport", "انتخاب رشته ورزشی")
    }
    val back: () -> Unit = {
        filter = ""
        when (screen) {
            "leagues" -> screen = if (tournamentDirectSport(currentSport))
                "sports" else "countries"
            "countries" -> screen = "sports"
            else -> dismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = dismiss,
        sheetState = sheetState,
        containerColor = pickerWhite,
        contentColor = pickerInk,
        scrimColor = Color.Black.copy(alpha = .75f),
        shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
        dragHandle = null
    ) {
        Column(
            Modifier.fillMaxWidth()
                .fillMaxHeight(.92f)
                .navigationBarsPadding()
                .imePadding()
                .background(pickerWhite)
        ) {
            Row(
                Modifier.fillMaxWidth().height(68.dp)
                    .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = back, modifier = Modifier.size(38.dp)) {
                    Icon(Icons.Default.ChevronLeft,
                        tr(lang, "Back", "بازگشت"), tint = Color(0xFF8A8F99),
                        modifier = Modifier.size(27.dp))
                }
                Spacer(Modifier.width(6.dp))
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically) {
                    if (screen != "sports") {
                        Text(if (screen == "countries")
                            tournamentSportEmoji(currentSport)
                        else tournamentPlaceEmoji(selectedCountry),
                            fontSize = 23.sp)
                        Spacer(Modifier.width(7.dp))
                    }
                    Text(header, color = pickerInk, fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconButton(onClick = dismiss, modifier = Modifier.size(38.dp)) {
                    Icon(Icons.Default.Close, tr(lang, "Close", "بستن"),
                        tint = Color(0xFF8A8F99), modifier = Modifier.size(25.dp))
                }
            }

            val periods = listOf(
                null to "All", 1 to "1h", 2 to "2h", 4 to "4h",
                6 to "6h", 12 to "12h", 24 to "1d", 48 to "2d", 168 to "7d"
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                flingBehavior = rememberPremiumFlingBehavior()
            ) {
                items(periods, key = { it.second }) { (value, title) ->
                    val selected = hours == value
                    Box(
                        Modifier.height(42.dp).widthIn(min = 58.dp)
                            .clip(CircleShape)
                            .background(if (selected) pickerBlue else pickerGray)
                            .clickable { onHoursChange(value) }
                            .padding(horizontal = 15.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(title, fontSize = 14.sp,
                            color = if (selected) Color.White else pickerInk,
                            fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(14.dp))

            // Site parity: Top exits competition filtering to the current sport,
            // rather than opening an extra nested league picker.
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    .height(57.dp).clip(RoundedCornerShape(17.dp))
                    .background(pickerBlue)
                    .clickable {
                        filter = ""
                        selectedCountry = ""
                        onSelect("")
                        dismiss()
                    }
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🔥", fontSize = 22.sp)
                Spacer(Modifier.width(12.dp))
                Text(tr(lang, "Top", "برترین‌ها"), modifier = Modifier.weight(1f),
                    color = Color.White, fontSize = 15.sp,
                    fontWeight = FontWeight.Bold)
                Icon(Icons.Default.ChevronRight, null,
                    tint = Color.White, modifier = Modifier.size(23.dp))
            }

            // The website reference has a persistent search. Search includes
            // real sport, country and league names, not only visible row labels.
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                    value = filter, onValueChange = { filter = it.take(80) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                        .padding(horizontal = 17.dp)
                        .heightIn(min = 52.dp),
                    shape = RoundedCornerShape(16.dp),
                    leadingIcon = {
                        Icon(Icons.Default.Search, null,
                            tint = Color(0xFF8791A1))
                    },
                    placeholder = {
                        Text(tr(lang, "Search sports, countries or leagues",
                            "جست‌وجوی رشته، کشور یا لیگ"),
                            color = pickerMuted, fontSize = 12.sp)
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = pickerInk,
                        unfocusedTextColor = pickerInk,
                        focusedContainerColor = pickerGray,
                        unfocusedContainerColor = pickerGray,
                        focusedBorderColor = pickerBlue,
                        unfocusedBorderColor = Color.Transparent,
                        focusedPlaceholderColor = pickerMuted,
                        unfocusedPlaceholderColor = pickerMuted,
                        cursorColor = pickerBlue
                    )
                )
            Spacer(Modifier.height(9.dp))

            // The list scrolls independently, retaining header and time chips.
            LaunchedEffect(screen, currentSport, selectedCountry, hours, filter) {
                listState.scrollToItem(0)
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentPadding = PaddingValues(start = 17.dp, end = 17.dp,
                    top = 1.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.spacedBy(1.dp),
                flingBehavior = rememberPremiumFlingBehavior()
            ) {
                if (screen == "sports") {
                    itemsIndexed(visible, key = { _, node -> node.key }) { index, node ->
                        val isSport = node.key.startsWith("sport:")
                        val isCountry = node.key.startsWith("country:")
                        // Dash means not queried, never a fabricated zero. All
                        // loaded counts come from the active provider's fixtures.
                        val loaded = if (!isSport) true else if (activeSport == "all")
                            node.sport in setOf("football", "basketball", "tennis",
                                "volleyball", "hockey", "cricket", "handball")
                        else upcomingSportIdentity(activeSport) == node.sport ||
                            (activeSport == "esports" && node.sport.startsWith("esports:"))
                        TournamentPickerRow(
                            title = node.label,
                            count = node.count.takeIf { loaded },
                            emblem = when {
                                isSport -> tournamentSportEmoji(node.sport)
                                isCountry -> tournamentPlaceEmoji(node.country)
                                else -> "🏆"
                            },
                            match = if (!isSport && !isCountry) node.sample else null,
                            first = index == 0, last = index == visible.lastIndex,
                            onClick = {
                                filter = ""
                                if (isSport) {
                                    selectedSport = node.sport
                                    selectedCountry = ""
                                    screen = if (tournamentDirectSport(node.sport))
                                        "leagues" else "countries"
                                    if (upcomingSportIdentity(activeSport) != node.sport) {
                                        onSportChange(if (node.sport.startsWith("esports:"))
                                            "esports" else node.sport)
                                    }
                                } else if (isCountry) {
                                    selectedSport = node.sport
                                    selectedCountry = node.country
                                    screen = "leagues"
                                    if (upcomingSportIdentity(activeSport) != node.sport)
                                        onSportChange(node.sport)
                                } else if (upcomingSportIdentity(activeSport) == node.sport) {
                                    onSelect(node.key)
                                    dismiss()
                                } else {
                                    // The selected league must be loaded in the
                                    // selected sport's own catalogue before use.
                                    selectedSport = node.sport
                                    selectedCountry = node.country
                                    screen = "leagues"
                                    onSportChange(if (node.sport.startsWith("esports:"))
                                        "esports" else node.sport)
                                }
                            }
                        )
                    }
                } else if (screen == "countries") {
                    itemsIndexed(visible, key = { _, node -> node.key }) { index, node ->
                        TournamentPickerRow(
                            title = node.label,
                            count = node.count,
                            emblem = tournamentPlaceEmoji(node.country),
                            first = index == 0, last = index == visible.lastIndex,
                            onClick = {
                                selectedCountry = node.country
                                filter = ""
                                screen = "leagues"
                            }
                        )
                    }
                } else {
                    itemsIndexed(visible, key = { _, node -> node.key }) { index, node ->
                        TournamentPickerRow(
                            title = node.label,
                            count = node.count,
                            emblem = "🏆",
                            first = index == 0, last = index == visible.lastIndex,
                            match = node.sample,
                            onClick = {
                                onSelect(node.key)
                                dismiss()
                            }
                        )
                    }
                }
                if (visible.isEmpty()) {
                    item("empty") {
                        Column(
                            Modifier.fillMaxWidth().padding(30.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(9.dp)
                        ) {
                            Icon(Icons.Default.SearchOff, null,
                                tint = pickerMuted, modifier = Modifier.size(35.dp))
                            Text(tr(lang, "No competitions in the loaded catalogue",
                                "در داده‌های بارگذاری‌شده رقابتی یافت نشد"),
                                color = pickerInk, fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold)
                            Text(tr(lang,
                                "Try All dates or another sport. Counts reflect only real provider fixtures.",
                                "بازه زمانی همه یا رشته دیگری را امتحان کنید. تعدادها فقط از مسابقات واقعی API محاسبه می‌شوند."),
                                color = pickerMuted, fontSize = 11.sp, lineHeight = 18.sp)
                        }
                    }
                }
            }
            Text(subtitle,
                modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp),
                color = pickerMuted, fontSize = 10.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

@Composable
private fun TournamentPickerRow(
    title: String, count: Int?, emblem: String,
    match: Match? = null, first: Boolean = false, last: Boolean = false,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = pickerGray,
        shape = RoundedCornerShape(
            topStart = if (first) 17.dp else 0.dp,
            topEnd = if (first) 17.dp else 0.dp,
            bottomStart = if (last) 17.dp else 0.dp,
            bottomEnd = if (last) 17.dp else 0.dp
        )
    ) {
        Row(
            Modifier.heightIn(min = 62.dp)
                .padding(horizontal = 13.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (match != null) {
                LeagueIdentityBadge(match, size = 35)
            } else {
                Box(Modifier.size(37.dp),
                    contentAlignment = Alignment.Center) {
                    Text(emblem, fontSize = 22.sp)
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(title, modifier = Modifier.weight(1f),
                color = pickerInk, fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(count?.toString() ?: "—",
                color = pickerMuted, fontSize = 13.sp)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Default.ChevronRight, null,
                tint = Color(0xFF626875),
                modifier = Modifier.size(21.dp))
        }
    }
}
