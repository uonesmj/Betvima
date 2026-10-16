package com.betvima.app.ui

import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.betvima.app.data.CasinoGame
import com.betvima.app.data.CasinoEligibility
import com.betvima.app.data.ApiFailure
import com.betvima.app.data.casinoCategoryLabel
import com.betvima.app.data.casinoDemoFailure
import kotlinx.coroutines.delay
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val casinoCategories = listOf("", "slots", "live", "crash", "table", "instant",
    "bingo", "keno", "fishing", "virtual", "sportsbook", "other")

/** Native Compose casino lobby — only provider-returned games, no bundled simulations. */
@Composable
fun CasinoLobby(state: AppState, model: AppViewModel) {
    val fa = state.lang == Lang.FA
    val scope = rememberCoroutineScope()
    val gridState = rememberLazyGridState()
    var category by remember { mutableStateOf("") }
    var provider by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var debouncedQuery by remember { mutableStateOf("") }
    var page by remember { mutableIntStateOf(1) }
    var games by remember { mutableStateOf<List<CasinoGame>>(emptyList()) }
    var providerOptions by remember { mutableStateOf<List<String>>(emptyList()) }
    var total by remember { mutableIntStateOf(0) }
    var hasMore by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshSerial by remember { mutableIntStateOf(0) }
    var launching by remember { mutableStateOf<String?>(null) }
    var sessionUrl by remember { mutableStateOf<String?>(null) }
    var launchError by remember { mutableStateOf<Pair<String, String>?>(null) }
    var pilot by remember { mutableStateOf<CasinoEligibility?>(null) }
    var pilotRefreshSerial by remember { mutableIntStateOf(0) }
    var pendingRealGame by remember { mutableStateOf<CasinoGame?>(null) }
    var gameUsesRealMoney by remember { mutableStateOf(false) }
    var failedRealMoneyLaunch by remember { mutableStateOf(false) }

    LaunchedEffect(state.signedIn, pilotRefreshSerial) {
        pilot = null
        if (state.signedIn) {
            try { pilot = model.casinoEligibility() }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { pilot = null } // Deny by default.
        }
    }

    fun launchWithRealWallet(game: CasinoGame) {
        if (launching != null || pilot?.realMoneyEnabled != true) return
        pendingRealGame = null
        launchError = null
        failedRealMoneyLaunch = false
        launching = game.id
        scope.launch {
            try {
                val url = model.casinoRealMoneyLaunch(game.id, state.lang)
                gameUsesRealMoney = true
                sessionUrl = url
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (failure: Exception) {
                failedRealMoneyLaunch = true
                val status = (failure as? ApiFailure)?.code?.takeIf { it in 400..599 }
                launchError = game.name to (
                    tr(state.lang,
                        "Real-money game launch was denied. The server must approve this test account and its wallet.",
                        "اجرای بازی با پول واقعی از طرف سرور تأیید نشد. حساب آزمایشی و کیف پول آن باید مجاز باشند.") +
                    (if (status != null) " (HTTP $status)" else "")
                )
            } finally {
                launching = null
            }
        }
    }

    fun tryDemo(gameId: String, gameName: String, confirmedDemo: Boolean) {
        if (launching != null) return
        launchError = null
        if (!state.signedIn) {
            model.showLogin(true)
            return
        }
        launching = gameId
        scope.launch {
            try {
                val url = model.casinoDemoLaunch(gameId, state.lang)
                gameUsesRealMoney = false
                failedRealMoneyLaunch = false
                sessionUrl = url
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (failure: Exception) {
                val status = (failure as? ApiFailure)?.code
                val details = casinoDemoFailure(status, confirmedDemo, fa)
                val safeStatus = status?.takeIf { it in 400..599 }
                launchError = gameName to (details + if (safeStatus != null) " (HTTP $safeStatus)" else "")
            } finally {
                launching = null
            }
        }
    }

    LaunchedEffect(query) {
        delay(330)
        debouncedQuery = query.trim()
    }
    LaunchedEffect(category, provider, debouncedQuery, page, refreshSerial) {
        loading = true
        error = null
        try {
            val result = model.casinoGames(page, category, debouncedQuery, provider)
            val previous = if (page == 1) emptyList() else games
            games = (previous + result.games).distinctBy { it.id }
            hasMore = result.hasMore && result.games.isNotEmpty()
            providerOptions = result.providers
            total = result.total
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            error = tr(state.lang,
                "The casino catalogue is not available yet. Please try again.",
                "فهرست بازی‌ها هنوز در دسترس نیست. دوباره تلاش کنید.")
            if (page == 1) { games = emptyList(); total = 0 }
        } finally {
            loading = false
        }
    }

    // The API returns studios across all matching titles, not only the loaded page.
    // Older servers without facets still work with the visible-card fallback.
    val availableProviders = remember(games, provider, providerOptions) {
        ((providerOptions.ifEmpty { games.map { it.provider } }) +
            listOfNotNull(provider.takeIf(String::isNotBlank)))
            .filter(String::isNotBlank).distinct()
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        state = gridState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 15.dp, end = 15.dp, top = 16.dp, bottom = 26.dp),
        horizontalArrangement = Arrangement.spacedBy(11.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Palette.ink, Palette.dark, Color(0xFF0E5646))))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Casino, null, tint = Palette.gold,
                            modifier = Modifier.size(20.dp))
                        Text("BETVIMA  /  CASINO", color = Palette.gold,
                            fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Text(tr(state.lang, "Casino games", "بازی‌های کازینو"),
                        color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                    Text(tr(state.lang,
                        "Slots, live casino, crash and more — from our connected game providers.",
                        "اسلات، کازینوی زنده، کراش و بازی‌های متنوع از ارائه‌دهندگان متصل."),
                        color = Color(0xFFD7E5E3), fontSize = 12.sp, lineHeight = 19.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        CasinoTag("USD", Palette.gold)
                        CasinoTag(tr(state.lang, "Demo play", "بازی آزمایشی"), Palette.green)
                        if (total > 0) CasinoTag("$total " +
                            tr(state.lang, "games", "بازی"), Color.White)
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            val permission = pilot
            BvInformationStrip(
                if (permission?.realMoneyEnabled == true) {
                    tr(state.lang,
                        "Game balance: USD $" + permission.displayedUsd +
                            " (wallet: " + permission.walletCurrency +
                            "). All game amounts are USD; wins and losses settle in your wallet currency. Minimum wager: $" +
                            permission.displayedMinimumUsd + ".",
                        "موجودی بازی: $" + permission.displayedUsd +
                            " دلار (کیف پول: " + permission.walletCurrency +
                            "). مبالغ بازی دلاری است و برد و باخت در ارز کیف پول تسویه می‌شود. حداقل شرط: $" +
                            permission.displayedMinimumUsd + ".")
                } else {
                    tr(state.lang,
                        "Demo play can be attempted. Real-money games require server approval (minimum wager: $0.20).",
                        "اجرای دمو قابل امتحان است. بازی با پول واقعی به تأیید سرور نیاز دارد (حداقل شرط: ۰٫۲۰ دلار).")
                },
                icon = Icons.Default.VerifiedUser, accent = Palette.blue
            )
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Palette.greenLight,
                border = BorderStroke(1.dp, Palette.green.copy(alpha = .35f))
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            tr(state.lang, "Aviator · Verified demo", "Aviator · دموی تأییدشده"),
                            fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Palette.ink
                        )
                        Text(
                            tr(state.lang, "Not every slot or live casino game has a free demo.",
                                "همه اسلات‌ها و بازی‌های کازینو زنده نسخه آزمایشی ندارند."),
                            fontSize = 11.sp, color = Palette.text, lineHeight = 17.sp
                        )
                    }
                    Button(
                        onClick = { tryDemo("x887bde40b16350c", "Aviator", true) },
                        enabled = launching == null,
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.ink),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(tr(state.lang, "Play demo", "اجرای دمو"), fontSize = 11.sp)
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            OutlinedTextField(
                value = query,
                onValueChange = {
                    if (it.length <= 80) {
                        query = it
                        page = 1
                        games = emptyList()
                    }
                },
                placeholder = {
                    Text(tr(state.lang, "Search games...", "جست‌وجوی بازی‌ها..."),
                        fontSize = 13.sp)
                },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = Palette.muted) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { query = ""; debouncedQuery = "";
                        page = 1; games = emptyList() }) {
                        Icon(Icons.Default.Close, tr(state.lang, "Clear", "پاک کردن"))
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(18.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White, unfocusedContainerColor = Color.White,
                    focusedBorderColor = Palette.green, unfocusedBorderColor = Palette.border)
            )
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                items(casinoCategories) { item ->
                    val selected = category == item
                    FilterChip(
                        selected = selected,
                        onClick = {
                            if (!selected) {
                                category = item; provider = ""; page = 1; games = emptyList()
                                scope.launch { gridState.animateScrollToItem(0) }
                            }
                        },
                        label = {
                            Text(if (item.isEmpty()) tr(state.lang, "All", "همه")
                                else casinoCategoryLabel(item, fa), fontSize = 12.sp)
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Palette.ink,
                            selectedLabelColor = Color.White,
                            containerColor = Color.White)
                    )
                }
            }
        }
        if (availableProviders.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    item { Text(tr(state.lang, "Studio", "سازنده") + ":",
                        color = Palette.muted, fontWeight = FontWeight.Bold,
                        fontSize = 12.sp) }
                    item {
                        CasinoProviderChip(tr(state.lang, "All", "همه"), provider.isEmpty()) {
                            provider = ""; page = 1; games = emptyList()
                        }
                    }
                    items(availableProviders) { p ->
                        CasinoProviderChip(p, provider == p) {
                            provider = p; page = 1; games = emptyList()
                        }
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(tr(state.lang, "Explore games", "کاوش بازی‌ها"),
                        fontSize = 18.sp, fontWeight = FontWeight.Black, color = Palette.text)
                    if (total > 0) Text("$total " + tr(state.lang, "available titles", "عنوان موجود"),
                        fontSize = 12.sp, color = Palette.muted)
                }
                IconButton(onClick = { page = 1; games = emptyList(); refreshSerial++ }) {
                    Icon(Icons.Default.Refresh, tr(state.lang, "Refresh", "بارگذاری مجدد"),
                        tint = Palette.blue)
                }
            }
        }
        if (games.isEmpty() && loading) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Palette.green)
                }
            }
        } else if (games.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                CasinoEmptyState(error ?: tr(state.lang, "No games match these filters.",
                    "بازی‌ای با این فیلترها پیدا نشد."), state.lang, error != null) {
                    refreshSerial++
                }
            }
        }
        items(games, key = { it.id }) { game ->
            CasinoGameCard(
                game = game, lang = state.lang, launching = launching == game.id,
                realMoneyEnabled = state.signedIn && pilot?.realMoneyEnabled == true,
                onRealClick = { pendingRealGame = game },
                onClick = { tryDemo(game.id, game.name, game.demoSupported) }
            )
        }
        if (games.isNotEmpty() && loading) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
            }
        } else if (error != null && games.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                TextButton(onClick = { refreshSerial++ }, modifier = Modifier.fillMaxWidth()) {
                    Text(tr(state.lang, "Retry loading", "تلاش مجدد"))
                }
            }
        } else if (hasMore) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Button(onClick = { page++ }, modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Palette.ink),
                    shape = RoundedCornerShape(14.dp)) {
                    Text(tr(state.lang, "Load more games", "نمایش بازی‌های بیشتر"))
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.Default.ExpandMore, null, Modifier.size(18.dp))
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Spacer(Modifier.height(18.dp))
        }
    }
    sessionUrl?.let { secureUrl ->
        CasinoGameDialog(secureUrl, state.lang, gameUsesRealMoney) {
            sessionUrl = null
            if (gameUsesRealMoney && state.signedIn) {
                // After returning from a game, fetch the authoritative wallet
                // balance again. Never change the displayed balance locally.
                pilot = null
                pilotRefreshSerial++
                model.refreshAccount()
            }
        }
    }
    pendingRealGame?.let { game ->
        AlertDialog(
            onDismissRequest = { pendingRealGame = null },
            icon = { Icon(Icons.Default.Casino, null, tint = Palette.green) },
            title = { Text(tr(state.lang, "Play with USD", "اجرای بازی دلاری"),
                fontWeight = FontWeight.Bold) },
            text = {
                Text(tr(state.lang,
                    game.name + "\nThe game uses USD. Bets and wins are settled in your " +
                        (pilot?.walletCurrency ?: "USD") + " wallet.",
                    game.name + "\nمبلغ بازی دلار است؛ برداشت و پرداخت برد در کیف پول " +
                        (pilot?.walletCurrency ?: "USD") + " انجام می‌شود."))
            },
            confirmButton = {
                Button(onClick = { launchWithRealWallet(game) }) {
                    Text(tr(state.lang, "Open game", "ورود به بازی"))
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingRealGame = null }) {
                    Text(tr(state.lang, "Cancel", "انصراف"))
                }
            }
        )
    }
    launchError?.let { (gameName, message) ->
        AlertDialog(
            onDismissRequest = { launchError = null },
            icon = { Icon(Icons.Default.Info, null, tint = Palette.blue) },
            title = {
                Column {
                    Text(if (failedRealMoneyLaunch)
                        tr(state.lang, "Game launch failed", "خطا در اجرای بازی")
                        else tr(state.lang, "Demo launch failed", "خطا در اجرای دمو"),
                        fontWeight = FontWeight.Bold)
                    Text(gameName, style = MaterialTheme.typography.titleSmall)
                }
            },
            text = { Text(message, lineHeight = 23.sp) },
            confirmButton = {
                TextButton(onClick = { launchError = null }) {
                    Text(tr(state.lang, "Understood", "متوجه شدم"))
                }
            },
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@Composable
private fun CasinoTag(label: String, foreground: Color) {
    Surface(color = Color.White.copy(alpha = .10f), shape = RoundedCornerShape(9.dp),
        border = BorderStroke(1.dp, foreground.copy(alpha = .35f))) {
        Text(label, color = foreground, fontWeight = FontWeight.SemiBold,
            fontSize = 10.sp, modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp))
    }
}

@Composable
private fun CasinoProviderChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(10.dp),
        color = if (selected) Palette.ink else Color.White,
        border = BorderStroke(1.dp, if (selected) Palette.ink else Palette.border)) {
        Text(label, modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
            maxLines = 1, fontSize = 11.sp,
            color = if (selected) Color.White else Palette.text)
    }
}

