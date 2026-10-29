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
import coil.compose.AsyncImage

// Only match details use this light reference layout. No global app-theme changes.
private val matchCanvas211 = Color(0xFFE7E8ED)
private val matchTile211 = Color(0xFFEDEEF2)
private val matchInk211 = Color(0xFF15171B)
private val matchMuted211 = Color(0xFF636876)
private val matchBlue211 = Color(0xFF087BFA)

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
                    Modifier.fillMaxWidth().height(65.dp)
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
                Spacer(Modifier.height(21.dp))
                DetailLargeScore211(match, scores, clockLabel, state.lang == Lang.FA) {
                    tvOpen = true
                }
                if (state.detailLoading && !state.detailError) {
                    LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp),
                        color = matchBlue211)
                }
                Spacer(Modifier.height(17.dp))
            }
            stickyHeader(key = "match-sticky-tabs") {
                Column(Modifier.fillMaxWidth().background(matchCanvas211)) {
                    AnimatedVisibility(visible = collapsed) {
                        DetailCompactScore211(match, scores, clockLabel)
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
                            placeholder = {
                                Text(tr(state.lang, "Search markets", "جست‌وجوی بازار"),
                                    fontSize = 12.sp)
                            }, trailingIcon = {
                                IconButton(onClick = { search = ""; searchOpen = false }) {
                                    Icon(Icons.Default.Close, "Close")
                                }
                            })
                    }
                    HorizontalDivider(thickness = 1.dp, color = Color(0xFFD4D7DE))
                }
            }
            if (state.detailError) item(key = "match-market-fetch-error") {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    color = Color(0xFFFFF5DF),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(state.lang,
                            "Latest markets are unavailable. Retry.",
                            "دریافت ضرایب جدید ناموفق بود؛ دوباره تلاش کنید."),
                            color = Color(0xFF71531D), fontSize = 12.sp,
                            modifier = Modifier.weight(1f))
                        TextButton(onClick = { model.openMatch(match.id) }) {
                            Text(tr(state.lang,"Retry","تلاش مجدد"))
                        }
                    }
                }
            }
            if (matches.isEmpty()) item(key = "match-no-markets") {
                Box(Modifier.fillMaxWidth().padding(22.dp),
                    contentAlignment = Alignment.Center) {
                    Text(tr(state.lang,
                        "No markets available for this match.",
                        "هنوز بازاری برای این مسابقه در دسترس نیست."),
                        fontSize = 13.sp, color = matchMuted211, textAlign = TextAlign.Center)
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
            item(key = "match-responsible-note") {
                Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                    ResponsibleNote(state.lang)
                }
            }
        }
    }
}

