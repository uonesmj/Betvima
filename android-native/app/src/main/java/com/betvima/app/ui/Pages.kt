package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalDensity
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import coil.compose.AsyncImage
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip

private val sports = liveSportKeys88
private fun sportName(s: String) = s.replace("-", " ").replaceFirstChar { it.uppercase() }

private fun sportIcon(sport: String): androidx.compose.ui.graphics.vector.ImageVector = when (sport) {
    "football" -> Icons.Default.SportsSoccer
    "basketball" -> Icons.Default.SportsBasketball
    "tennis", "table-tennis" -> Icons.Default.SportsTennis
    "volleyball" -> Icons.Default.SportsVolleyball
    "hockey" -> Icons.Default.SportsHockey
    "handball" -> Icons.Default.SportsHandball
    "american-football" -> Icons.Default.SportsFootball
    "cricket" -> Icons.Default.SportsCricket
    "mma", "boxing" -> Icons.Default.SportsMma
    "baseball" -> Icons.Default.SportsBaseball
    "esports" -> Icons.Default.VideogameAsset
    else -> Icons.Default.EmojiEvents
}

@Composable
fun SportsRibbon(selected: String, lang: Lang, showEsports: Boolean = true,
    onChange: (String) -> Unit) {
    val visibleSports = if (showEsports) sports else sports.filterNot { it == "esports" }
    LazyRow(contentPadding = PaddingValues(vertical = 5.dp, horizontal = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        items(visibleSports, key = { it }) { sport ->
            val active = selected == sport
            val label = if (lang == Lang.FA) when (sport) {
                "football" -> "فوتبال"; "basketball" -> "بسکتبال"; "tennis" -> "تنیس"
                "volleyball" -> "والیبال"; "hockey" -> "هاکی روی یخ"
                "handball" -> "هندبال"; "american-football" -> "فوتبال آمریکایی"
                "cricket" -> "کریکت"; "mma" -> "هنرهای رزمی"; "boxing" -> "بوکس"
                "table-tennis" -> "پینگ‌پنگ"; "baseball" -> "بیسبال"
                "esports" -> "ورزش الکترونیک"; "other" -> "سایر ورزش‌ها"
                else -> sportName(sport)
            } else sportName(sport)
            Column(Modifier.width(71.dp).clickable { onChange(sport) }
                .padding(vertical = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(shape = CircleShape,
                    color = if (active) Palette.green else Color.White,
                    border = BorderStroke(1.dp, if (active) Palette.green else Palette.border),
                    shadowElevation = if (active) 3.dp else 0.dp) {
                    Box(Modifier.size(53.dp), contentAlignment = Alignment.Center) {
                        Icon(sportIcon(sport), contentDescription = label,
                            modifier = Modifier.size(25.dp),
                            tint = if (active) Palette.ink else Palette.blue)
                    }
                }
                Text(label, fontSize = 10.sp, fontWeight =
                    if (active) FontWeight.ExtraBold else FontWeight.Medium,
                    color = if (active) Palette.ink else Palette.muted,
                    modifier = Modifier.padding(top = 7.dp),
                    maxLines = 1)
            }
        }
    }
}

/**
 * Observe the actual footer item in the list viewport rather than relying on
 * estimated scroll percentages. This modifies only the floating slip visibility.
 */
internal fun footerCoversFloatingSlip(
    footerTopPx: Int?, viewportEndPx: Int, clearancePx: Int
): Boolean = footerTopPx != null && footerTopPx <= viewportEndPx - clearancePx

@Composable
private fun ObserveFooterForFloatingSlip(
    listState: LazyListState, footerKey: String, onOverlapChanged: (Boolean) -> Unit
) {
    val updatedCallback by rememberUpdatedState(onOverlapChanged)
    val clearancePx = with(LocalDensity.current) { 78.dp.roundToPx() }
    LaunchedEffect(listState, footerKey, clearancePx) {
        snapshotFlow {
            val layout = listState.layoutInfo
            val footerTop = layout.visibleItemsInfo.firstOrNull { it.key == footerKey }?.offset
            footerCoversFloatingSlip(footerTop, layout.viewportEndOffset, clearancePx)
        }.distinctUntilChanged().collect { updatedCallback(it) }
    }
}

@Composable
fun HomePage(state: AppState, model: AppViewModel, onSearch: () -> Unit,
    onFooterOverlapChanged: (Boolean) -> Unit = {}) {
    val footerListState = rememberLazyListState()
    val footerScope = rememberCoroutineScope()
    ObserveFooterForFloatingSlip(footerListState, "premium-home-footer", onFooterOverlapChanged)
    // Quotes from BetsAPI are displayed as previews, but remain deliberately
    // non-wagerable. Ranking must not require bettingAvailable/selection.available:
    // these flags are false for *every* external bookmaker preview and previously
    // forced Top Bets to be empty even when real prices were present.
    val featured = remember(state.live, state.upcoming) {
        TopBetsRanking121.ranked(state.live, state.upcoming)
    }
    // If all provider headline prices are unavailable, do not pretend there
    // are zero fixtures. Offer actual fixtures with locked odds, clearly
    // labelled as unpriced previews, never as confirmed Top Bets.
    val unpricedPreviews = remember(state.live, state.upcoming, featured) {
        if (featured.isNotEmpty()) emptyList() else
            (state.live + state.upcoming).distinctBy { it.id }
                .sortedWith(compareByDescending<Match> { it.marketsCount }
                    .thenBy { it.starts }.thenBy { it.id })
                .take(12)
    }
    val topCards = if (featured.isNotEmpty()) featured else unpricedPreviews
    CompositionLocalProvider(LocalDarkHome provides true) {
    LazyColumn(state = footerListState,
        modifier = Modifier.fillMaxSize().background(DarkHomePalette.canvas),
        contentPadding = PaddingValues(bottom = 0.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        item(key = "sportsbook-tabs", contentType = "tabs") { SportsbookTopTabs(state, model, onSearch) }
        item(key = "home-ribbon", contentType = "ribbon") { ReferenceTournamentRibbon(state, model) }
        if (state.homeMode == HomeMode.TOP_BETS) {
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Top Bets", "شرط‌های برتر",
                        Icons.Default.Whatshot, Palette.blue) { model.tab(Tab.SPORTS) }
                }
            }
            if (topCards.isEmpty() && (state.upcomingLoading || state.liveLoading)) {
                items(2) { FixtureSkeleton(Modifier.padding(horizontal = 15.dp)) }
            } else if (topCards.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 15.dp)) {
                        EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                            tr(state.lang, if (state.liveError || state.upcomingError)
                                "Provider connection failed. Refresh when service resumes."
                                else "No verified odds were returned by the provider.",
                                if (state.liveError || state.upcomingError)
                                "اتصال منبع مسابقات ناموفق بود؛ بعداً دوباره تلاش کنید."
                                else "منبع داده فعلاً هیچ ضریب تأییدشده‌ای برنگردانده است.")) {
                            model.refreshAll()
                        }
                    }
                }
            } else {
                if (featured.isEmpty()) item {
                    Box(Modifier.padding(horizontal = 15.dp, vertical = 3.dp)) {
                        BvInformationStrip(tr(state.lang,
                            "Current match listings only — market odds are not available from the provider.",
                            "فقط فهرست مسابقات موجود است؛ ضرایب فعلی از منبع داده دریافت نشده‌اند."),
                            Icons.Default.Info, accent = Palette.blue)
                    }
                }
                items(topCards.take(25), key = { "top-" + it.id }, contentType = { "match" }) { match ->
                    Box(Modifier.padding(horizontal = 15.dp, vertical = 3.dp)) {
                        ReferenceTopBetCard(match, state, model)
                    }
                }
            }
        } else {
            // Exactly three editorial home sections, aligned with the reference site.
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Live", "زنده",
                        Icons.Default.Sensors, Color(0xFFE82465)) { model.tab(Tab.LIVE) }
                    if (state.live.isNotEmpty()) ReferenceMatchCarousel(state.live, state, model)
                    else if (state.liveLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(
                        tr(state.lang, if (state.liveError) "Live feed unavailable"
                            else "No live matches",
                            if (state.liveError) "داده زنده در دسترس نیست"
                            else "مسابقه زنده‌ای موجود نیست"),
                        tr(state.lang, if (state.liveError)
                            "The BetsAPI provider did not return a usable live feed."
                            else "Check again as events begin.",
                            if (state.liveError)
                            "منبع BetsAPI فهرست زنده قابل استفاده‌ای برنگردانده است."
                            else "با شروع مسابقات دوباره بررسی کنید.")) { model.refreshLive() }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Top Bets", "شرط‌های برتر",
                        Icons.Default.Whatshot, Palette.blue) {
                        model.homeMode(HomeMode.TOP_BETS)
                    }
                    if (topCards.isNotEmpty()) {
                        if (featured.isEmpty()) Text(tr(state.lang,
                            "Market quotes temporarily unavailable — showing real fixtures only.",
                            "ضرایب فعلاً موجود نیستند؛ فقط مسابقات واقعی نمایش داده می‌شوند."),
                            color = DarkHomePalette.muted, fontSize = 11.sp,
                            modifier = Modifier.padding(bottom = 6.dp))
                        ReferenceMatchCarousel(topCards, state, model)
                    }
                    else if (state.upcomingLoading || state.liveLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                        tr(state.lang, if (state.liveError || state.upcomingError)
                            "Provider feed is unavailable; please retry."
                            else "Markets appear when confirmed by the provider.",
                            if (state.liveError || state.upcomingError)
                            "منبع مسابقات در دسترس نیست؛ مجدداً تلاش کنید."
                            else "بازارها پس از تأیید منبع داده نمایش داده می‌شوند.")) {
                        model.refreshAll()
                    }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Upcoming", "آینده",
                        Icons.Default.Event, Palette.green) { model.tab(Tab.SPORTS) }
                    if (state.upcoming.isNotEmpty())
                        ReferenceMatchCarousel(state.upcoming, state, model)
                    else if (state.upcomingLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang,
                        if (state.upcomingError) "Upcoming feed unavailable"
                            else "No upcoming fixtures",
                        if (state.upcomingError) "فهرست آینده در دسترس نیست"
                            else "مسابقه آینده‌ای موجود نیست"),
                        tr(state.lang, if (state.upcomingError)
                            "Provider feed is unavailable; please retry."
                            else "Upcoming fixtures load from the live catalogue.",
                            if (state.upcomingError)
                            "منبع مسابقات در دسترس نیست؛ دوباره تلاش کنید."
                            else "مسابقات آینده از فهرست واقعی دریافت می‌شوند.")) {
                        model.refreshUpcoming()
                    }
                }
            }
            item(key = "home-casino95", contentType = "casino") {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Casino", "کازینو",
                        Icons.Default.Casino, Palette.blue) {
                        model.feature(Feature.CASINO)
                    }
                    CasinoHomeCarousel95(state.lang, model) {
                        model.feature(Feature.CASINO)
                    }
                }
            }
        }
        item(key = "premium-home-footer", contentType = "footer") {
            PremiumAppFooter(state, model) {
                footerScope.launch { footerListState.smoothBackToTop() }
            }
        }
    }
    }
}

