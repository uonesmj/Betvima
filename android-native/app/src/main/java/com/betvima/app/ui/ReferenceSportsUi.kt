package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match
import com.betvima.app.data.Market
import com.betvima.app.data.Pick
import com.betvima.app.data.Selection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast

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
        // Keep a visible tab in place instead of unnecessarily jumping the ribbon.
        // If it is offscreen, scroll directly to it; the trailing inset lets the
        // final tab become completely visible even on a narrow handset.
        if (index >= 0 && tabListState.layoutInfo.visibleItemsInfo.none { it.index == index }) {
            tabListState.animateScrollToItem(index)
        }
    }
    Row(Modifier.fillMaxWidth().background(Palette.paper)
        .padding(start = 6.dp, end = 6.dp, top = 10.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically) {
        LazyRow(Modifier.weight(1f), state = tabListState,
            contentPadding = PaddingValues(end = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(1.dp),
            flingBehavior = rememberPremiumFlingBehavior()) {
            items(tabs, key = { it.first }) { (id, title) ->
                val isActive = active == id
                val pillColor by animateColorAsState(
                    if (isActive) Color.White else Color.Transparent,
                    animationSpec = tween(250), label = "topPillColor")
                val pillScale by animateFloatAsState(
                    if (isActive) 1f else .96f,
                    animationSpec = spring(dampingRatio = Spring.DampingRatioLowBouncy,
                        stiffness = Spring.StiffnessMediumLow),
                    label = "topPillScale")
                Surface(shape = RoundedCornerShape(26.dp),
                    color = pillColor,
                    shadowElevation = if (isActive) 2.dp else 0.dp,
                    modifier = Modifier.graphicsLayer {
                        scaleX = pillScale
                        scaleY = pillScale
                    }.clickable {
                        when (id) {
                            "top" -> model.homeMode(HomeMode.TOP)
                            "live" -> model.tab(Tab.LIVE)
                            "upcoming" -> model.tab(Tab.SPORTS)
                            "bets" -> model.homeMode(HomeMode.TOP_BETS)
                            "esports" -> { model.sport("esports"); model.tab(Tab.SPORTS) }
                        }
                    }) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(Modifier.heightIn(min = 46.dp)
                        .padding(horizontal = 9.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        if (id == "bets") {
                            Surface(color = Color(0xFFFF4F20), shape = RoundedCornerShape(6.dp)) {
                                Text("NEW", modifier = Modifier.padding(horizontal = 5.dp,
                                    vertical = 2.dp), fontWeight = FontWeight.Black,
                                    fontSize = 9.sp, color = Color.White)
                            }
                            Spacer(Modifier.width(5.dp))
                        }
                        Text(title, color = Palette.text, fontWeight =
                            if (active == id) FontWeight.Black else FontWeight.ExtraBold,
                            fontSize = 14.sp, maxLines = 1, softWrap = false)
                    }
                    Box(Modifier.height(2.dp).width(if (isActive) 25.dp else 0.dp)
                        .background(if (isActive) Palette.blue else Color.Transparent,
                            RoundedCornerShape(4.dp)).animateContentSize())
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
        horizontalArrangement = Arrangement.spacedBy(8.dp), flingBehavior = rememberPremiumFlingBehavior()) {
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

/**
 * Home feature logos, each with its own semantic shape and palette.
 * The small corner symbol is part of the emblem, not a clickable status.
 */
internal enum class HomeSectionIdentity { LIVE, TOP_BETS, UPCOMING, OTHER }

internal fun homeSectionIdentity(titleEn: String): HomeSectionIdentity = when (titleEn) {
    "Live" -> HomeSectionIdentity.LIVE
    "Top Bets" -> HomeSectionIdentity.TOP_BETS
    "Upcoming" -> HomeSectionIdentity.UPCOMING
    else -> HomeSectionIdentity.OTHER
}

@Composable
private fun PremiumHomeSectionEmblem(
    identity: HomeSectionIdentity, fallbackIcon: ImageVector, fallbackTint: Color
) {
    val startColor: Color
    val endColor: Color
    val emblem: ImageVector
    val corner: ImageVector
    val cornerColor: Color
    when (identity) {
        HomeSectionIdentity.LIVE -> {
            startColor = Color(0xFF371B35)
            endColor = Color(0xFFEC315D)
            emblem = Icons.Default.Sensors
            corner = Icons.Default.FiberManualRecord
            cornerColor = Color(0xFFFF3D5A)
        }
        HomeSectionIdentity.TOP_BETS -> {
            startColor = Color(0xFF08274D)
            endColor = Palette.blue
            emblem = Icons.Default.EmojiEvents
            corner = Icons.Default.Star
            cornerColor = Color(0xFFFFC653)
        }
        HomeSectionIdentity.UPCOMING -> {
            startColor = Color(0xFF0B3540)
            endColor = Color(0xFF05B982)
            emblem = Icons.Default.EventAvailable
            corner = Icons.Default.AccessTime
            cornerColor = Color(0xFF00D47A)
        }
        HomeSectionIdentity.OTHER -> {
            startColor = Palette.dark
            endColor = fallbackTint
            emblem = fallbackIcon
            corner = Icons.Default.AutoAwesome
            cornerColor = Palette.blue
        }
    }
    Box(Modifier.size(61.dp), contentAlignment = Alignment.Center) {
        Surface(
            modifier = Modifier.size(57.dp),
            shape = RoundedCornerShape(19.dp),
            color = Color.White,
            border = BorderStroke(1.dp, endColor.copy(alpha = .30f)),
            shadowElevation = 4.dp
        ) {
            Box(
                modifier = Modifier.fillMaxSize().padding(4.dp)
                    .background(
                        Brush.linearGradient(listOf(startColor, endColor)),
                        RoundedCornerShape(15.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Canvas(Modifier.fillMaxSize()) {
                    // Subtle etched light and radial highlights add depth without assets or network.
                    drawCircle(
                        Color.White.copy(alpha = .16f), radius = size.minDimension * .41f,
                        center = Offset(size.width * .90f, size.height * .12f)
                    )
                    drawCircle(
                        Color.White.copy(alpha = .065f), radius = size.minDimension * .38f,
                        center = Offset(size.width * .08f, size.height * .94f)
                    )
                    drawLine(
                        Color.White.copy(alpha = .13f),
                        start = Offset(size.width * .16f, size.height * .88f),
                        end = Offset(size.width * .83f, size.height * .18f),
                        strokeWidth = 1.dp.toPx()
                    )
                }
                Icon(
                    imageVector = emblem,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(29.dp)
                )
            }
        }
        Surface(
            modifier = Modifier.align(Alignment.BottomEnd).size(22.dp),
            shape = CircleShape,
            color = cornerColor,
            border = BorderStroke(2.dp, Color.White),
            shadowElevation = 2.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    corner, contentDescription = null, tint = if (
                        identity == HomeSectionIdentity.TOP_BETS ||
                        identity == HomeSectionIdentity.UPCOMING
                    ) Palette.ink else Color.White,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

@Composable
fun ReferenceSectionHeader(lang: Lang, titleEn: String, titleFa: String,
    icon: ImageVector, tint: Color, onAll: () -> Unit
) {
    Row(Modifier.fillMaxWidth().padding(top = 17.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically) {
        PremiumHomeSectionEmblem(homeSectionIdentity(titleEn), icon, tint)
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(tr(lang, titleEn, titleFa), fontWeight = FontWeight.Black,
                fontSize = 20.sp, color = Palette.text,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(5.dp))
            Box(Modifier.width(43.dp).height(3.dp)
                .background(Brush.horizontalGradient(listOf(tint, Palette.green)),
                    RoundedCornerShape(99.dp)))
        }
        Surface(
            color = Palette.blue,
            shape = RoundedCornerShape(13.dp),
            shadowElevation = 3.dp,
            border = BorderStroke(1.dp, Color(0xFF68B6FF)),
            modifier = Modifier.clickable(onClick = onAll)
        ) {
            Row(
                Modifier.heightIn(min = 45.dp)
                    .padding(horizontal = 12.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(tr(lang, "View all", "مشاهده همه"), fontSize = 12.sp,
                    fontWeight = FontWeight.Black, color = Color.White)
                Spacer(Modifier.width(5.dp))
                Icon(Icons.Default.ArrowForward, null,
                    tint = Color.White, modifier = Modifier.size(17.dp))
            }
        }
    }
}

/**
 * Exact order of the 16 user-supplied competition icons. The first five
 * remain leading items while the remaining 11 are revealed by horizontal scroll.
 * These are artwork navigation shortcuts, not a claim of available games.
 */
internal data class HomeCompetitionShortcut(
    val key: String, val title: String, val picture: Int,
    val leagueAliases: List<String>, val goToMarkets: Boolean = false
)

internal val homeCompetitionShortcuts: List<HomeCompetitionShortcut> = listOf(
    HomeCompetitionShortcut("wnba", "WNBA", 0, listOf("wnba")),
    HomeCompetitionShortcut("ufc", "UFC Fight Night", 1,
        listOf("ufc fight night", "ufc")),
    HomeCompetitionShortcut("wta-wuhan", "WTA Wuhan", 2,
        listOf("wta wuhan", "wta 1000 wuhan", "wuhan open")),
    HomeCompetitionShortcut("markets", "Markets", 3, emptyList(), goToMarkets = true),
    HomeCompetitionShortcut("nba-preseason", "NBA Pre-season", 4,
        listOf("nba preseason", "nba pre season")),
    HomeCompetitionShortcut("usa-grand-prix", "USA Grand Prix", 5,
        listOf("usa grand prix", "united states grand prix")),
    HomeCompetitionShortcut("nfl", "NFL", 6, listOf("nfl")),
    HomeCompetitionShortcut("mlb", "MLB", 7, listOf("mlb")),
    HomeCompetitionShortcut("setka", "Setka Cup", 8, listOf("setka cup", "setka")),
    HomeCompetitionShortcut("cyberfifa", "CyberFIFA", 9,
        listOf("cyberfifa", "cyber fifa")),
    HomeCompetitionShortcut("eurocup", "Eurocup", 10,
        listOf("eurocup", "basketball eurocup")),
    HomeCompetitionShortcut("nba-replays", "NBA Replays", 11,
        listOf("nba replays", "nba replay")),
    HomeCompetitionShortcut("euroleague", "Euroleague", 12,
        listOf("euroleague", "euro league basketball")),
    HomeCompetitionShortcut("atp-shanghai", "ATP Shanghai", 13,
        listOf("atp shanghai", "shanghai masters")),
    HomeCompetitionShortcut("conference", "Conference League", 14,
        listOf("conference league", "uefa conference")),
    HomeCompetitionShortcut("europa", "Europa League", 15,
        listOf("europa league", "uefa europa"))
)

private fun normalizeCompetition(value: String): String =
    value.lowercase(java.util.Locale.ROOT)
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()
        .replace(Regex(" +"), " ")

/**
 * Match full, consecutive words. A fixture in "Europa Conference League"
 * must never be mistaken for "Europa League"; likewise NBA preseason is
 * not an ordinary NBA league.
 */
internal fun leagueMatchesShortcut(league: String, shortcut: HomeCompetitionShortcut): Boolean {
    val normalizedLeague = normalizeCompetition(league)
    return shortcut.leagueAliases.any { alias ->
        val normalizedAlias = normalizeCompetition(alias)
        normalizedAlias.isNotBlank() &&
            (" $normalizedLeague ").contains(" $normalizedAlias ")
    }
}

@Composable
fun ReferenceTournamentRibbon(state: AppState, model: AppViewModel) {
    val context = LocalContext.current
    val ribbonState = rememberLazyListState()
    LazyRow(
        Modifier.fillMaxWidth(), state = ribbonState,
        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 11.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        flingBehavior = rememberPremiumFlingBehavior()
    ) {
        items(homeCompetitionShortcuts, key = { it.key }) { shortcut ->
            LeagueBadgeShortcut(
                label = shortcut.title, index = shortcut.picture
            ) {
                if (shortcut.goToMarkets) {
                    model.homeMode(HomeMode.TOP_BETS)
                } else {
                    val future = state.upcoming.firstOrNull {
                        leagueMatchesShortcut(it.league, shortcut)
                    }
                    val live = state.live.firstOrNull {
                        leagueMatchesShortcut(it.league, shortcut)
                    }
                    when {
                        future != null -> model.tournament(
                            future.league + "|" + future.country
                        )
                        live != null -> model.tab(Tab.LIVE)
                        else -> Toast.makeText(
                            context,
                            tr(state.lang,
                                "No currently loaded fixtures for " + shortcut.title,
                                "فعلاً بازی بارگذاری‌شده‌ای برای " + shortcut.title + " وجود ندارد"),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
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
            else -> Color(0xFFF6F8FA)
        }, animationSpec = tween(280), label = "oddsDirectionBackground")
    Surface(
        modifier = modifier.heightIn(min = 51.dp).clickable(enabled = enabled) {
            model.togglePick(match, market, selection)
        },
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(if (selected) 1.5.dp else 1.dp,
            if (selected) Palette.blue else Palette.border),
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
fun ReferenceMatchCarousel(
    matches: List<Match>, state: AppState, model: AppViewModel
) {
    LazyRow(Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(end = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        items(matches.take(10), key = { it.id }) { match ->
            PremiumFixtureCard(match, state, model, Modifier.width(315.dp))
        }
    }
}

/**
 * TOP Bets card hierarchy: shaded competition header + white selection panel.
 * Actual provider markets only; no synthetic bet counts, promotions or winning chances.
 */
@Composable
fun ReferenceTopBetCard(match: Match, state: AppState, model: AppViewModel) {
    PremiumFixtureCard(match, state, model)
}

/** Compact league list rows: no duplicated competition header for every fixture. */
@Composable
fun ReferenceLeagueFixture(match: Match, state: AppState, model: AppViewModel) {
    PremiumFixtureCard(match, state, model)
}