@Composable
private fun DetailLargeScore211(
    match: Match, score: Pair<String, String>, clock: String,
    fa: Boolean, onOpenStudio: () -> Unit
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 130.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f),
                horizontalAlignment = Alignment.Start) {
                TeamBadge(match.home, 55)
                Spacer(Modifier.height(10.dp))
                Text(match.home.name, fontSize = 14.sp, lineHeight = 19.sp,
                    fontWeight = FontWeight.Bold, color = matchInk211,
                    maxLines = 3, overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Start)
            }
            Column(Modifier.width(86.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(color = Color(0xFF858C9C),
                    shape = RoundedCornerShape(11.dp)) {
                    Text(score.first + ":" + score.second,
                        fontSize = 23.sp, fontWeight = FontWeight.Black,
                        color = Color.White, textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp))
                }
                Spacer(Modifier.height(7.dp))
                Text(if (match.live) clock else if (fa) "شروع نشده" else "Upcoming",
                    fontSize = 11.sp, color = matchMuted211,
                    fontWeight = FontWeight.Medium, textAlign = TextAlign.Center,
                    maxLines = 1)
            }
            Column(Modifier.weight(1f),
                horizontalAlignment = Alignment.End) {
                TeamBadge(match.away, 55)
                Spacer(Modifier.height(10.dp))
                Text(match.away.name, fontSize = 14.sp, lineHeight = 19.sp,
                    fontWeight = FontWeight.Bold, color = matchInk211,
                    maxLines = 3, overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.End)
            }
        }
        if (match.live) {
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Sensors, contentDescription = null,
                    tint = Color(0xFFE11D71), modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(5.dp))
                Text(clock, fontSize = 12.sp, color = matchMuted211)
                Spacer(Modifier.weight(1f))
                Text(if (fa) "نمایش زنده" else "Live match",
                    fontSize = 12.sp, color = matchMuted211,
                    modifier = Modifier.clickable(onClick = onOpenStudio))
            }
            Spacer(Modifier.height(9.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(match.home.name, color = matchInk211,
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(match.away.name, color = matchInk211,
                        fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Column(horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(score.first, color = matchInk211,
                        fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text(score.second, color = matchInk211,
                        fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
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
                Surface(color = Color(0xFFD8DAE2),
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
        color = Color(0xFFDADDE5), shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.padding(3.dp).height(51.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            listOf("score", "tv", "tracker").forEach { entry ->
                val selected = entry == "score"
                val enabled = selected || live
                Surface(modifier = Modifier.weight(1f)
                    .clickable(enabled = enabled && !selected, onClick = onOpenStudio),
                    color = if (selected) Color.White else Color.Transparent,
                    shape = RoundedCornerShape(15.dp),
                    shadowElevation = if (selected) 2.dp else 0.dp) {
                    Box(contentAlignment = Alignment.Center) {
                        when (entry) {
                            "score" -> Text("1:1", fontSize = 13.sp,
                                fontWeight = FontWeight.Black, color = matchInk211)
                            "tv" -> Icon(Icons.Default.Tv, contentDescription = "TV",
                                tint = if (enabled) matchInk211 else Color(0xFFA1A5B1),
                                modifier = Modifier.size(21.dp))
                            else -> Icon(Icons.Default.Sensors,
                                contentDescription = if (fa) "زنده" else "Live",
                                tint = if (enabled) matchInk211 else Color(0xFFA1A5B1),
                                modifier = Modifier.size(21.dp))
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
                    if (isSelected) matchBlue211 else Color(0xFFDBDEE6),
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
        color = Color.White,
        border = if (focused) BorderStroke(2.dp, matchBlue211) else null
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
                    HorizontalDivider(color = Color(0xFFD9DBE2), thickness = 1.dp)
                    val columns = if (market.selections.size == 1) 1
                        else if (market.selections.size == 2) 2 else 3
                    market.selections.chunked(columns).forEach { chunk ->
                        Row(Modifier.fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            chunk.forEach { selection ->
                                DetailOddTile211(match, market, selection, state, model,
                                    Modifier.weight(1f))
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
    state: AppState, model: AppViewModel, modifier: Modifier
) {
    val enabled = match.bettingAvailable && market.available &&
        selection.available && (!match.live || state.liveEnabled)
    val chosen = state.picks.any { it.selectionId == selection.id }
    var oddsCenter by remember(selection.id) { mutableStateOf(Offset.Unspecified) }
    val title = NativeMarketLabels176.selection(state.lang,
        selection.label(false), selection.label(true))
    Surface(
        modifier = modifier.heightIn(min = 75.dp)
            .onGloballyPositioned { oddsCenter = it.boundsInWindow().center }
            .clickable(enabled = enabled) {
                model.togglePick(match, market, selection, oddsCenter.x, oddsCenter.y)
            },
        shape = RoundedCornerShape(14.dp),
        color = if (chosen) Color(0xFFDCEBFF) else matchTile211,
        border = if (chosen) BorderStroke(2.dp, matchBlue211) else null
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 7.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween) {
            Text(title, color = matchInk211, fontSize = 12.sp,
                lineHeight = 16.sp, maxLines = 3,
                textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(9.dp))
            Text(odds(selection.oddsScaled),
                color = if (chosen) matchBlue211 else matchInk211,
                fontSize = 17.sp, fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center, maxLines = 1)
        }
    }
}