@Composable
fun CatalogPage(state: AppState, model: AppViewModel, live: Boolean,
    onSearch: () -> Unit, onFooterOverlapChanged: (Boolean) -> Unit = {}) {
    val footerListState = rememberLazyListState()
    val footerScope = rememberCoroutineScope()
    ObserveFooterForFloatingSlip(footerListState, "premium-catalog-footer", onFooterOverlapChanged)
    var liveSport by rememberSaveable { mutableStateOf("top") }
    // All 46 (or any current API count) fixtures are initially visible:
    // no silently closed league can inflate the counter without a card.
    var collapsedLeagues by rememberSaveable(live) { mutableStateOf(emptyList<String>()) }
    LaunchedEffect(live, liveSport, state.sport) { collapsedLeagues = emptyList() }
    var selectedLeague by rememberSaveable(live, liveSport, state.sport, state.tournamentLeague) {
        mutableStateOf(if (live) "" else state.tournamentLeague)
    }
    var tournamentOpen by remember { mutableStateOf(false) }
    var selectedHours by rememberSaveable { mutableStateOf<Int?>(null) }
    val allMatches = if (live) state.live else state.upcoming
    // Remember catalogue transformations; state can update independently from
    // a user's scroll (balance, notifications, slip picks and live polling).
    val matches = remember(allMatches, live, liveSport) {
        if (live) liveSportMatches88(allMatches, liveSport) else allMatches
    }
    val scopedMatches = remember(matches, live, selectedHours) {
        if (live) matches else upcomingWithinHours(matches, selectedHours, java.time.Instant.now())
    }
    val groups = remember(scopedMatches, live) {
        scopedMatches.groupBy { catalogueGroupKey88(it, live) }
    }
    // Old Home shortcut deep links used "league|country"; resolve only by
    // exact equality, never loose text matching across league names.
    val selectedKey = remember(groups, selectedLeague) {
        if (selectedLeague.isBlank()) "" else if (groups.containsKey(selectedLeague))
            selectedLeague
        else groups.entries.firstOrNull { (_, fixtures) ->
            fixtures.firstOrNull()?.let { match ->
                match.league + "|" + match.country == selectedLeague
            } == true
        }?.key ?: ""
    }
    val visibleGroups = remember(groups, selectedKey) {
        if (selectedKey.isBlank()) groups else
            groups.filterKeys { it == selectedKey }
    }
    val displayedCount = visibleFixtureCount88(visibleGroups, collapsedLeagues)
    val totalCount = visibleGroups.values.sumOf { it.size }

    CompositionLocalProvider(LocalDarkHome provides true) {
    LazyColumn(state = footerListState,
        modifier = Modifier.fillMaxSize().background(DarkHomePalette.canvas),
        contentPadding = PaddingValues(bottom = 0.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        item { SportsbookTopTabs(state, model, onSearch) }
        item {
            ReferenceSportRibbon(state, model, live = live,
                selectedKey = if (live) liveSport else state.sport,
                onSelect = { key ->
                    if (live) liveSport = key
                    else model.sport(if (key == "top") "all" else key)
                })
        }
        if (live && totalCount > 0) item(key = "live-counts", contentType = "live-counts") {
            Row(Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(totalCount.toString() + " " +
                        tr(state.lang, "live fixtures loaded", "مسابقه زنده دریافت شده"),
                        color = DarkHomePalette.ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(displayedCount.toString() + " / " + totalCount.toString() + " " +
                        tr(state.lang, "fixtures expanded", "مسابقه باز و قابل مشاهده"),
                        color = DarkHomePalette.muted, fontSize = 10.sp)
                }
                TextButton(onClick = {
                    collapsedLeagues = if (displayedCount == totalCount)
                        visibleGroups.keys.toList() else emptyList()
                }) {
                    Text(if (displayedCount == totalCount)
                        tr(state.lang, "Collapse all", "بستن همه") else
                        tr(state.lang, "Show all", "نمایش همه"),
                        color = Palette.blue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (!live) item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = DarkHomePalette.panel,
                    shape = RoundedCornerShape(17.dp),
                    border = BorderStroke(1.dp, DarkHomePalette.outline),
                    shadowElevation = 0.dp,
                    modifier = Modifier.weight(1f).clickable { tournamentOpen = true }
                ) {
                    Row(Modifier.heightIn(min = 54.dp)
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = DarkHomePalette.soft, shape = RoundedCornerShape(11.dp)) {
                            Icon(Icons.Default.EmojiEvents, null, tint = Palette.blue,
                                modifier = Modifier.padding(9.dp).size(20.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(state.lang, "TOURNAMENTS", "رقابت‌ها"),
                                fontSize = 9.sp, fontWeight = FontWeight.Black,
                                color = DarkHomePalette.muted)
                            Text(if (selectedKey.isBlank())
                                tr(state.lang, "Choose a tournament", "انتخاب لیگ")
                                else groups[selectedKey]?.firstOrNull()?.league.orEmpty(),
                                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                                color = DarkHomePalette.ink, maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = Palette.blue)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Surface(color = DarkHomePalette.panel, shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, DarkHomePalette.outline),
                    modifier = Modifier.size(54.dp).clickable {
                        if (live) model.refreshLive() else model.refreshUpcoming()
                    }) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Refresh,
                            tr(state.lang, "Refresh", "تازه‌سازی"), tint = Palette.blue)
                    }
                }
            }
        }
        if (live && !state.liveEnabled) item {
            Box(Modifier.padding(horizontal = 15.dp)) {
                BvInformationStrip(tr(state.lang,
                    "Live betting is currently paused. Last confirmed scores remain visible.",
                    "شرط زنده متوقف است؛ آخرین نتایج تأییدشده نمایش داده می‌شوند."),
                    Icons.Default.Info, accent = Palette.blue)
            }
        }
        if ((if (live) state.liveLoading else state.upcomingLoading) &&
            allMatches.isEmpty()) {
            items(2, key = { "skeleton-$it" }) {
                FixtureSkeleton(Modifier.padding(horizontal = 13.dp, vertical = 3.dp))
            }
        }
        if (!(if (live) state.liveLoading else state.upcomingLoading) &&
            visibleGroups.isEmpty()) item {
            Box(Modifier.padding(15.dp)) {
                EmptyPanel(tr(state.lang, "No matches for this filter", "مسابقه‌ای یافت نشد"),
                    tr(state.lang,
                        "Try another sport or competition and refresh.",
                        "رشته یا لیگ دیگری را انتخاب و تازه‌سازی کنید.")) {
                    if (live) { liveSport = "top"; model.refreshLive() }
                    else { selectedLeague = ""; model.refreshUpcoming() }
                }
            }
        }
        visibleGroups.entries.forEachIndexed { index, group ->
            item(key = "league-"+group.key, contentType = "league") {
                Box(Modifier.padding(horizontal = 13.dp)) {
                    if (live) {
                        LeagueSection(group.key, group.value,
                            expanded = group.key !in collapsedLeagues,
                            onToggle = {
                                collapsedLeagues = if (group.key in collapsedLeagues)
                                    collapsedLeagues - group.key else collapsedLeagues + group.key
                            }, state = state, model = model)
                    } else {
                        // Preserve the old upcoming behavior: first league open,
                        // other leagues user-expandable. The Live fix is isolated.
                        var upcomingExpanded by rememberSaveable(group.key) {
                            mutableStateOf(index == 0)
                        }
                        LeagueSection(group.key, group.value, expanded = upcomingExpanded,
                            onToggle = { upcomingExpanded = !upcomingExpanded },
                            state = state, model = model)
                    }
                }
            }
        }
        item(key = "premium-catalog-footer", contentType = "footer") {
            PremiumAppFooter(state, model) {
                footerScope.launch { footerListState.smoothBackToTop() }
            }
        }
    }
    if (tournamentOpen) PremiumTournamentSheet(
        lang = state.lang,
        matches = matches,
        activeSport = state.sport,
        hours = selectedHours,
        onHoursChange = { selectedHours = it; selectedLeague = "" },
        onSportChange = { model.sport(it); selectedLeague = "" },
        onSelect = { selectedLeague = it },
        onDismiss = { tournamentOpen = false }
    )
    }
}

@Composable
private fun LeagueSection(key: String, matches: List<Match>, expanded: Boolean,
    onToggle: () -> Unit, state: AppState, model: AppViewModel) {
    Surface(shape = RoundedCornerShape(23.dp), color = DarkHomePalette.panel,
        border = BorderStroke(1.dp, DarkHomePalette.outline),
        shadowElevation = 0.dp,
        modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onToggle)
                .padding(horizontal = 13.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                LeagueIdentityBadge(matches.first(), size = 43)
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(matches.first().league, color = DarkHomePalette.ink,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        maxLines = 2)
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        val country = resolvedCompetitionCountry(
                            matches.first().country, matches.first().league)
                        CountryIdentity(country)
                        Text(
                            country.takeIf { it.isNotBlank() }
                                ?.let(::countryDisplayName)
                                ?: tr(state.lang, "International", "بین‌المللی"),
                            color = DarkHomePalette.muted, fontSize = 10.sp, maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text("•", color = DarkHomePalette.outline)
                        Text(sportName(matches.first().sport),
                            color = DarkHomePalette.muted, fontSize = 10.sp)
                    }
                }
                SmallPill(matches.size.toString(), DarkHomePalette.soft, DarkHomePalette.ink)
                SmoothExpandChevron(expanded,
                    tr(state.lang, "Toggle league", "نمایش یا بستن لیگ"),
                    tint = DarkHomePalette.muted)
            }
            SmoothExpandedContent(expanded) {
                Column(
                    Modifier.fillMaxWidth().background(DarkHomePalette.canvas)
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    matches.forEach { match ->
                        ReferenceLeagueFixture(match, state, model)
                    }
                }
            }
        }
    }
}

