package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.CasinoEligibility
import com.betvima.app.data.CasinoGame
import com.betvima.app.data.casinoCategoryLabel
import com.betvima.app.data.CasinoReferenceGroup
import com.betvima.app.data.belongsToCasinoReferenceGroup
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

private val ink = Color(0xFF141414)
private val panel = Color(0xFF272729)
private val secondary = Color(0xFFA2A3AD)
private val edge = Color(0xFF38383B)
private val accent = Color(0xFF087CFA)

/** Real API catalogue only; no simulated games, promo percentages or fake player counters. */
@Composable
fun CasinoPremiumHome(
    state: AppState,
    model: AppViewModel,
    games: List<CasinoGame>,
    showcase: Map<String, List<CasinoGame>>,
    category: String,
    provider: String,
    providers: List<String>,
    query: String,
    total: Int,
    hasMore: Boolean,
    loading: Boolean,
    error: String?,
    launching: String?,
    eligibility: CasinoEligibility?,
    onCategory: (String) -> Unit,
    onProvider: (String) -> Unit,
    onQuery: (String) -> Unit,
    onRetry: () -> Unit,
    onMore: () -> Unit,
    onDemo: (CasinoGame) -> Unit,
    onReal: (CasinoGame) -> Unit
) {
    val fa = state.lang == Lang.FA
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var searchDialog by remember { mutableStateOf(false) }
    var openProviders by remember { mutableStateOf(false) }
    var subCategory by rememberSaveable(category) { mutableStateOf("") }
    var showOnUp by remember { mutableStateOf(false) }
    var visibleCount by rememberSaveable(category, provider, query) { mutableIntStateOf(9) }
    val nestedScroll = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && abs(available.y) > 2f)
                    showOnUp = available.y > 0f
                return Offset.Zero
            }
        }
    }
    val liveTab = category == "live" && provider.isBlank() && query.isBlank()
    val quickTab = category in setOf("crash","instant") && provider.isBlank() && query.isBlank()
    val isLobby = category.isBlank() && provider.isBlank() && query.isBlank()
    val pageIndex = when {
        liveTab -> 1
        quickTab -> 2
        else -> 0
    }
    val allKnown = remember(games, showcase) {
        (games + showcase.values.flatten()).distinctBy { it.id }
    }
    val activeGames = when {
        liveTab -> (showcase["live"].orEmpty() + games.filter { it.category == "live" }).distinctBy { it.id }
        quickTab -> (showcase["crash"].orEmpty() + showcase["instant"].orEmpty() +
            games.filter { it.category in setOf("crash","instant") }).distinctBy { it.id }
        else -> games
    }
    val highlighted = remember(games, showcase, category) {
        val contents = when {
            liveTab -> activeGames
            quickTab -> activeGames
            else -> showcase["slots"].orEmpty() + games + showcase.values.flatten()
        }
        contents.distinctBy { it.id }.filter { !it.imageUrl.isNullOrBlank() }
    }
    val groupedSections = when {
        liveTab -> listOf(
            Triple("baccarat", tr(state.lang,"Baccarat","باکارات"), CasinoReferenceGroup.BACCARAT),
            Triple("game-shows", tr(state.lang,"Game shows","شوهای بازی"), CasinoReferenceGroup.GAME_SHOWS),
            Triple("poker", tr(state.lang,"Poker","پوکر"), CasinoReferenceGroup.POKER),
            Triple("roulette", tr(state.lang,"Roulette","رولت"), CasinoReferenceGroup.ROULETTE),
            Triple("blackjack", tr(state.lang,"Blackjack","بلک‌جک"), CasinoReferenceGroup.BLACKJACK)
        )
        quickTab -> listOf(
            Triple("crash", tr(state.lang,"Crash games","کراش"), CasinoReferenceGroup.CRASH),
            Triple("mines", tr(state.lang,"Mines","مینز"), CasinoReferenceGroup.MINES),
            Triple("plinko", tr(state.lang,"Plinko","پلینکو"), CasinoReferenceGroup.PLINKO),
            Triple("instant", tr(state.lang,"Instant games","بازی‌های فوری"), CasinoReferenceGroup.OTHER_INSTANT)
        )
        else -> emptyList()
    }
    val activeRows = groupedSections.map { (key, title, group) ->
        Triple(key, title, activeGames.filter { belongsToCasinoReferenceGroup(it, group) })
    }.filter { it.third.isNotEmpty() }
    val gridGames = if (liveTab || quickTab) {
        if (subCategory.isNotBlank())
            activeRows.firstOrNull { it.first == subCategory }?.third.orEmpty()
        else activeGames
    } else games

    val displayWidth = ((LocalConfiguration.current.screenWidthDp - 50) / 3f)
        .coerceAtLeast(90f).dp
    val sections = listOf(
        "instant" to tr(state.lang, "Instant games", "بازی‌های فوری"),
        "crash" to tr(state.lang, "Quick games", "بازی‌های سریع"),
        "slots" to tr(state.lang, "Slots", "اسلات"),
        "live" to tr(state.lang, "Live casino", "کازینو زنده"),
        "table" to tr(state.lang, "Table games", "بازی‌های رومیزی"),
        "bingo" to tr(state.lang, "Bingo", "بینگو"),
        "keno" to tr(state.lang, "Keno", "کینو"),
        "fishing" to tr(state.lang, "Fishing", "ماهیگیری"),
        "virtual" to tr(state.lang, "Virtual", "مجازی"),
        "sportsbook" to tr(state.lang, "Sportsbook", "ورزشی"),
        "other" to tr(state.lang, "Other games", "سایر بازی‌ها")
    )
    val realEnabled = eligibility?.realMoneyEnabled == true
    val providerNames = (providers + allKnown.map { it.provider } + provider)
        .filter { it.isNotBlank() }.distinct().sorted()
    fun top() { scope.launch { listState.smoothBackToTop() } }
    Box(Modifier.fillMaxSize().background(ink).nestedScroll(nestedScroll)) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 12.dp, bottom = 22.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item(key = "casino-tabs") {
                CasinoMainTabs(category, state.lang) { onCategory(it) }
            }
            item(key = "casino-hero") {
                CasinoCarousel(highlighted.take(5), state.lang, onDemo)
            }
            item(key = "casino-search") {
                CasinoSearch("", state.lang, {
                    openProviders = false; searchDialog = true
                }, {
                    openProviders = true; searchDialog = true
                })
            }
            item(key = "casino-navigation") {
                if (liveTab || quickTab) {
                    CasinoGenreTabs(state.lang,
                        activeRows.map { it.first to it.second },
                        subCategory) { subCategory = it }
                } else CasinoShortcuts(category, state.lang) { onCategory(it); top() }
            }
            item(key = "casino-disclaimer") {
                Text(
                    if (realEnabled)
                        tr(state.lang, "USD games • Available $" + (eligibility?.displayedUsd ?: "0.00") +
                            " • Minimum $" + (eligibility?.displayedMinimumUsd ?: "0.20"),
                            "بازی دلاری • موجودی $" + (eligibility?.displayedUsd ?: "0.00") +
                            " • حداقل $" + (eligibility?.displayedMinimumUsd ?: "0.20"))
                    else tr(state.lang,
                        "Demo mode • $0.20 minimum stake • Real-money play requires server approval",
                        "حالت دمو • حداقل شرط ۰٫۲۰ دلار • بازی پول واقعی نیازمند تأیید سرور است"),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                    color = secondary, fontSize = 11.sp, lineHeight = 16.sp
                )
            }
            if (isLobby) {
                val chosen = highlighted.ifEmpty { allKnown }.take(18)
                val original = allKnown.filter(::isBetvimaOriginal)
                if (original.isNotEmpty()) {
                    item(key = "casino-originals") {
                        CasinoGameShelf(
                            tr(state.lang, "BetVima games", "بازی‌های بت‌ویما"),
                            Icons.Default.Casino, original, displayWidth,
                            launching, realEnabled, onDemo, onReal
                        )
                    }
                }
                if (chosen.isNotEmpty()) {
                    item(key = "casino-recommendations") {
                        CasinoGameShelf(
                            tr(state.lang, "Explore games", "کاوش بازی‌ها"),
                            Icons.Default.AutoAwesome, chosen.asReversed(), displayWidth,
                            launching, realEnabled, onDemo, onReal
                        )
                    }
                }
                sections.forEach { (type, title) ->
                    val matching = (showcase[type].orEmpty() +
                        allKnown.filter { it.category == type }).distinctBy { it.id }.take(20)
                    if (matching.isNotEmpty()) {
                        item(key = "casino-shelf-" + type) {
                            CasinoGameShelf(
                                title,
                                when (type) {
                                    "instant" -> Icons.Default.Bolt
                                    "crash" -> Icons.Default.FlightTakeoff
                                    "slots" -> Icons.Default.Casino
                                    "live" -> Icons.Default.Style
                                    "table" -> Icons.Default.TableRestaurant
                                    else -> Icons.Default.Apps
                                },
                                matching, displayWidth, launching, realEnabled, onDemo, onReal,
                                onSeeAll = { onCategory(type); top() }
                            )
                        }
                    }
                }
                if (highlighted.isNotEmpty()) {
                    item(key = "casino-featured-banner") {
                        CasinoFeatured(highlighted.first(), state.lang) {
                            onDemo(highlighted.first())
                        }
                    }
                }
            } else if (liveTab || quickTab) {
                if (subCategory.isBlank()) {
                    if (quickTab) {
                        val original = activeGames.filter(::isBetvimaOriginal)
                        if (original.isNotEmpty()) {
                            item(key = "quick-original") {
                                CasinoGameShelf(
                                    tr(state.lang, "BetVima games", "بازی‌های بت‌ویما"),
                                    Icons.Default.Casino, original, displayWidth,
                                    launching, realEnabled, onDemo, onReal
                                )
                            }
                        }
                    }
                    activeRows.forEach { (key, title, tiles) ->
                        item(key = "special-shelf-" + key) {
                            CasinoGameShelf(title,
                                when(key) {
                                    "baccarat" -> Icons.Default.Casino
                                    "game-shows" -> Icons.Default.LocalActivity
                                    "poker" -> Icons.Default.Style
                                    "roulette" -> Icons.Default.Sync
                                    "blackjack" -> Icons.Default.Casino
                                    "crash" -> Icons.Default.RocketLaunch
                                    "mines" -> Icons.Default.Brightness5
                                    "plinko" -> Icons.Default.Grain
                                    else -> Icons.Default.Bolt
                                }, tiles, displayWidth, launching, realEnabled, onDemo, onReal,
                                onSeeAll = { subCategory = key })
                        }
                    }
                }
                if (highlighted.isNotEmpty() && subCategory.isBlank()) {
                    item(key = "special-feature") {
                        CasinoFeatured(highlighted.first(), state.lang) {
                            onDemo(highlighted.first())
                        }
                    }
                }
            } else {
                item(key = "casino-selected-filter") {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            when {
                                query.isNotBlank() -> tr(state.lang, "Search results", "نتایج جست‌وجو")
                                provider.isNotBlank() -> provider
                                category.isNotBlank() -> casinoCategoryLabel(category, fa)
                                else -> tr(state.lang, "All games", "همه بازی‌ها")
                            }, color = Color.White, fontWeight = FontWeight.Bold,
                            fontSize = 19.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = { onCategory(""); onProvider(""); onQuery(""); top() }) {
                            Text(tr(state.lang, "Clear", "پاک‌کردن"), color = accent)
                        }
                    }
                }
            }
            item(key = "casino-all-title") {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.GridView, null, tint = Color.White)
                    Spacer(Modifier.width(8.dp))
                    Text(tr(state.lang, "All games", "همه بازی‌ها"),
                        color = Color.White, fontWeight = FontWeight.Bold,
                        fontSize = 19.sp, modifier = Modifier.weight(1f))
                    IconButton(onClick = onRetry) {
                        Icon(Icons.Default.Refresh, "Refresh", tint = secondary)
                    }
                }
            }
            if (gridGames.isEmpty()) {
                item(key = "casino-state") {
                    Column(Modifier.fillMaxWidth().padding(22.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        if (loading) CircularProgressIndicator(color = accent)
                        else {
                            Text(error ?: tr(state.lang, "No games found", "بازی‌ای پیدا نشد"),
                                color = secondary)
                            OutlinedButton(onClick = onRetry) {
                                Text(tr(state.lang, "Retry", "تلاش مجدد"))
                            }
                        }
                    }
                }
            } else {
                val shown = gridGames.take(visibleCount)
                shown.chunked(3).forEachIndexed { i, row ->
                    item(key = "casino-grid-" + i) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp),
                            horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            row.forEach { game ->
                                Box(Modifier.weight(1f)) {
                                    CasinoCover(game, displayWidth, launching == game.id,
                                        realEnabled, { onDemo(game) }, { onReal(game) })
                                }
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
                item(key = "casino-pagination") {
                    Column(Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(tr(state.lang, "Games shown: ", "بازی‌های نمایش‌داده‌شده: ") +
                            shown.size + " / " +
                            (if (liveTab || quickTab) gridGames.size else total),
                            color = secondary, fontSize = 13.sp)
                        LinearProgressIndicator(
                            progress = {
                                val amount = if (liveTab || quickTab) gridGames.size else total
                                if (amount == 0) 0f else (shown.size.toFloat() / amount).coerceIn(0f,1f)
                            },
                            modifier = Modifier.width(155.dp).height(4.dp)
                                .clip(CircleShape),
                            color = accent, trackColor = panel
                        )
                        if (shown.size < gridGames.size ||
                            (hasMore && !liveTab && !quickTab)) {
                            Button(
                                onClick = {
                                    if (visibleCount < gridGames.size) visibleCount += 9
                                    else onMore()
                                },
                                enabled = !loading,
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = accent)
                            ) {
                                Text(tr(state.lang, "Show more", "نمایش بیشتر"),
                                    fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
            if (loading && games.isNotEmpty()) {
                item(key = "casino-loading-more") {
                    LinearProgressIndicator(Modifier.fillMaxWidth(), color = accent)
                }
            }
            if (error != null && games.isNotEmpty()) {
                item(key = "casino-error-more") {
                    TextButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                        Text(tr(state.lang, "Retry loading", "تلاش مجدد"), color = accent)
                    }
                }
            }
            item(key = "casino-site-footer") {
                PremiumAppFooter(state, model, onBackToTop = ::top)
            }
        }
        // Search controls hide on downward scroll and return only on reverse scroll.
        AnimatedVisibility(
            visible = listState.firstVisibleItemIndex >= 4 && showOnUp,
            modifier = Modifier.align(Alignment.TopCenter),
            enter = fadeIn(), exit = fadeOut()
        ) {
            Column(Modifier.fillMaxWidth().background(ink)
                .padding(top = 6.dp, bottom = 8.dp)) {
                CasinoSearch("", state.lang, {
                    openProviders = false; searchDialog = true
                }, {
                    openProviders = true; searchDialog = true
                })
                Spacer(Modifier.height(7.dp))
                if (liveTab || quickTab) {
                    CasinoGenreTabs(state.lang, activeRows.map { it.first to it.second },
                        subCategory) { subCategory = it }
                } else CasinoShortcuts(category, state.lang) { onCategory(it); top() }
            }
        }
    }
    if (searchDialog) {
        CasinoReferenceSearch(
            lang = state.lang,
            model = model,
            games = allKnown,
            providers = providerNames,
            initialProviders = openProviders,
            onDismiss = { searchDialog = false },
            onGame = { game -> searchDialog = false; onDemo(game) },
            onProvider = { selected ->
                searchDialog = false
                onCategory("")
                onProvider(selected)
                top()
            }
        )
    }
}

@Composable
private fun CasinoMainTabs(category: String, lang: Lang, onSelect: (String) -> Unit) {
    val options = listOf(
        Triple("", "Lobby", "لابی"),
        Triple("live", "Live Casino", "کازینو زنده"),
        Triple("crash", "Quick games", "بازی‌های سریع")
    )
    val selectedIndex = when (category) {
        "live" -> 1
        "crash", "instant" -> 2
        else -> 0
    }
    val shape = RoundedCornerShape(28.dp)
    BoxWithConstraints(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            .shadow(3.dp, shape)
            .clip(shape)
            .background(Color(0xFF28282A))
            .border(1.dp, edge, shape)
            .padding(4.dp)
    ) {
        val tabWidth = maxWidth / 3
        val animatedOffset by animateDpAsState(
            targetValue = tabWidth * selectedIndex,
            animationSpec = spring(
                dampingRatio = .82f,
                stiffness = Spring.StiffnessMediumLow
            ), label = "casinoSegmentSlide"
        )
        Box(Modifier.offset(x = animatedOffset)
            .width(tabWidth).height(48.dp)
            .shadow(5.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(accent))
        Row(Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, (key, en, fa) ->
                Box(
                    Modifier.weight(1f).height(48.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .clickable { if (selectedIndex != index) onSelect(key) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(tr(lang, en, fa),
                        color = if (selectedIndex == index) Color.White
                            else Color(0xFFE4E4E7),
                        fontSize = 12.sp,
                        fontWeight = if (selectedIndex == index) FontWeight.Bold
                            else FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun CasinoShortcuts(category: String, lang: Lang, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
            Triple("", tr(lang, "Lobby", "لابی"), Icons.Default.ViewCarousel),
            Triple("slots", tr(lang, "Slots", "اسلات"), Icons.Default.Casino),
            Triple("crash", tr(lang, "Quick games", "بازی‌های سریع"), Icons.Default.Bolt)
        ).forEach { (key, name, icon) ->
            val selected = category == key
            val fill by animateColorAsState(
                if (selected) accent else panel,
                animationSpec = tween(230), label = "casinoShortcutState")
            Row(Modifier.weight(1f).height(48.dp)
                .shadow(if (selected) 3.dp else 1.dp, RoundedCornerShape(15.dp))
                .clip(RoundedCornerShape(15.dp))
                .background(fill)
                .border(1.dp, if (selected) Color(0xFF3798FF) else edge,
                    RoundedCornerShape(15.dp))
                .casinoBounce { onSelect(key) },
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = Color.White, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp))
                Text(name, color = Color.White, fontSize = 11.sp,
                    fontWeight = FontWeight.Bold, maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun CasinoSearch(
    query: String, lang: Lang, onGames: () -> Unit, onProviders: () -> Unit
) {
    val shape = RoundedCornerShape(17.dp)
    Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(Modifier.weight(1f).height(57.dp)
            .shadow(2.dp, shape).clip(shape)
            .background(Brush.verticalGradient(listOf(Color(0xFF2D2D30), panel)))
            .border(1.dp, edge, shape)
            .casinoBounce(onGames).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF3B3B3F)),
                contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Search, null,
                    tint = Color(0xFFDBDBDF), modifier = Modifier.size(19.dp))
            }
            Spacer(Modifier.width(9.dp))
            Text(tr(lang, "Search", "جست‌وجو"), color = Color(0xFFDEDEE3),
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(Modifier.weight(1f).height(57.dp)
            .shadow(2.dp, shape).clip(shape)
            .background(Brush.verticalGradient(listOf(Color(0xFF2D2D30), panel)))
            .border(1.dp, edge, shape)
            .casinoBounce(onProviders).padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF3B3B3F)),
                contentAlignment = Alignment.Center) {
                Icon(Icons.Default.GridView, null, tint = Color.White,
                    modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(8.dp))
            Text(tr(lang, "Providers", "سازندگان"), color = Color.White,
                fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1,
                overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CasinoGenreTabs(
    lang: Lang,
    genres: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit
) {
    LazyRow(contentPadding = PaddingValues(horizontal = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            CasinoGenrePill(tr(lang,"Lobby","لابی"), Icons.Default.ViewCarousel,
                selected.isBlank()) { onSelect("") }
        }
        items(genres) { (key, label) ->
            CasinoGenrePill(label,
                when(key) {
                    "baccarat" -> Icons.Default.Casino
                    "game-shows" -> Icons.Default.LocalActivity
                    "roulette" -> Icons.Default.Sync
                    "crash" -> Icons.Default.RocketLaunch
                    "mines" -> Icons.Default.Brightness5
                    "plinko" -> Icons.Default.Grain
                    else -> Icons.Default.Bolt
                }, selected == key) { onSelect(key) }
        }
    }
}

@Composable
private fun CasinoGenrePill(
    title: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit
) {
    val fill by animateColorAsState(
        if (selected) accent else panel,
        animationSpec = tween(230), label = "casinoGenreColor")
    Row(Modifier.height(48.dp).shadow(1.dp, RoundedCornerShape(14.dp))
        .clip(RoundedCornerShape(14.dp))
        .background(fill)
        .border(1.dp, if (selected) Color(0xFF3197FF)
            else edge, RoundedCornerShape(14.dp))
        .casinoBounce(onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(7.dp))
        Text(title, color = Color.White, fontSize = 13.sp,
            fontWeight = FontWeight.Bold)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CasinoCarousel(games: List<CasinoGame>, lang: Lang, onDemo: (CasinoGame) -> Unit) {
    val slides = games.take(5)
    val scope = rememberCoroutineScope()
    val pager = rememberPagerState(pageCount = { slides.size.coerceAtLeast(1) })
    LaunchedEffect(slides.map { it.id }) {
        if (slides.size > 1) while (true) {
            delay(5_000)
            pager.animateScrollToPage((pager.currentPage + 1) % slides.size)
        }
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 15.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        HorizontalPager(state = pager, pageSpacing = 8.dp,
            modifier = Modifier.fillMaxWidth().height(173.dp)) { i ->
            val game = slides.getOrNull(i)
            Box(Modifier.fillMaxSize().graphicsLayer {
                val distance = kotlin.math.abs(
                    (pager.currentPage - i) + pager.currentPageOffsetFraction
                ).coerceIn(0f, 1f)
                scaleX = 1f - .055f * distance
                scaleY = 1f - .065f * distance
                alpha = 1f - .20f * distance
            }.clip(RoundedCornerShape(23.dp))
                .border(1.dp, Color(0xFF3865A4), RoundedCornerShape(23.dp))
                .background(Brush.horizontalGradient(
                    listOf(Color(0xFF092766), Color(0xFF1661C5), Color(0xFF212A69))))
                .clickable(enabled = game != null) { if (game != null) onDemo(game) }) {
                if (game?.imageUrl != null) {
                    AsyncImage(game.imageUrl, game.name,
                        modifier = Modifier.align(Alignment.CenterEnd)
                            .fillMaxHeight().fillMaxWidth(.7f),
                        contentScale = ContentScale.Crop)
                }
                Box(Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(listOf(Color(0xFF061A40),
                        Color(0xDF0C2561), Color.Transparent))))
                Column(Modifier.fillMaxWidth(.67f).align(Alignment.CenterStart)
                    .padding(17.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CasinoBrandMark(size = 16.dp)
                        Spacer(Modifier.width(6.dp))
                        Text("BETVIMA • CASINO", color = Color(0xFFB0D9FF),
                            fontSize = 10.sp, fontWeight = FontWeight.Black)
                    }
                    Text(game?.name ?: tr(lang,"Casino games","بازی‌های کازینو"),
                        color = Color.White, fontSize = 22.sp,
                        fontWeight = FontWeight.Black, lineHeight = 26.sp,
                        maxLines = 3, overflow = TextOverflow.Ellipsis)
                    Text(game?.providerName ?: "BetVima", color = Color.White,
                        fontSize = 11.sp, maxLines = 1)
                    Surface(color = Color.White, shape = RoundedCornerShape(11.dp),
                        modifier = Modifier.casinoBounce {
                            game?.let(onDemo)
                        }) {
                        Text(tr(lang,"Try demo","امتحان دمو"), color = Color.Black,
                            fontSize = 12.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp))
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            repeat(slides.size.coerceAtLeast(1)) { idx ->
                Box(Modifier.padding(horizontal = 3.dp)
                    .size(if (pager.currentPage == idx) 8.dp else 6.dp)
                    .clip(CircleShape)
                    .background(if (pager.currentPage == idx) Color.White
                        else secondary.copy(alpha = .45f))
                    .clickable { scope.launch { pager.animateScrollToPage(idx) } })
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CasinoGameShelf(
    title: String, icon: ImageVector, games: List<CasinoGame>, width: Dp,
    launching: String?, realEnabled: Boolean,
    onDemo: (CasinoGame) -> Unit, onReal: (CasinoGame) -> Unit,
    onSeeAll: (() -> Unit)? = null
) {
    val scroll = rememberLazyListState()
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp),
            verticalAlignment = Alignment.CenterVertically) {
            CasinoBrandMark(size = 18.dp)
            Spacer(Modifier.width(5.dp))
            Icon(icon, null, tint = Color(0xFFB9CDF5), modifier = Modifier.size(19.dp))
            Spacer(Modifier.width(8.dp))
            Row(Modifier.weight(1f)
                .then(if (onSeeAll == null) Modifier else Modifier.clickable { onSeeAll() }),
                verticalAlignment = Alignment.CenterVertically) {
                Text(title, color = Color.White, fontSize = 19.sp,
                    fontWeight = FontWeight.Bold, maxLines = 1,
                    overflow = TextOverflow.Ellipsis)
                if (onSeeAll != null) Icon(Icons.Default.ChevronRight, null, tint = secondary)
            }
            CasinoArrow(Icons.Default.ChevronLeft, scroll.firstVisibleItemIndex > 0) {
                scope.launch { scroll.animateScrollToItem(
                    (scroll.firstVisibleItemIndex - 3).coerceAtLeast(0)) }
            }
            Spacer(Modifier.width(5.dp))
            CasinoArrow(Icons.Default.ChevronRight, scroll.firstVisibleItemIndex < games.lastIndex) {
                scope.launch { scroll.animateScrollToItem(
                    (scroll.firstVisibleItemIndex + 3).coerceAtMost(games.lastIndex)) }
            }
        }
        LazyRow(state = scroll, contentPadding = PaddingValues(horizontal = 15.dp),
            flingBehavior = rememberSnapFlingBehavior(lazyListState = scroll),
            horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            items(games, key = { it.id }) { game ->
                CasinoCover(game, width, launching == game.id, realEnabled,
                    { onDemo(game) }, { onReal(game) },
                    modifier = Modifier.graphicsLayer {
                        val tile = scroll.layoutInfo.visibleItemsInfo
                            .firstOrNull { it.key == game.id }
                        if (tile != null) {
                            val viewport = (scroll.layoutInfo.viewportStartOffset +
                                scroll.layoutInfo.viewportEndOffset) / 2f
                            val itemCenter = tile.offset + tile.size / 2f
                            val spread = (scroll.layoutInfo.viewportEndOffset -
                                scroll.layoutInfo.viewportStartOffset).coerceAtLeast(1)
                            val delta = ((itemCenter - viewport) / spread)
                                .coerceIn(-1f, 1f)
                            val centrality = 1f - kotlin.math.abs(delta)
                            scaleX = .96f + .04f * centrality
                            scaleY = .96f + .04f * centrality
                            rotationY = -5f * delta
                            alpha = .84f + .16f * centrality
                        }
                    })
            }
        }
    }
}

@Composable
private fun CasinoArrow(icon: ImageVector, enabled: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(35.dp).clip(RoundedCornerShape(11.dp))
        .background(panel)
        .border(1.dp, Color(0xFF354966), RoundedCornerShape(11.dp))
        .then(if (enabled) Modifier.casinoBounce(onClick) else Modifier),
        contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = if (enabled) Color.White else secondary.copy(alpha = .45f),
            modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun CasinoCover(
    game: CasinoGame, width: Dp, launching: Boolean, realEnabled: Boolean,
    onDemo: () -> Unit, onReal: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.width(width), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.fillMaxWidth().height(width * 1.37f)
            .clip(RoundedCornerShape(13.dp))
            .background(Brush.verticalGradient(
                listOf(Color(0xFF2046B0), Color(0xFF652983))))
            .border(1.dp, Color(0xFF48639C).copy(alpha = .55f),
                RoundedCornerShape(13.dp))
            .casinoBounce(onDemo)) {
            if (game.imageUrl != null) {
                AsyncImage(game.imageUrl, game.name, modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop)
            } else {
                Text(game.name, color = Color.White, fontSize = 13.sp,
                    fontWeight = FontWeight.Black, maxLines = 4,
                    modifier = Modifier.align(Alignment.Center).padding(8.dp))
            }
            Box(Modifier.align(Alignment.TopCenter)
                .clip(RoundedCornerShape(bottomStart = 7.dp, bottomEnd = 7.dp))
                .background(Color.Black.copy(alpha = .72f))
                .padding(horizontal = 5.dp, vertical = 3.dp)) {
                Text(game.providerName.uppercase(), color = Color.White,
                    fontSize = 8.sp, fontWeight = FontWeight.Bold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (launching) {
                Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .5f)),
                    contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = accent, modifier = Modifier.size(27.dp))
                }
            }
            if (realEnabled) {
                Box(Modifier.align(Alignment.BottomEnd).padding(5.dp)
                    .size(28.dp).clip(CircleShape).background(accent)
                    .clickable(onClick = onReal), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.PlayArrow, "Play USD", tint = Color.White)
                }
            }
        }
        Text(game.name, color = Color.White, fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold, maxLines = 1,
            overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically) {
            CasinoBrandMark(size = 10.dp)
            Spacer(Modifier.width(4.dp))
            Text(game.providerName, fontSize = 9.sp, color = secondary,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CasinoFeatured(game: CasinoGame, lang: Lang, onDemo: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(horizontal = 15.dp).height(150.dp)
        .clip(RoundedCornerShape(22.dp))
        .background(Brush.horizontalGradient(
            listOf(Color(0xFF174DF4), Color(0xFF426DFA))))
        .clickable(onClick = onDemo)) {
        if (game.imageUrl != null) {
            AsyncImage(game.imageUrl, game.name,
                modifier = Modifier.fillMaxHeight().fillMaxWidth(.48f)
                    .align(Alignment.CenterEnd), contentScale = ContentScale.Crop)
        }
        Column(Modifier.fillMaxHeight().fillMaxWidth(.62f).padding(17.dp),
            verticalArrangement = Arrangement.SpaceBetween) {
            Text(tr(lang,"Featured game","بازی ویژه"), color = Color.White,
                fontSize = 21.sp, fontWeight = FontWeight.Black)
            Text(game.name, color = Color.White, fontSize = 12.sp,
                fontWeight = FontWeight.Bold, maxLines = 2)
            Surface(color = Color.White, shape = RoundedCornerShape(11.dp)) {
                Text(tr(lang,"Try demo","امتحان دمو"), color = Color.Black,
                    fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 15.dp, vertical = 8.dp))
            }
        }
    }
}

@Composable
private fun CasinoProviderItem(name: String, selected: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick)
        .padding(vertical = 12.dp, horizontal = 3.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(name, modifier = Modifier.weight(1f), fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
        if (selected) Icon(Icons.Default.Check, null, tint = accent)
    }
}