@Composable
private fun CasinoGameCard(
    game: CasinoGame, lang: Lang, launching: Boolean,
    realMoneyEnabled: Boolean, onRealClick: () -> Unit, onClick: () -> Unit
) {
    Surface(
        onClick = onClick, enabled = game.canTryDemo,
        modifier = Modifier.fillMaxWidth(),
        color = Color.White, shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 2.dp
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(142.dp)
                .background(Brush.verticalGradient(listOf(Palette.ink, Palette.dark))),
                contentAlignment = Alignment.Center) {
                if (!game.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = game.imageUrl, contentDescription = game.name,
                        modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Casino, null, tint = Palette.gold,
                        modifier = Modifier.size(48.dp))
                }
                if (launching) CircularProgressIndicator(
                    color = Palette.green, modifier = Modifier.size(30.dp))
                Surface(modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
                    shape = RoundedCornerShape(8.dp),
                    color = Palette.ink.copy(alpha = .83f)) {
                    Text(casinoCategoryLabel(game.category, lang == Lang.FA),
                        color = Color.White, fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
                }
            }
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(game.name, fontSize = 13.sp, fontWeight = FontWeight.Black,
                    color = Palette.text, maxLines = 2,
                    overflow = TextOverflow.Ellipsis, minLines = 2)
                Text(game.providerName, fontSize = 11.sp, color = Palette.muted,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (realMoneyEnabled) {
                    Button(
                        onClick = onRealClick,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !launching,
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.ink),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.AccountBalanceWallet, null,
                            modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(tr(lang, "Play USD", "بازی با دلار"), fontSize = 12.sp)
                    }
                }
                Surface(color = if (game.demoSupported) Palette.greenLight else Palette.paper,
                    shape = RoundedCornerShape(9.dp)) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp, horizontal = 8.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.PlayArrow,
                            null, tint = if (game.demoSupported) Palette.ink else Palette.muted,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(3.dp))
                        Text(if (game.demoSupported)
                            tr(lang, "Play demo", "بازی آزمایشی")
                            else tr(lang, "Try demo", "امتحان دمو"),
                            color = if (game.demoSupported) Palette.ink else Palette.muted,
                            fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun CasinoEmptyState(message: String, lang: Lang, failed: Boolean, retry: () -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(if (failed) Icons.Default.CloudOff else Icons.Default.SearchOff,
                null, tint = Palette.blue, modifier = Modifier.size(44.dp))
            Text(message, color = Palette.text, fontSize = 13.sp, lineHeight = 20.sp)
            if (failed) OutlinedButton(onClick = retry) {
                Text(tr(lang, "Try again", "تلاش مجدد"))
            }
        }
    }
}