fun betStatus(status: String, lang: Lang): String = when (status.lowercase()) {
    "pending" -> tr(lang, "Pending", "در انتظار ثبت")
    "accepted" -> tr(lang, "Open", "باز")
    "partially_settled" -> tr(lang, "Partially settled", "تسویه جزئی")
    "settled" -> tr(lang, "Settled", "تسویه‌شده")
    "void" -> tr(lang, "Void", "باطل")
    "refunded" -> tr(lang, "Refunded", "برگشت‌خورده")
    "cancelled" -> tr(lang, "Cancelled", "لغوشده")
    "rejected" -> tr(lang, "Rejected", "ردشده")
    "manual_review" -> tr(lang, "Under review", "در حال بررسی")
    "cashed_out" -> tr(lang, "Cashed out", "تسویه زودهنگام")
    else -> status.replace("_", " ")
}

@Composable
fun BetsPage(state: AppState, model: AppViewModel) {
    PremiumMyBetsPage(state, model)
}

private fun walletTransactionLabel(type: String, lang: Lang): String =
    if (lang == Lang.EN) type.replace("_", " ").replaceFirstChar { it.uppercase() }
    else when (type) {
        "deposit" -> "واریز"
        "withdrawal" -> "برداشت"
        "withdrawal_hold" -> "مسدودسازی برداشت"
        "withdrawal_release" -> "آزادسازی برداشت"
        "bet_debit" -> "ثبت شرط"
        "bet_refund" -> "برگشت شرط"
        "win_credit" -> "واریز برد"
        "void_refund" -> "برگشت شرط باطل"
        "bonus" -> "بونوس"
        "adjustment" -> "اصلاح حساب"
        "reversal" -> "بازگشت تراکنش"
        "affiliate_payout" -> "پرداخت افیلیت"
        "cashout" -> "تسویه زودهنگام"
        else -> type.replace("_", " ")
    }

