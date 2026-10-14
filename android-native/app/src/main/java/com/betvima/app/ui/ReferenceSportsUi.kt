package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
    Row(Modifier.fillMaxWidth().background(Palette.paper)
        .padding(start = 9.dp, end = 9.dp, top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically) {
        LazyRow(Modifier.weight(1f),
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
    LazyRow(contentPadding = PaddingValues(horizontal = 13.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(sportChips, key = { it.key }) { sport ->
            val active = current == sport.key
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

@Composable
fun ReferenceMatchCarousel(
    matches: List<Match>, state: AppState, model: AppViewModel
) {
    LazyRow(Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(end = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items(matches.take(10), key = { it.id }) { match ->
            Box(Modifier.width(306.dp)) {
                MatchTile(match, state.lang, state.liveEnabled, state.picks,
                    onOpen = { model.openMatch(match.id) },
                    onPick = { market, selection -> model.togglePick(match, market, selection) })
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
                        OddsChoice(match, market, selection, state.liveEnabled,
                            state.picks.any { it.selectionId == selection.id }) {
                            model.togglePick(match, market, selection)
                        }
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
