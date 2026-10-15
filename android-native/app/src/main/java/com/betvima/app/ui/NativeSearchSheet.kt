package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.Match
import com.betvima.app.data.Market
import com.betvima.app.data.Selection
import com.betvima.app.data.odds
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val searchBg = Color(0xFFE9EAEF)
private val searchText = Color(0xFF23252A)
private val searchGray = Color(0xFF747985)

internal fun searchKickoff(value: String, zone: ZoneId = ZoneId.systemDefault()): String =
    runCatching {
        DateTimeFormatter.ofPattern("HH:mm • dd/MM/yyyy", Locale.UK)
            .format(Instant.parse(value).atZone(zone))
    }.getOrElse {
        runCatching {
            DateTimeFormatter.ofPattern("HH:mm • dd/MM/yyyy", Locale.UK)
                .format(LocalDateTime.parse(value))
        }.getOrElse { value.take(16).replace("T", " • ").ifBlank { "—" } }
    }

/**
 * Reference-inspired full-screen search inside the existing Scaffold.
 * The main BetVima header and bottom nav stay visible, just like the reference.
 * No WebView or fake odds. Both result sections use server-side catalogue queries.
 */
@Composable
fun NativeSearchSheet(state: AppState, model: AppViewModel, onDismiss: () -> Unit) {
    var query by rememberSaveable { mutableStateOf(state.searchTerm) }
    val field = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(query) {
        delay(300)
        model.searchMatches(query)
    }
    LaunchedEffect(Unit) {
        delay(150)
        runCatching { field.requestFocus() }
    }
    val close: () -> Unit = {
        keyboard?.hide()
        model.clearSearch()
        onDismiss()
    }
    val openMatch: (String) -> Unit = { id ->
        keyboard?.hide()
        model.clearSearch()
        onDismiss()
        model.openMatch(id)
    }

    Column(Modifier.fillMaxSize().background(searchBg).imePadding()) {
        Box(
            Modifier.fillMaxWidth().height(66.dp).padding(horizontal = 17.dp),
            contentAlignment = Alignment.Center
        ) {
            IconButton(onClick = close, modifier = Modifier.align(Alignment.CenterStart)) {
                Icon(Icons.Default.ArrowBack,
                    tr(state.lang, "Back", "بازگشت"), tint = searchText)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Search, null, tint = searchGray,
                    modifier = Modifier.size(21.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(state.lang, "Search", "جست‌وجو"), color = searchText,
                    fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(80) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .heightIn(min = 59.dp).focusRequester(field),
            singleLine = true, shape = RoundedCornerShape(16.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
            leadingIcon = {
                Icon(Icons.Default.Search, null, tint = Color(0xFF89919F))
            },
            trailingIcon = {
                if (query.isNotBlank()) IconButton(onClick = { query = "" }) {
                    Icon(Icons.Default.Cancel, tr(state.lang, "Clear", "پاک کردن"),
                        modifier = Modifier.size(20.dp), tint = searchGray)
                }
            },
            placeholder = {
                Text(tr(state.lang, "Team, league or match", "نام تیم، لیگ یا مسابقه"),
                    color = searchGray, fontSize = 14.sp)
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color(0xFFDFE2E9),
                unfocusedContainerColor = Color(0xFFDFE2E9),
                focusedBorderColor = Color(0xFF248CFA),
                unfocusedBorderColor = Color(0xFFB8C0CC),
                focusedTextColor = searchText,
                unfocusedTextColor = searchText,
                cursorColor = Color(0xFF248CFA)
            )
        )
        Spacer(Modifier.height(15.dp))

        val pending = query.trim() != state.searchTerm || state.searchLoading
        val ready = query.trim().length >= 2
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
            flingBehavior = rememberPremiumFlingBehavior()
        ) {
            when {
                !ready -> item(key = "hint") {
                    Text(tr(state.lang,
                        "Enter at least two characters to search live and upcoming matches.",
                        "برای جست‌وجوی مسابقات زنده و آینده حداقل دو حرف وارد کنید."),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                        color = searchGray, fontSize = 13.sp)
                }
                pending -> items(3, key = { "loading-$it" }) {
                    FixtureSkeleton()
                }
                state.searchError != null -> item(key = "error") {
                    EmptyPanel(tr(state.lang, "Search unavailable", "جست‌وجو در دسترس نیست"),
                        state.searchError) { model.searchMatches(query) }
                }
                state.searchLive.isEmpty() && state.searchUpcoming.isEmpty() ->
                    item(key = "empty") {
                        EmptyPanel(tr(state.lang, "No matches found", "مسابقه‌ای پیدا نشد"),
                            tr(state.lang, "Try another team or league.",
                                "نام تیم یا لیگ دیگری را جست‌وجو کنید."))
                    }
                else -> {
                    if (state.searchLive.isNotEmpty()) {
                        item(key = "live-header", contentType = "section") {
                            SearchResultSection(
                                tr(state.lang, "Live", "زنده"), state.searchLive.size,
                                Color(0xFFED0064), true)
                        }
                        items(state.searchLive, key = { "live-${it.id}" }, contentType = { "fixture" }) { match ->
                            SearchResultCard(match, state, model, openMatch)
                        }
                    }
                    if (state.searchUpcoming.isNotEmpty()) {
                        item(key = "upcoming-header", contentType = "section") {
                            SearchResultSection(
                                tr(state.lang, "Upcoming", "بازی‌های آینده"),
                                state.searchUpcoming.size, Color(0xFF02C76C), false)
                        }
                        items(state.searchUpcoming, key = { "pre-${it.id}" }, contentType = { "fixture" }) { match ->
                            SearchResultCard(match, state, model, openMatch)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchResultSection(label: String, count: Int, color: Color, live: Boolean) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(30.dp).background(color, RoundedCornerShape(9.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(if (live) Icons.Default.Sensors else Icons.Default.Event,
                null, modifier = Modifier.size(19.dp), tint = Color.White)
        }
        Spacer(Modifier.width(10.dp))
        Text(label, fontWeight = FontWeight.Black, fontSize = 18.sp, color = searchText)
        Spacer(Modifier.width(8.dp))
        Text(count.toString(), fontSize = 11.sp, color = searchGray)
    }
}

@Composable
private fun SearchResultCard(
    match: Match,
    state: AppState,
    model: AppViewModel,
    onOpen: (String) -> Unit
) {
    val market = match.featured
    val lang = state.lang
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth().clickable { onOpen(match.id) }
                    .padding(horizontal = 13.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.EmojiEvents, null, tint = Color(0xFF138DE9),
                    modifier = Modifier.size(25.dp))
                Spacer(Modifier.width(9.dp))
                val logo = match.leagueLogo?.takeIf { it.startsWith("https://") }
                if (logo != null) {
                    AsyncImage(model = logo, contentDescription = null,
                        modifier = Modifier.size(25.dp))
                    Spacer(Modifier.width(8.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(match.league, color = searchText, fontWeight = FontWeight.ExtraBold,
                        fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(match.sport.replace("-", " ").replaceFirstChar { it.uppercase() },
                        color = searchGray, fontSize = 11.sp)
                }
            }
            HorizontalDivider(color = Color(0xFFE5E6EB), thickness = .8.dp)
            Column(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    Modifier.fillMaxWidth().clickable { onOpen(match.id) },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(if (match.live) Icons.Default.Sensors else Icons.Default.LocalFireDepartment,
                        null, tint = if (match.live) Color(0xFFED0064) else Color(0xFFF45E15),
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(6.dp))
                    Surface(shape = RoundedCornerShape(40.dp), color = Color(0xFFF7F8FA),
                        border = BorderStroke(1.dp, Color(0xFFE7E9ED))) {
                        Text(if (match.live)
                            tr(lang, "Live", "زنده") +
                                (match.minute?.let { " · ${it}′" } ?: "")
                            else searchKickoff(match.starts),
                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = searchText)
                    }
                }
                listOf(match.home to match.homeScore, match.away to match.awayScore)
                    .forEach { (team, score) ->
                        Row(Modifier.fillMaxWidth().clickable { onOpen(match.id) },
                            verticalAlignment = Alignment.CenterVertically) {
                            TeamBadge(team, 25)
                            Spacer(Modifier.width(8.dp))
                            Text(team.name, modifier = Modifier.weight(1f),
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                                color = searchText, fontSize = 13.sp,
                                fontWeight = FontWeight.Bold)
                            if (match.live && score != null) {
                                Surface(color = Color(0xFFF0F2F6), shape = RoundedCornerShape(5.dp)) {
                                    Text(score.toString(), modifier = Modifier.padding(
                                        horizontal = 6.dp, vertical = 3.dp),
                                        fontSize = 12.sp, fontWeight = FontWeight.Black,
                                        color = searchText)
                                }
                            }
                        }
                    }
                Text(market?.label(lang == Lang.FA) ?: tr(lang, "Odds unavailable", "ضریب موجود نیست"),
                    color = searchGray, fontSize = 11.sp, maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    repeat(3) { index ->
                        val selection = market?.selections?.getOrNull(index)
                        Box(Modifier.weight(1f)) {
                            if (market != null && selection != null) {
                                SearchOdds(match, market, selection, index, state, model)
                            } else {
                                Box(Modifier.fillMaxWidth().height(45.dp)
                                    .background(Color(0xFFF0F1F5), RoundedCornerShape(7.dp)))
                            }
                        }
                    }
                    Surface(
                        modifier = Modifier.width(48.dp).height(45.dp)
                            .clickable { onOpen(match.id) },
                        shape = RoundedCornerShape(8.dp), color = Color(0xFFF0F1F5)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(if (match.marketsCount > 0) "+${match.marketsCount}" else "›",
                                fontWeight = FontWeight.Black, fontSize = 11.sp, color = searchText)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchOdds(
    match: Match,
    market: Market,
    selection: Selection,
    index: Int,
    state: AppState,
    model: AppViewModel
) {
    val enabled = match.bettingAvailable && market.available && selection.available &&
        (!match.live || state.liveEnabled)
    val selected = state.picks.any { it.selectionId == selection.id }
    Surface(
        modifier = Modifier.fillMaxWidth().height(45.dp)
            .clickable(enabled = enabled) { model.togglePick(match, market, selection) },
        shape = RoundedCornerShape(7.dp),
        color = if (selected) Color(0xFFDCEAFF) else Color(0xFFF0F1F5),
        border = if (selected) BorderStroke(1.dp, Color(0xFF188DF6)) else null
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (market.key == "h2h" && market.selections.size >= 3)
                listOf("1", "X", "2")[index] else selection.label(state.lang == Lang.FA),
                color = searchGray, fontSize = 10.sp, maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f))
            if (enabled) Text(odds(selection.oddsScaled), color = searchText,
                fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1)
            else Icon(Icons.Default.Lock, null, tint = searchGray,
                modifier = Modifier.size(14.dp))
        }
    }
}