@Composable
fun WalletPage(state: AppState, model: AppViewModel) {
    PremiumWalletPage(state, model)
}

/**
 * Shared anonymous-account state for My Bets, Wallet, Bonuses and Support.
 * Only presentation is shared; each destination retains its original actions.
 */
@Composable
fun LockedFeature(
    lang: Lang,
    message: String,
    onRegister: (() -> Unit)? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.Lock,
    onLogin: () -> Unit
) {
    val panel = Color(0xFF222224)
    val edge = Color(0xFF39393D)
    val ink = Color(0xFFF5F6F8)
    val secondary = Color(0xFFA8ABB5)
    val corner = RoundedCornerShape(21.dp)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = corner,
        color = panel,
        border = BorderStroke(1.dp, edge),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 19.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(13.dp)
            ) {
                Surface(
                    modifier = Modifier.size(55.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFF153A5C),
                    border = BorderStroke(1.dp, Color(0xFF28567D))
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(icon, null,
                            modifier = Modifier.size(27.dp),
                            tint = Color(0xFF78C4FF))
                    }
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Text(
                        tr(lang, "SECURE ACCOUNT ACCESS", "دسترسی امن به حساب"),
                        color = Color(0xFF83C9FF), fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold, letterSpacing = .6.sp
                    )
                    Text(
                        message,
                        color = ink, fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 22.sp,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            HorizontalDivider(color = edge, thickness = 1.dp)
            Text(
                tr(lang,
                    "Your account information is private. Sign in or create an account to continue.",
                    "اطلاعات حساب شما خصوصی است. برای ادامه وارد شوید یا حساب جدید بسازید."),
                color = secondary, fontSize = 12.sp,
                lineHeight = 19.sp
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Surface(
                    modifier = Modifier.weight(1f).height(49.dp)
                        .clickable(role = androidx.compose.ui.semantics.Role.Button,
                            onClickLabel = tr(lang, "Sign in", "ورود"),
                            onClick = onLogin),
                    shape = RoundedCornerShape(13.dp),
                    color = Palette.blue,
                    border = BorderStroke(1.dp, Color(0xFF3395FF))
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize()
                            .padding(horizontal = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.Login, null,
                            tint = Color.White,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang, "Sign in", "ورود"),
                            color = Color.White, fontSize = 12.sp,
                            fontWeight = FontWeight.Bold)
                    }
                }
                if (onRegister != null) {
                    Surface(
                        modifier = Modifier.weight(1f).height(49.dp)
                            .clickable(role = androidx.compose.ui.semantics.Role.Button,
                                onClickLabel = tr(lang, "Create account", "ساخت حساب"),
                                onClick = onRegister),
                        shape = RoundedCornerShape(13.dp),
                        color = Color(0xFF2B2C30),
                        border = BorderStroke(1.dp, Color(0xFF474B52))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize()
                                .padding(horizontal = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(Icons.Default.PersonAdd, null,
                                modifier = Modifier.size(17.dp),
                                tint = Color(0xFF9BD2FF))
                            Spacer(Modifier.width(7.dp))
                            Text(tr(lang, "Sign up", "ثبت‌نام"),
                                color = ink, fontSize = 12.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun FeatureShortcuts(lang: Lang, model: AppViewModel) {
    Column {
        SectionHeading(tr(lang, "Explore BetVima", "امکانات بت‌ویما"))
        listOf(
            Triple(Feature.BONUSES, tr(lang, "My Bonuses", "بونوس‌های من"), Icons.Default.CardGiftcard),
            Triple(Feature.VIP, tr(lang, "VIP Club", "باشگاه VIP"), Icons.Default.Stars),
            Triple(Feature.SUPPORT, tr(lang, "24/7 Support", "پشتیبانی ۲۴ ساعته"), Icons.Default.SupportAgent),
            Triple(Feature.AFFILIATE, tr(lang, "Affiliate", "همکاری در فروش"), Icons.Default.Groups)
        ).chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp)) {
                row.forEach { (feature, title, icon) ->
                    val spotlight = feature == Feature.VIP
                    Surface(Modifier.weight(1f).clickable { model.feature(feature) },
                        color = if (spotlight) Palette.ink else Color.White,
                        shape = RoundedCornerShape(19.dp),
                        border = BorderStroke(1.dp, if (spotlight) Palette.ink else Palette.border),
                        shadowElevation = 1.dp) {
                        Column(Modifier.fillMaxWidth().heightIn(min = 94.dp)
                            .padding(14.dp),
                            verticalArrangement = Arrangement.SpaceBetween) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(color = if (spotlight)
                                        Palette.green.copy(alpha = .15f) else Palette.greenLight,
                                    shape = RoundedCornerShape(10.dp)) {
                                    Icon(icon, null, tint = if (spotlight) Palette.green else Palette.ink,
                                        modifier = Modifier.padding(8.dp).size(21.dp))
                                }
                                Spacer(Modifier.weight(1f))
                                Icon(Icons.Default.NorthEast, null,
                                    tint = if (spotlight) Palette.green else Palette.blue,
                                    modifier = Modifier.size(16.dp))
                            }
                            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                                maxLines = 2, color = if (spotlight) Color.White else Palette.text)
                        }
                    }
                }
            }
        }
    }
}
@Composable
fun ResponsibleNote(lang: Lang) {
    Text(tr(lang,
        "18+ · Please play responsibly. Only wager where permitted by law. All balances and quotes are validated by the server.",
        "۱۸+ · مسئولانه بازی کنید. فقط در مناطق مجاز قانونی فعالیت کنید. همه موجودی‌ها و قیمت‌ها توسط سرور تأیید می‌شوند."),
        color = Palette.muted, fontSize = 10.sp, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp, horizontal = 9.dp))
}


// Eased bounded ascent: avoid the built-in long-distance teleport on a footer tap.
internal suspend fun LazyListState.smoothBackToTop() {
    if (firstVisibleItemIndex == 0 && firstVisibleItemScrollOffset == 0) return
    val visible = layoutInfo.visibleItemsInfo
    val representativeSize = visible.map { it.size }.average()
        .takeIf { !it.isNaN() && it > 0.0 } ?: 300.0
    val estimatedDistance = (
        representativeSize * (firstVisibleItemIndex + 1) +
        firstVisibleItemScrollOffset
    ).toFloat().coerceAtLeast(600f)
    animateScrollBy(-estimatedDistance,
        animationSpec = tween(durationMillis = 850, easing = FastOutSlowInEasing))
    if (firstVisibleItemIndex > 0 || firstVisibleItemScrollOffset > 0)
        animateScrollToItem(0)
}