/** Provider HTML5 sessions run inside the native Android app, not on BetVima website. */
@Composable
private fun CasinoGameDialog(url: String, lang: Lang, realMoney: Boolean, onClose: () -> Unit) {
    val context = LocalContext.current
    var loading by remember(url) { mutableStateOf(true) }
    var pageFailed by remember(url) { mutableStateOf(false) }
    var view: WebView? by remember(url) { mutableStateOf(null) }

    DisposableEffect(url) {
        onDispose {
            view?.apply {
                stopLoading()
                loadUrl("about:blank")
                destroy()
            }
            view = null
        }
    }
    Dialog(onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = Palette.ink) {
            Column {
                Row(Modifier.fillMaxWidth().height(55.dp).padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, tr(lang, "Close game", "بستن بازی"),
                            tint = Color.White)
                    }
                    Text(if (realMoney) tr(lang, "Casino · USD", "کازینو · دلاری")
                        else tr(lang, "Casino · Demo", "کازینو · آزمایشی"),
                        color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f))
                    CasinoTag("USD", Palette.gold)
                }
                if (loading) LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(), color = Palette.green)
                if (pageFailed) {
                    CasinoEmptyState(
                        tr(lang, "The game could not load securely. Close and try another title.",
                            "بازی با اتصال امن باز نشد. آن را ببندید و بازی دیگری انتخاب کنید."),
                        lang, false, retry = {})
                }
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = {
                        WebView(context).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            settings.setSupportMultipleWindows(false)
                            settings.javaScriptCanOpenWindowsAutomatically = false
                            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            CookieManager.getInstance().setAcceptCookie(true)
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                            webChromeClient = WebChromeClient()
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(
                                    view: WebView, request: WebResourceRequest
                                ): Boolean = request.url.scheme != "https"
                                override fun onPageFinished(view: WebView, url: String) {
                                    loading = false
                                }
                                override fun onReceivedHttpError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    errorResponse: android.webkit.WebResourceResponse
                                ) {
                                    if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                                        loading = false
                                        pageFailed = true
                                    }
                                }
                                override fun onReceivedError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    error: android.webkit.WebResourceError
                                ) {
                                    if (request.isForMainFrame) { loading = false; pageFailed = true }
                                }
                            }
                            loadUrl(url)
                            view = this
                        }
                    }
                )
            }
        }
    }
}
