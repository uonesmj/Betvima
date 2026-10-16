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

@Composable
fun HomePage(state: AppState, model: AppViewModel, onSearch: () -> Unit) {
    val footerListState = rememberLazyListState()
    val footerScope = rememberCoroutineScope()
    // Featured games are real, bettable upcoming markets, never fabricated promotions.
    // Avoid re-sorting cards on every wallet, slip, or live score state update.
    val featured = remember(state.upcoming) {
        state.upcoming.filter { match ->
            match.bettingAvailable && match.featured?.available == true &&
                match.featured?.selections?.any { it.available } == true
        }.sortedWith(compareByDescending<Match> { it.marketsCount }.thenBy { it.starts })
    }
    LazyColumn(state = footerListState,
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
            if (featured.isEmpty() && state.upcomingLoading) {
                items(2) { FixtureSkeleton(Modifier.padding(horizontal = 15.dp)) }
            } else if (featured.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 15.dp)) {
                        EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                            tr(state.lang, "Only verified upcoming odds are displayed.",
                                "فقط ضرایب تأییدشده بازی‌های آینده نمایش داده می‌شوند.")) {
                            model.refreshUpcoming()
                        }
                    }
                }
            } else items(featured.take(25), key = { "top-" + it.id }, contentType = { "match" }) { match ->
                Box(Modifier.padding(horizontal = 15.dp, vertical = 3.dp)) {
                    ReferenceTopBetCard(match, state, model)
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
                    else EmptyPanel(tr(state.lang, "No live matches", "مسابقه زنده‌ای موجود نیست"),
                        tr(state.lang, "Check again as events begin.",
                            "با شروع مسابقات دوباره بررسی کنید.")) { model.refreshLive() }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Top Bets", "شرط‌های برتر",
                        Icons.Default.Whatshot, Palette.blue) {
                        model.homeMode(HomeMode.TOP_BETS)
                    }
                    if (featured.isNotEmpty()) ReferenceMatchCarousel(featured, state, model)
                    else if (state.upcomingLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                        tr(state.lang, "Markets appear when confirmed by the provider.",
                            "بازارها پس از تأیید منبع داده نمایش داده می‌شوند.")) {
                        model.refreshUpcoming()
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
                    else EmptyPanel(tr(state.lang, "No upcoming fixtures", "مسابقه آینده‌ای موجود نیست"),
                        tr(state.lang, "Upcoming fixtures load from the live catalogue.",
                            "مسابقات آینده از فهرست واقعی دریافت می‌شوند.")) {
                        model.refreshUpcoming()
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

@Composable
fun CatalogPage(state: AppState, model: AppViewModel, live: Boolean,
    onSearch: () -> Unit) {
    val footerListState = rememberLazyListState()
    val footerScope = rememberCoroutineScope()
    var liveSport by rememberSaveable { mutableStateOf("top") }
    // All 46 (or any current API count) fixtures are initially visible:
    // no silently closed league can inflate the counter without a card.
    var collapsedLeagues by rememberSaveable(live) { mutableStateOf(emptyList<String>()) }
    LaunchedEffect(live, liveSport, state.sport) { collapsedLeagues = emptyList() }
    var selectedLeague by rememberSaveable(live, liveSport, state.sport, state.tournamentLeague) {
        mutableStateOf(if (live) "" else state.tournamentLeague)
    }
    var tournamentOpen by remember { mutableStateOf(false) }
    val allMatches = if (live) state.live else state.upcoming
    // Remember catalogue transformations; state can update independently from
    // a user's scroll (balance, notifications, slip picks and live polling).
    val matches = remember(allMatches, live, liveSport) {
        if (live) liveSportMatches88(allMatches, liveSport) else allMatches
    }
    val groups = remember(matches, live) {
        matches.groupBy { catalogueGroupKey88(it, live) }
    }
    val visibleGroups = remember(groups, selectedLeague) {
        if (selectedLeague.isBlank()) groups else
            groups.filterKeys { it == selectedLeague }
    }
    val displayedCount = visibleFixtureCount88(visibleGroups, collapsedLeagues)
    val totalCount = visibleGroups.values.sumOf { it.size }

    LazyColumn(state = footerListState,
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
                        color = Palette.text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(displayedCount.toString() + " / " + totalCount.toString() + " " +
                        tr(state.lang, "fixtures expanded", "مسابقه باز و قابل مشاهده"),
                        color = Palette.muted, fontSize = 10.sp)
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
                    color = Color.White,
                    shape = RoundedCornerShape(17.dp),
                    border = BorderStroke(1.dp, Palette.border),
                    shadowElevation = 2.dp,
                    modifier = Modifier.weight(1f).clickable { tournamentOpen = true }
                ) {
                    Row(Modifier.heightIn(min = 54.dp)
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Palette.greenLight, shape = RoundedCornerShape(11.dp)) {
                            Icon(Icons.Default.EmojiEvents, null, tint = Palette.blue,
                                modifier = Modifier.padding(9.dp).size(20.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(state.lang, "TOURNAMENTS", "رقابت‌ها"),
                                fontSize = 9.sp, fontWeight = FontWeight.Black,
                                color = Palette.muted)
                            Text(if (selectedLeague.isBlank())
                                tr(state.lang, "Choose a tournament", "انتخاب لیگ")
                                else groups[selectedLeague]?.firstOrNull()?.league.orEmpty(),
                                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                                color = Palette.text, maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = Palette.blue)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, Palette.border),
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
        lang = state.lang, groups = groups, selected = selectedLeague,
        onSelect = { selectedLeague = it },
        onDismiss = { tournamentOpen = false }
    )
}

@Composable
private fun LeagueSection(key: String, matches: List<Match>, expanded: Boolean,
    onToggle: () -> Unit, state: AppState, model: AppViewModel) {
    Surface(shape = RoundedCornerShape(23.dp), color = Color.White,
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 4.dp,
        modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onToggle)
                .padding(horizontal = 13.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                LeagueIdentityBadge(matches.first(), size = 43)
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(matches.first().league, color = Palette.text,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        maxLines = 2)
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        CountryIdentity(matches.first().country)
                        Text(
                            matches.first().country.takeIf { it.isNotBlank() }
                                ?.let(::countryDisplayName)
                                ?: tr(state.lang, "International", "بین‌المللی"),
                            color = Palette.muted, fontSize = 10.sp, maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text("•", color = Palette.border)
                        Text(sportName(matches.first().sport),
                            color = Palette.muted, fontSize = 10.sp)
                    }
                }
                SmallPill(matches.size.toString(), Palette.paper, Palette.text)
                SmoothExpandChevron(expanded,
                    tr(state.lang, "Toggle league", "نمایش یا بستن لیگ"),
                    tint = Palette.muted)
            }
            SmoothExpandedContent(expanded) {
                Column(
                    Modifier.fillMaxWidth().background(Color(0xFFF4F6F9))
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

@Composable
fun LockedFeature(lang: Lang, message: String, onLogin: () -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Palette.border)) {
        Column(Modifier.padding(25.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Lock, null, tint = Palette.blue, modifier = Modifier.size(34.dp))
            Spacer(Modifier.height(12.dp))
            Text(message, fontSize = 14.sp, color = Palette.text,
                textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(15.dp))
            Button(onClick = onLogin, colors = ButtonDefaults.buttonColors(containerColor = Palette.green)) {
                Text(tr(lang, "Sign in", "ورود"), color = Palette.ink, fontWeight = FontWeight.Bold)
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
