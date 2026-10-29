package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.Match
import com.betvima.app.data.Market
import com.betvima.app.data.Selection
import com.betvima.app.data.odds
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import coil.compose.AsyncImage

// Only match details use this light reference layout. No global app-theme changes.
private val matchCanvas211 = Color(0xFF111216)
private val matchTile211 = Color(0xFF292C33)
private val matchInk211 = Color(0xFFF5F6FA)
private val matchMuted211 = Color(0xFFA3A7B2)
private val matchBlue211 = Color(0xFF087BFA)
private val matchCard211 = Color(0xFF1B1E24)
private val matchDivider211 = Color(0xFF343943)
private val matchGreen211 = Color(0xFF00D47A)

private data class DetailTab211(val key: String, val english: String, val persian: String)

private val detailTabs211 = listOf(
    DetailTab211("all", "All", "همه"),
    DetailTab211("main", "Main", "اصلی"),
    DetailTab211("quick", "Quick ⚡", "سریع ⚡"),
    DetailTab211("total", "Total", "مجموع"),
    DetailTab211("halves", "Halves", "نیمه‌ها"),
    DetailTab211("handicap", "Handicap", "هندیکپ"),
    DetailTab211("corners", "Corners", "کرنرها"),
    DetailTab211("cards", "Cards", "کارت‌ها"),
    DetailTab211("correct", "Correct score", "نتیجه دقیق")
)

internal fun matchDetailFilter211(
    markets: List<Market>, group: String, query: String
): List<Market> = markets.filterIndexed { index, market ->
    val text = (market.key + " " + market.name + " " + market.nameFa).lowercase()
    val category = when (group) {
        "all" -> true
        "main" -> index < 6 || listOf("h2h", "result", "chance", "winner").any(text::contains)
        "quick" -> index < 8 && market.selections.isNotEmpty()
        "total" -> listOf("total", "over", "under", "goals", "مجموع", "گل").any(text::contains)
        "halves" -> listOf("half", "1st half", "2nd half", "period", "نیمه").any(text::contains)
        "handicap" -> listOf("handicap", "spread", "هندیکپ").any(text::contains)
        "corners" -> listOf("corner", "کرنر").any(text::contains)
        "cards" -> listOf("card", "booking", "کارت").any(text::contains)
        "correct" -> listOf("correct score", "exact score", "نتیجه دقیق").any(text::contains)
        else -> true
    }
    category && (query.isBlank() || text.contains(query.trim().lowercase()))
}

private fun displayScore211(match: Match, facts: LiveMatchFacts?): Pair<String, String> {
    val upstream = facts?.score?.split("-")?.map(String::trim)
    if (upstream != null && upstream.size == 2 &&
        upstream.all { it.toIntOrNull() != null }) return upstream[0] to upstream[1]
    return (match.homeScore?.toString() ?: "–") to
        (match.awayScore?.toString() ?: "–")
}

