package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match
import com.betvima.app.data.Market
import com.betvima.app.data.Pick
import com.betvima.app.data.Selection
import androidx.compose.ui.text.style.TextAlign

/**
 * Dense reference-inspired sports layouts using server-owned fixtures and markets.
 * No fabricated counts, live score periods, implied bonuses, or market depth.
 * The reference site is used for layout hierarchy, not copyrighted brand graphics.
 */
@Composable
fun SportsbookTopTabs(state: AppState, model: AppViewModel, onSearch: () -> Unit) {
    val tabs = listOf(
        "top" to tr(state.lang, "Top", "برتر"),
        "live" to tr(state.lang, "Live", "زنده"),
        "upcoming" to tr(state.lang, "Upcoming", "آینده"),
        "bets" to tr(state.lang, "TOP Bets", "شرط‌های برتر"),
        "esports" to tr(state.lang, "Esports", "ورزش الکترونیک")
    )
    val active = when {
        state.tab == Tab.LIVE -> "live"
        state.tab == Tab.SPORTS && state.sport == "esports" -> "esports"
        state.tab == Tab.SPORTS -> "upcoming"
        state.homeMode == HomeMode.TOP_BETS -> "bets"
        else -> "top"
    }
    val tabListState = rememberLazyListState()
    LaunchedEffect(active) {
        val index = tabs.indexOfFirst { it.first == active }
        if (index >= 0) tabListState.animateScrollToItem(index)
    }
    Row(Modifier.fillMaxWidth().background(Palette.paper)
        .padding(start = 9.dp, end = 9.dp, top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically) {
        LazyRow(Modifier.weight(1f), state = tabListState,
            horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            items(tabs, key = { it.first }) { (id, title) ->
                Surface(shape = RoundedCornerShape(26.dp),
                    color = if (active == id) Color.White else Color.Transparent,
                    modifier = Modifier.clickable {
                        when (id) {
                            "top" -> model.homeMode(HomeMode.TOP)
                            "live" -> model.tab(Tab.LIVE)
                            "upcoming" -> model.tab(Tab.SPORTS)
                            "bets" -> model.homeMode(HomeMode.TOP_BETS)
                            "esports" -> { model.sport("esports"); model.tab(Tab.SPORTS) }
                        }
                    }) {
                    Row(Modifier.heightIn(min = 43.dp)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        if (id == "bets") {
                            Surface(color = Color(0xFFFF4F20), shape = RoundedCornerShape(6.dp)) {
                                Text("NEW", modifier = Modifier.padding(horizontal = 5.dp,
                                    vertical = 2.dp), fontWeight = FontWeight.Black,
                                    fontSize = 8.sp, color = Color.White)
                            }
                            Spacer(Modifier.width(5.dp))
                        }
                        Text(title, color = Palette.text, fontWeight =
                            if (active == id) FontWeight.Black else FontWeight.SemiBold,
                            fontSize = 12.sp)
                    }
                }
            }
        }
        IconButton(onClick = onSearch, modifier = Modifier.size(46.dp)) {
            Icon(Icons.Default.Search, tr(state.lang, "Search fixtures", "جست‌وجوی مسابقات"),
                tint = Palette.text, modifier = Modifier.size(24.dp))
        }
    }
}

private data class SportChip(val key: String, val en: String, val fa: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val sportChips = listOf(
    SportChip("top", "Top", "برتر", Icons.Default.Whatshot),
    SportChip("football", "Football", "فوتبال", Icons.Default.SportsSoccer),
    SportChip("tennis", "Tennis", "تنیس", Icons.Default.SportsTennis),
    SportChip("basketball", "Basketball", "بسکتبال", Icons.Default.SportsBasketball),
    SportChip("volleyball", "Volleyball", "والیبال", Icons.Default.SportsVolleyball),
    SportChip("hockey", "Ice hockey", "هاکی", Icons.Default.SportsHockey),
    SportChip("esports", "Esports", "ورزش الکترونیک", Icons.Default.SportsEsports)
)

@Composable
fun ReferenceSportRibbon(state: AppState, model: AppViewModel, live: Boolean = false,
    all: Boolean = false, selectedKey: String? = null,
    onSelect: ((String) -> Unit)? = null) {
    val current = (selectedKey ?: if (all) "top" else state.sport)
        .let { if (it == "all") "top" else it }
    val sportListState = rememberLazyListState()
    LaunchedEffect(current) {
        val index = sportChips.indexOfFirst { it.key == current }
        if (index >= 0) sportListState.animateScrollToItem(index)
    }
    LazyRow(state = sportListState,
        contentPadding = PaddingValues(horizontal = 13.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(sportChips, key = { it.key }) { sport ->
            val active = current == sport.key
            val events = if (live) state.live else state.upcoming
            val loadedCount = if (sport.key == "top") events.size else
                events.count { it.sport == sport.key }
            Surface(shape = RoundedCornerShape(14.dp),
                color = if (active) Palette.blue else Color(0xFFE0E3E9),
                modifier = Modifier.width(124.dp).height(71.dp).clickable {
                    if (onSelect != null) onSelect(sport.key)
                    else if (sport.key == "top") {
                        if (live) model.tab(Tab.LIVE) else model.homeMode(HomeMode.TOP)
                    } else {
                        model.sport(sport.key)
                        if (!live) model.tab(Tab.SPORTS)
                    }
                }) {
                Box(Modifier.fillMaxSize().padding(11.dp)) {
                    Text(tr(state.lang, sport.en, sport.fa),
                        modifier = Modifier.align(Alignment.TopStart),
                        color = if (active) Color.White else Palette.text,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
                    if (loadedCount > 0) Text(loadedCount.toString(),
                        modifier = Modifier.align(Alignment.BottomStart),
                        fontSize = 11.sp, color = if (active) Color.White else Palette.muted)
                    Icon(sport.icon, contentDescription = null,
                        modifier = Modifier.align(Alignment.BottomEnd).size(25.dp),
                        tint = if (active) Color.White else Palette.blue)
                }
            }
        }
    }
}

@Composable
fun ReferenceSectionHeader(lang: Lang, titleEn: String, titleFa: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color,
    onAll: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 15.dp, bottom = 11.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Surface(color = tint, shape = RoundedCornerShape(10.dp)) {
            Icon(icon, null, tint = Color.White,
                modifier = Modifier.padding(9.dp).size(17.dp))
        }
        Spacer(Modifier.width(10.dp))
        Text(tr(lang, titleEn, titleFa), fontWeight = FontWeight.Black,
            fontSize = 18.sp, color = Palette.text, modifier = Modifier.weight(1f))
        Surface(color = Color(0xFFE1E4EB), shape = RoundedCornerShape(18.dp),
            modifier = Modifier.clickable(onClick = onAll)) {
            Row(Modifier.heightIn(min = 42.dp)
                .padding(horizontal = 15.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(tr(lang, "All", "همه"), fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold, color = Palette.text)
                Icon(Icons.Default.ChevronRight, null,
                    tint = Palette.muted, modifier = Modifier.size(19.dp))
            }
        }
    }
}

/** Circular competition shortcuts, populated exclusively from returned catalogue. */
@Composable
fun ReferenceTournamentRibbon(state: AppState, model: AppViewModel) {
    val competitions = (state.live + state.upcoming)
        .filter { it.league.isNotBlank() && it.league != "Football" }
        .distinctBy { it.league + "|" + it.country }
        .take(7)
    LazyRow(Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "top-bets") {
            TournamentShortcut(
                label = tr(state.lang, "TOP Bets", "شرط‌های برتر"),
                logo = null,
                icon = Icons.Default.Whatshot, active = true
            ) { model.homeMode(HomeMode.TOP_BETS) }
        }
        items(competitions, key = { it.league + "|" + it.country }) { competition ->
            TournamentShortcut(
                label = competition.league, logo = competition.leagueLogo,
                icon = Icons.Default.EmojiEvents, active = false
            ) { model.tournament(competition.league + "|" + competition.country) }
        }
    }
}

@Composable
private fun TournamentShortcut(
    label: String, logo: String?,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean, onClick: () -> Unit
) {
    Column(Modifier.width(79.dp).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(
            shape = CircleShape, color = Color(0xFF161F2E),
            border = BorderStroke(if (active) 2.dp else 1.dp,
                if (active) Palette.blue else Color(0xFFDADEE6)),
            modifier = Modifier.size(74.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                val image = logo?.takeIf { it.startsWith("https://") }
                if (image != null) {
                    AsyncImage(model = image, contentDescription = label,
                        modifier = Modifier.fillMaxSize().padding(9.dp))
                } else {
                    Icon(icon, contentDescription = null,
                        modifier = Modifier.size(36.dp),
                        tint = if (active) Palette.green else Color.White)
                }
            }
        }
        Spacer(Modifier.height(7.dp))
        Text(label, fontWeight = FontWeight.Bold,
            fontSize = 11.sp, lineHeight = 14.sp, maxLines = 2,
            textAlign = TextAlign.Center, color = Palette.text,
            overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ReferenceCompactOdd(
    match: Match, market: Market, selection: Selection,
    state: AppState, model: AppViewModel, modifier: Modifier = Modifier
) {
    val enabled = match.bettingAvailable && market.available &&
        selection.available && (!match.live || state.liveEnabled)
    val selected = state.picks.any { it.selectionId == selection.id }
    val background by animateColorAsState(
        targetValue = when {
            selected -> Color(0xFFDBE9FC)
            selection.movement == "UP" && enabled -> Color(0xFFE4F8EE)
            selection.movement == "DOWN" && enabled -> Color(0xFFFFE7E8)
            else -> Color(0xFFEDEFF3)
        }, animationSpec = tween(280), label = "oddsDirectionBackground")
    Surface(
        modifier = modifier.heightIn(min = 51.dp).clickable(enabled = enabled) {
            model.togglePick(match, market, selection)
        },
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(if (selected) 1.5.dp else 0.dp,
            if (selected) Palette.blue else Color.Transparent),
        color = background
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text(selection.label(state.lang == Lang.FA),
                fontSize = 10.sp, color = Palette.text,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f))
            Spacer(Modifier.width(3.dp))
            if (!enabled) Icon(Icons.Default.Lock, null,
                modifier = Modifier.size(14.dp), tint = Palette.muted)
            else AnimatedContent(
                targetState = selection.oddsScaled, label = "livePrice",
                transitionSpec = { fadeIn(tween(160)).togetherWith(fadeOut(tween(120))) }
            ) { scaled ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(com.betvima.app.data.odds(scaled),
                        color = if (selected) Palette.blue else Palette.text,
                        fontSize = 15.sp, fontWeight = FontWeight.Black)
                    if (selection.movement == "UP" || selection.movement == "DOWN") {
                        Icon(if (selection.movement == "UP") Icons.Default.ArrowUpward
                            else Icons.Default.ArrowDownward,
                            null, tint = if (selection.movement == "UP") Palette.green
                                else Palette.red,
                            modifier = Modifier.size(12.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferenceCarouselCard(
    match: Match, state: AppState, model: AppViewModel
) {
    val market = match.featured
    Surface(color = Color.White, shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color(0xFFE1E4EB)),
        modifier = Modifier.width(316.dp), shadowElevation = 1.dp) {
        Column(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().clickable { model.openMatch(match.id) }
                .padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(9.dp),
                    color = Color(0xFFEDEFF3)) {
                    Box(Modifier.size(34.dp), contentAlignment = Alignment.Center) {
                        val image = match.leagueLogo?.takeIf { it.startsWith("https://") }
                        if (image != null) AsyncImage(model = image,
                            contentDescription = null, modifier = Modifier.size(26.dp))
                        else Icon(Icons.Default.EmojiEvents, null,
                            modifier = Modifier.size(20.dp), tint = Palette.blue)
                    }
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(match.league, fontWeight = FontWeight.Black,
                        fontSize = 12.sp, color = Palette.text, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Text(match.sport.replace("-", " "),
                        color = Palette.muted, fontSize = 10.sp)
                }
            }
            HorizontalDivider(thickness = .6.dp,
                color = Color(0xFFE6E8EE))
            Column(Modifier.padding(horizontal = 13.dp, vertical = 13.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (match.live) SmallPill(
                        tr(state.lang, "LIVE", "زنده") +
                            " " + (match.minute?.toString()?.plus("′") ?: "•"),
                        Color(0xFFFFEAF3), Color(0xFFE60073))
                    else SmallPill(match.starts.take(16).replace("T", " • "),
                        Color(0xFFF1F3F6), Palette.text)
                    Spacer(Modifier.weight(1f))
                    if (match.marketsCount > 0) SmallPill(
                        "+${match.marketsCount}", Palette.paper, Palette.muted)
                }
                listOf(match.home to match.homeScore, match.away to match.awayScore)
                    .forEach { (team, score) ->
                        Row(Modifier.fillMaxWidth().clickable {
                            model.openMatch(match.id)
                        }, verticalAlignment = Alignment.CenterVertically) {
                            TeamBadge(team, 29)
                            Spacer(Modifier.width(8.dp))
                            Text(team.name, fontWeight = FontWeight.Bold,
                                fontSize = 13.sp, color = Palette.text,
                                modifier = Modifier.weight(1f),
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (score != null) Surface(
                                color = Color(0xFFEDEFF3),
                                shape = RoundedCornerShape(7.dp)
                            ) {
                                Text(score.toString(), color = Palette.text,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    fontSize = 12.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                Text(market?.label(state.lang == Lang.FA) ?: tr(state.lang,
                    "Odds unavailable", "ضریب موجود نیست"),
                    fontSize = 11.sp, color = Palette.muted, maxLines = 1)
                if (market != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        market.selections.take(2).forEach { selection ->
                            ReferenceCompactOdd(match, market, selection, state, model,
                                Modifier.weight(1f))
                        }
                        Surface(color = Color(0xFFEDEFF3),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.width(48.dp)
                                .heightIn(min = 51.dp)
                                .clickable { model.openMatch(match.id) }) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(if (match.marketsCount > 0)
                                        "+${match.marketsCount}" else "›",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp, color = Palette.text)
                            }
                        }
                    }
                } else {
                    Text(tr(state.lang, "Provider has no open market",
                        "بازار بازی از منبع داده دریافت نشده است"),
                        fontSize = 10.sp, color = Palette.muted)
                }
            }
        }
    }
}

@Composable
fun ReferenceMatchCarousel(
    matches: List<Match>, state: AppState, model: AppViewModel
) {
    LazyRow(Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(end = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items(matches.take(10), key = { it.id }) { match ->
            ReferenceCarouselCard(match, state, model)
        }
    }
}

/**
 * TOP Bets card hierarchy: shaded competition header + white selection panel.
 * Actual provider markets only; no synthetic bet counts, promotions or winning chances.
 */
@Composable
fun ReferenceTopBetCard(match: Match, state: AppState, model: AppViewModel) {
    val market = match.featured
    val selection = market?.selections?.firstOrNull { it.available }
    val selected = selection != null &&
        state.picks.any { it.selectionId == selection.id }
    Surface(
        color = Color(0xFFE0E3E9),
        shape = RoundedCornerShape(19.dp),
        border = BorderStroke(
            if (selected) 2.dp else 1.dp,
            if (selected) Palette.blue else Color(0xFFE1E4EA)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            Row(Modifier.fillMaxWidth().clickable { model.openMatch(match.id) }
                .padding(start = 12.dp, end = 9.dp, top = 10.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                val image = match.leagueLogo?.takeIf { it.startsWith("https://") }
                if (image != null) AsyncImage(model = image,
                    contentDescription = null, modifier = Modifier.size(29.dp))
                else Icon(Icons.Default.EmojiEvents, null, tint = Palette.blue,
                    modifier = Modifier.size(25.dp))
                Spacer(Modifier.width(9.dp))
                Text(match.league, color = Palette.muted, fontSize = 12.sp,
                    modifier = Modifier.weight(1f), maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                Surface(color = Palette.blue, shape = CircleShape,
                    modifier = Modifier.size(37.dp).clickable {
                        model.openMatch(match.id)
                    }) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Add,
                            tr(state.lang, "More markets", "بازارهای بیشتر"),
                            tint = Color.White, modifier = Modifier.size(21.dp))
                    }
                }
            }
            Surface(color = Color.White, shape = RoundedCornerShape(17.dp),
                modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Surface(color = Color.White,
                        border = BorderStroke(1.dp, Color(0xFFE4E6EB)),
                        shape = RoundedCornerShape(19.dp)) {
                        Text(match.starts.take(16).replace("T", " • "),
                            modifier = Modifier.padding(horizontal = 13.dp, vertical = 7.dp),
                            color = Palette.text, fontSize = 11.sp,
                            fontWeight = FontWeight.Bold)
                    }
                    Row(Modifier.fillMaxWidth().clickable { model.openMatch(match.id) },
                        verticalAlignment = Alignment.CenterVertically) {
                        TeamBadge(match.home, 28)
                        Spacer(Modifier.width(7.dp))
                        Text(match.home.name, color = Palette.text,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp, modifier = Modifier.weight(1f),
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("–", color = Palette.muted, fontSize = 20.sp)
                        Spacer(Modifier.width(5.dp))
                        Text(match.away.name, color = Palette.text,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp, modifier = Modifier.weight(1f),
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.End)
                        Spacer(Modifier.width(7.dp))
                        TeamBadge(match.away, 28)
                    }
                    HorizontalDivider(color = Color(0xFFE8E9ED), thickness = .6.dp)
                    Row(Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (market != null && selection != null)
                                market.label(state.lang == Lang.FA) +
                                    " · " + selection.label(state.lang == Lang.FA)
                            else tr(state.lang, "Market unavailable", "بازار در دسترس نیست"),
                            modifier = Modifier.weight(1f), fontSize = 11.sp,
                            color = Palette.text, fontWeight = FontWeight.Bold,
                            maxLines = 2
                        )
                        Spacer(Modifier.width(7.dp))
                        Surface(
                            color = if (selection != null && selected) Palette.green
                                else Palette.blue,
                            shape = RoundedCornerShape(9.dp),
                            modifier = Modifier.heightIn(min = 38.dp).clickable(
                                enabled = market != null && selection != null &&
                                    market.available && match.bettingAvailable &&
                                    (!match.live || state.liveEnabled)
                            ) {
                                if (market != null && selection != null)
                                    model.togglePick(match, market, selection)
                            }
                        ) {
                            Text(if (selection == null) "—" else
                                com.betvima.app.data.odds(selection.oddsScaled),
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                                fontSize = 15.sp, fontWeight = FontWeight.Black,
                                color = Color.White)
                        }
                    }
                }
            }
        }
    }
}

/** Compact league list rows: no duplicated competition header for every fixture. */
@Composable
fun ReferenceLeagueFixture(match: Match, state: AppState, model: AppViewModel) {
    val market = match.featured
    Column(Modifier.fillMaxWidth().background(Color.White)
        .clickable { model.openMatch(match.id) }
        .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (match.live) SmallPill(tr(state.lang, "LIVE", "زنده") +
                "  " + (match.minute?.toString() ?: "•") + "′",
                Color(0xFFFFE9F1), Palette.red)
            else SmallPill(match.starts.take(16).replace("T", " • "),
                Palette.paper, Palette.muted)
            Spacer(Modifier.weight(1f))
            if (match.marketsCount > 0) Text("+${match.marketsCount}",
                color = Palette.blue, fontSize = 11.sp, fontWeight = FontWeight.Black)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TeamBadge(match.home, 24)
                    Spacer(Modifier.width(8.dp))
                    Text(match.home.name, color = Palette.text,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        modifier = Modifier.weight(1f), maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    if (match.homeScore != null) Text(match.homeScore.toString(),
                        color = Palette.text, fontWeight = FontWeight.Black)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TeamBadge(match.away, 24)
                    Spacer(Modifier.width(8.dp))
                    Text(match.away.name, color = Palette.text,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        modifier = Modifier.weight(1f), maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    if (match.awayScore != null) Text(match.awayScore.toString(),
                        color = Palette.text, fontWeight = FontWeight.Black)
                }
            }
            Spacer(Modifier.width(12.dp))
            Icon(Icons.Default.ChevronRight, null, tint = Palette.muted,
                modifier = Modifier.size(22.dp))
        }
        if (market != null) {
            Text(market.label(state.lang == Lang.FA), color = Palette.muted,
                fontSize = 11.sp, maxLines = 1)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                market.selections.take(3).forEach { selection ->
                    Box(Modifier.weight(1f)) {
                        ReferenceCompactOdd(match, market, selection, state, model,
                            Modifier.fillMaxWidth())
                    }
                }
                Surface(color = Palette.paper, shape = RoundedCornerShape(11.dp),
                    modifier = Modifier.width(45.dp).heightIn(min = 57.dp)
                        .clickable { model.openMatch(match.id) }) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(if (match.marketsCount > 0) "+${match.marketsCount}" else "›",
                            fontWeight = FontWeight.Black, fontSize = 12.sp,
                            color = Palette.text)
                    }
                }
            }
        } else Text(tr(state.lang, "No available odds", "ضریبی موجود نیست"),
            fontSize = 11.sp, color = Palette.muted)
    }
}