/**
 * Match detail reference layout:
 * 1. Full league and scoreboard at the start.
 * 2. Sticky blue tabs replace the old moving market filters.
 * 3. Once the main scoreboard has scrolled away, the compact score/teams row
 *    is shown ABOVE those same tabs and remains attached during long markets.
 * The UI never fabricates markets, prices, clock values or playable state.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ReferenceMatchDetail211(state: AppState, model: AppViewModel) {
    val match = state.detail
    if (match == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (state.detailLoading) CircularProgressIndicator(color = matchBlue211)
            else EmptyPanel(tr(state.lang, "Match unavailable", "مسابقه در دسترس نیست"),
                tr(state.lang, "Return to sports.", "به فهرست ورزش‌ها برگردید.")) {
                model.closeMatch()
            }
        }
        return
    }
    var tab by rememberSaveable(match.id) { mutableStateOf("all") }
    var search by rememberSaveable(match.id) { mutableStateOf("") }
    var searchOpen by rememberSaveable(match.id) { mutableStateOf(false) }
    var tvOpen by rememberSaveable(match.id) { mutableStateOf(false) }
    val scroll = remember(match.id) { LazyListState() }
    val scrollScope = rememberCoroutineScope()
    val tabScroll = remember(match.id) { LazyListState() }
    LaunchedEffect(match.id) {
        if (match.live && match.id.startsWith("betsapi:live:")) {
            model.refreshMatchFacts(match.id)
            while (true) {
                delay(14_000)
                model.refreshMatchFacts(match.id)
            }
        }
    }
    val facts = state.liveFacts?.takeIf {
        match.id.startsWith("betsapi:live:") &&
            match.id.substringAfterLast(':') == it.fi
    }
    val clockLabel = rememberVerifiedMatchClock(match, facts)
    val scores = displayScore211(match, facts)
    val focusId = state.focusedMarketId
    val matches = remember(match.markets, tab, search) {
        matchDetailFilter211(match.markets, tab, search)
    }
    LaunchedEffect(match.id, focusId) {
        if (focusId != null) {
            tab = "all"
            search = ""
            searchOpen = false
        }
    }
    LaunchedEffect(match.id, focusId, matches) {
        if (focusId != null) {
            val marketIndex = matches.indexOfFirst { it.id == focusId }
            if (marketIndex >= 0) scroll.animateScrollToItem(marketIndex + 3)
        }
    }
    val collapsed by remember(scroll) {
        derivedStateOf { scroll.firstVisibleItemIndex >= 2 }
    }
    if (tvOpen) PremiumMatchTvModal126(
        match = match, facts = facts, fa = state.lang == Lang.FA,
        clockLabel = clockLabel, onClose = { tvOpen = false },
        onRefresh = { model.refreshMatchFacts(match.id) }
    )
    Box(Modifier.fillMaxSize().background(matchCanvas211)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = scroll,
            contentPadding = PaddingValues(bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
            flingBehavior = rememberPremiumFlingBehavior()
        ) {
            item(key = "match-breadcrumb") {
                Row(
                    Modifier.fillMaxWidth().height(52.dp)
                        .padding(horizontal = 19.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = model::closeMatch, modifier = Modifier.size(40.dp)) {
                        Icon(Icons.Default.ArrowBack, "Back", tint = matchInk211)
                    }
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically) {
                        verifiedLogoUrl(match.leagueLogo)?.let { logo ->
                            AsyncImage(model = logo, contentDescription = null,
                                modifier = Modifier.size(22.dp))
                            Spacer(Modifier.width(7.dp))
                        }
                        Text(match.league, color = matchMuted211, fontSize = 14.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.width(40.dp))
                }
            }
            item(key = "match-scoreboard") {
                DetailModeSwitcher211(match.live, state.lang == Lang.FA) { tvOpen = true }
                Spacer(Modifier.height(10.dp))
                DetailLargeScore211(match, scores, clockLabel, state.lang == Lang.FA) {
                    tvOpen = true
                }
                if (state.detailLoading && !state.detailError) {
                    LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp),
                        color = matchBlue211)
                }
                Spacer(Modifier.height(9.dp))
            }
            stickyHeader(key = "match-sticky-tabs") {
                Column(Modifier.fillMaxWidth().background(matchCanvas211)) {
                    AnimatedVisibility(visible = collapsed) {
                        Surface(color = matchCard211) {
                            DetailCompactScore211(match, scores, clockLabel)
                        }
                    }
                    DetailTabStrip211(tab, state.lang == Lang.FA, listState = tabScroll, onTab = {
                        tab = it
                        // Keep the compact row in place on selection; only change market data.
                    }, searchOpen = searchOpen, onSearch = {
                        searchOpen = !searchOpen
                        if (!searchOpen) search = ""
                    })
                    AnimatedVisibility(visible = searchOpen) {
                        OutlinedTextField(value = search, onValueChange = { search = it.take(60) },
                            modifier = Modifier.fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            singleLine = true, shape = RoundedCornerShape(13.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = matchInk211,
                                unfocusedTextColor = matchInk211,
                                cursorColor = matchBlue211,
                                focusedBorderColor = matchBlue211,
                                unfocusedBorderColor = matchDivider211,
                                focusedPlaceholderColor = matchMuted211,
                                unfocusedPlaceholderColor = matchMuted211
                            ),
                            placeholder = {
                                Text(tr(state.lang, "Search markets", "جست‌وجوی بازار"),
                                    fontSize = 12.sp)
                            }, trailingIcon = {
                                IconButton(onClick = { search = ""; searchOpen = false }) {
                                    Icon(Icons.Default.Close, "Close")
                                }
                            })
                    }
                    HorizontalDivider(thickness = 1.dp, color = matchDivider211)
                }
            }
            if (state.detailError) item(key = "match-market-fetch-error") {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    color = Color(0xFF342A1E),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(state.lang,
                            "Latest markets are unavailable. Retry.",
                            "دریافت ضرایب جدید ناموفق بود؛ دوباره تلاش کنید."),
                            color = Color(0xFFF9CA79), fontSize = 12.sp,
                            modifier = Modifier.weight(1f))
                        TextButton(onClick = { model.openMatch(match.id) }) {
                            Text(tr(state.lang,"Retry","تلاش مجدد"))
                        }
                    }
                }
            }
            if (matches.isEmpty()) item(key = "match-no-markets") {
                Surface(
                    modifier = Modifier.fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    color = matchCard211, shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, matchDivider211)
                ) {
                    Row(Modifier.padding(horizontal = 17.dp, vertical = 18.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, contentDescription = null,
                            tint = matchBlue211, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(12.dp))
                        Text(tr(state.lang,
                            "No markets available for this match.",
                            "هنوز بازاری برای این مسابقه در دسترس نیست."),
                            fontSize = 13.sp, color = matchMuted211,
                            modifier = Modifier.weight(1f), lineHeight = 19.sp)
                    }
                }
            }
            items(matches, key = { "detail-market-" + it.id }) { market ->
                val index = match.markets.indexOfFirst { it.id == market.id }
                var open by rememberSaveable(market.id) {
                    mutableStateOf(index < 4 || market.id == focusId)
                }
                LaunchedEffect(focusId, market.id) {
                    if (market.id == focusId) open = true
                }
                DetailMarketCard211(
                    match = match, market = market, state = state, model = model,
                    expanded = open, toggle = { open = !open },
                    focused = market.id == focusId
                )
            }
            item(key = "match-footer") {
                PremiumAppFooter(
                    state = state, model = model,
                    onBackToTop = { scrollScope.launch { scroll.animateScrollToItem(0) } }
                )
            }
        }
    }
}

@Composable
private fun DetailLargeScore211(
    match: Match, score: Pair<String, String>, clock: String,
    fa: Boolean, onOpenStudio: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
        color = matchCard211, shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, matchDivider211)
    ) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 13.dp)) {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 111.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                    TeamBadge(match.home, 49)
                    Spacer(Modifier.height(7.dp))
                    Text(match.home.name, fontSize = 13.sp, lineHeight = 17.sp,
                        fontWeight = FontWeight.Bold, color = matchInk211,
                        maxLines = 3, overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Start)
                }
                Column(Modifier.width(112.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        color = matchTile211, shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, if (match.live)
                            matchGreen211.copy(alpha = .48f) else matchDivider211)
                    ) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 9.dp),
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Text(score.first, fontSize = 24.sp, fontWeight = FontWeight.Black,
                                color = matchInk211, textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1f))
                            Text(":", color = matchMuted211, fontSize = 20.sp)
                            Text(score.second, fontSize = 24.sp, fontWeight = FontWeight.Black,
                                color = matchInk211, textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1f))
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (match.live) {
                            Icon(Icons.Default.Sensors, contentDescription = null,
                                tint = Color(0xFFFF477A), modifier = Modifier.size(13.dp))
                            Spacer(Modifier.width(4.dp))
                        }
                        Text(if (match.live) clock else if (fa) "شروع نشده" else "Upcoming",
                            fontSize = 11.sp,
                            color = if (match.live) Color(0xFFFF648C) else matchMuted211,
                            fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                    TeamBadge(match.away, 49)
                    Spacer(Modifier.height(7.dp))
                    Text(match.away.name, fontSize = 13.sp, lineHeight = 17.sp,
                        fontWeight = FontWeight.Bold, color = matchInk211,
                        maxLines = 3, overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.End)
                }
            }
            if (match.live) {
                HorizontalDivider(Modifier.padding(top = 12.dp, bottom = 9.dp),
                    color = matchDivider211, thickness = 1.dp)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(match.home.name, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                        color = matchMuted211, modifier = Modifier.weight(1f),
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(score.first + " : " + score.second,
                        fontSize = 14.sp, fontWeight = FontWeight.Bold, color = matchInk211)
                    Spacer(Modifier.width(10.dp))
                    Text(match.away.name, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                        color = matchMuted211, modifier = Modifier.weight(1f),
                        textAlign = TextAlign.End,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.height(7.dp))
                Text(if (fa) "نمایش زنده" else "Live match",
                    fontSize = 11.sp, color = matchBlue211,
                    modifier = Modifier.align(Alignment.End).clickable(onClick = onOpenStudio))
            }
        }
    }
}

@Composable
private fun DetailCompactScore211(
    match: Match, score: Pair<String, String>, clock: String
) {
    Row(Modifier.fillMaxWidth()
        .padding(start = 16.dp, end = 16.dp, top = 9.dp, bottom = 9.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TeamBadge(match.home, 24)
                Spacer(Modifier.width(7.dp))
                Text(match.home.name, color = matchInk211,
                    fontWeight = FontWeight.Bold, fontSize = 13.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TeamBadge(match.away, 24)
                Spacer(Modifier.width(7.dp))
                Text(match.away.name, color = matchInk211,
                    fontWeight = FontWeight.Bold, fontSize = 13.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Column(Modifier.padding(start = 9.dp, end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            listOf(score.first, score.second).forEach { number ->
                Surface(color = matchTile211,
                    shape = RoundedCornerShape(8.dp)) {
                    Text(number, fontSize = 14.sp, fontWeight = FontWeight.Black,
                        color = matchInk211, textAlign = TextAlign.Center,
                        modifier = Modifier.defaultMinSize(minWidth = 26.dp)
                            .padding(vertical = 3.dp))
                }
            }
        }
        Column(Modifier.widthIn(min = 63.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            if (match.live) {
                Icon(Icons.Default.Sensors, contentDescription = null,
                    tint = Color(0xFFE11D71), modifier = Modifier.size(19.dp))
            }
            Text(if (match.live) clock else "Upcoming",
                color = matchMuted211, fontSize = 11.sp, maxLines = 1)
        }
    }
}

@Composable
private fun DetailModeSwitcher211(live: Boolean, fa: Boolean, onOpenStudio: () -> Unit) {
    Surface(Modifier.fillMaxWidth().padding(horizontal = 17.dp),
        color = matchTile211, shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.padding(3.dp).height(45.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            listOf("score", "tv", "tracker").forEach { entry ->
                val selected = entry == "score"
                val enabled = selected || live
                Surface(modifier = Modifier.weight(1f)
                    .clickable(enabled = enabled && !selected, onClick = onOpenStudio),
                    color = if (selected) matchCard211 else Color.Transparent,
                    shape = RoundedCornerShape(15.dp),
                    shadowElevation = if (selected) 1.dp else 0.dp) {
                    Box(contentAlignment = Alignment.Center) {
                        when (entry) {
                            "score" -> Text("1:1", fontSize = 14.sp,
                                fontWeight = FontWeight.Black, color = matchGreen211)
                            "tv" -> Icon(Icons.Default.Tv, contentDescription = "TV",
                                tint = Color(0xFF53A7FF),
                                modifier = Modifier.size(22.dp))
                            else -> Icon(Icons.Default.Sensors,
                                contentDescription = if (fa) "زنده" else "Live",
                                tint = Color(0xFFFF477A),
                                modifier = Modifier.size(22.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailTabStrip211(
    selected: String, fa: Boolean, listState: LazyListState, onTab: (String) -> Unit,
    searchOpen: Boolean, onSearch: () -> Unit
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        LazyRow(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 15.dp, end = 5.dp, top = 6.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            flingBehavior = rememberPremiumFlingBehavior()
        ) {
            items(detailTabs211, key = { it.key }) { tab ->
                val isSelected = tab.key == selected
                val background by animateColorAsState(
                    if (isSelected) matchBlue211 else matchTile211,
                    animationSpec = tween(210), label = "detailTab211"
                )
                Surface(
                    color = background,
                    shape = RoundedCornerShape(28.dp),
                    modifier = Modifier.heightIn(min = 44.dp)
                        .clickable { onTab(tab.key) }
                ) {
                    Box(Modifier.padding(horizontal = 17.dp, vertical = 12.dp),
                        contentAlignment = Alignment.Center) {
                        Text(if (fa) tab.persian else tab.english,
                            fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                            color = if (isSelected) Color.White else matchInk211,
                            maxLines = 1)
                    }
                }
            }
        }
        IconButton(onClick = onSearch, modifier = Modifier.size(43.dp)) {
            Icon(if (searchOpen) Icons.Default.Close else Icons.Default.Search,
                "Search", tint = matchMuted211)
        }
    }
}

@Composable
private fun DetailMarketCard211(
    match: Match, market: Market, state: AppState, model: AppViewModel,
    expanded: Boolean, toggle: () -> Unit, focused: Boolean
) {
    Surface(
        modifier = Modifier.fillMaxWidth()
            .padding(horizontal = 15.dp, vertical = 7.dp),
        shape = RoundedCornerShape(19.dp),
        color = matchCard211,
        border = if (focused) BorderStroke(2.dp, matchBlue211)
            else BorderStroke(1.dp, matchDivider211)
    ) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = toggle)
                .heightIn(min = 69.dp)
                .padding(horizontal = 18.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(NativeMarketLabels176.selection(state.lang,
                    market.label(false), market.label(true)),
                    fontSize = 16.sp, fontWeight = FontWeight.ExtraBold,
                    color = matchInk211, modifier = Modifier.weight(1f),
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.width(6.dp))
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    if (expanded) "Collapse market" else "Expand market",
                    tint = matchMuted211, modifier = Modifier.size(24.dp))
            }
            AnimatedVisibility(visible = expanded) {
                Column {
                    HorizontalDivider(color = matchDivider211, thickness = 1.dp)
                    val columns = if (market.selections.size == 1) 1
                        else if (market.selections.size == 2) 2 else 3
                    if (columns == 2 && (market.key.contains("total", true) ||
                            market.key.contains("over", true) ||
                            market.name.contains("total", true))) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 8.dp)) {
                            market.selections.take(2).forEach { selection ->
                                val kind = when {
                                    selection.name.contains("under", true) -> "Under"
                                    selection.name.contains("over", true) -> "Over"
                                    else -> ""
                                }
                                Text(kind, color = matchMuted211, fontSize = 12.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    market.selections.chunked(columns).forEach { chunk ->
                        Row(Modifier.fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            chunk.forEach { selection ->
                                DetailOddTile211(match, market, selection, state, model,
                                    Modifier.weight(1f), compactInline = columns < 3)
                            }
                            repeat(columns - chunk.size) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }
}

@Composable
private fun DetailOddTile211(
    match: Match, market: Market, selection: Selection,
    state: AppState, model: AppViewModel, modifier: Modifier,
    compactInline: Boolean
) {
    val enabled = match.bettingAvailable && market.available &&
        selection.available && (!match.live || state.liveEnabled)
    val chosen = state.picks.any { it.selectionId == selection.id }
    var oddsCenter by remember(selection.id) { mutableStateOf(Offset.Unspecified) }
    val title = NativeMarketLabels176.selection(state.lang,
        selection.label(false), selection.label(true))
    Surface(
        modifier = modifier.heightIn(min = if (compactInline) 58.dp else 89.dp)
            .onGloballyPositioned { oddsCenter = it.boundsInWindow().center }
            .clickable(enabled = enabled) {
                model.togglePick(match, market, selection, oddsCenter.x, oddsCenter.y)
            },
        shape = RoundedCornerShape(14.dp),
        color = if (chosen) Color(0xFF13385D) else matchTile211,
        border = if (chosen) BorderStroke(2.dp, matchBlue211) else null
    ) {
        if (compactInline) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(title, color = matchInk211, fontSize = 12.sp,
                    lineHeight = 16.sp, maxLines = 2, textAlign = TextAlign.Start,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f))
                Spacer(Modifier.width(6.dp))
                Text(odds(selection.oddsScaled),
                    color = if (chosen) matchBlue211 else matchInk211,
                    fontSize = 16.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.End, maxLines = 1)
            }
        } else {
            Column(Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 11.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween) {
                Text(title, color = matchInk211, fontSize = 12.sp,
                    lineHeight = 16.sp, maxLines = 3,
                    textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(12.dp))
                Text(odds(selection.oddsScaled),
                    color = if (chosen) matchBlue211 else matchInk211,
                    fontSize = 18.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center, maxLines = 1)
            }
        }
    }
}
