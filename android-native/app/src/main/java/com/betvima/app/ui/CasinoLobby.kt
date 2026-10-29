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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
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
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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
    var eligibilityLoading by remember { mutableStateOf(false) }
    var pilotRefreshSerial by remember { mutableIntStateOf(0) }
    var pendingRealGame by remember { mutableStateOf<CasinoGame?>(null) }
    var realMoneyAcknowledged by remember { mutableStateOf(false) }
    var gameUsesRealMoney by remember { mutableStateOf(false) }
    var gameFullscreen by remember { mutableStateOf(false) }
    var casinoForeground by remember { mutableStateOf(true) }
    var failedRealMoneyLaunch by remember { mutableStateOf(false) }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                casinoForeground = true
                pilotRefreshSerial++
            } else if (event == Lifecycle.Event.ON_PAUSE) {
                casinoForeground = false
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(state.signedIn, pilotRefreshSerial) {
        pilot = null
        eligibilityLoading = state.signedIn
        if (state.signedIn) {
            try { pilot = model.casinoEligibility() }
            catch (cancel: CancellationException) { throw cancel }
            catch (_: Exception) { pilot = null } // Deny by default.
            finally { eligibilityLoading = false }
        }
    }

    // Read-only, foreground-only balance sync during real-money sessions.
    // Never calculate amounts from WebView or change the wallet locally.
    LaunchedEffect(sessionUrl, gameUsesRealMoney, state.signedIn, casinoForeground) {
        if (sessionUrl != null && gameUsesRealMoney && state.signedIn && casinoForeground) {
            model.refreshWallet()
            while (true) {
                delay(2_500L)
                model.refreshWallet()
            }
        }
    }

    fun launchWithRealWallet(game: CasinoGame) {
        if (launching != null || pilot?.realMoneyEnabled != true || !realMoneyAcknowledged) return
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
                val rawDetails = casinoDemoFailure(status, confirmedDemo, fa,
                    (failure as? ApiFailure)?.serverCode)
                val details = when (state.lang) {
                    Lang.RU -> RussianQuality180.translate(rawDetails) ?: RussianTranslations180.translate(rawDetails)
                    Lang.AZ -> AzerbaijaniQuality179.translate(rawDetails) ?: rawDetails
                    else -> rawDetails
                }
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
        } catch (failure: Exception) {
            val status = (failure as? ApiFailure)?.code
            error = when (status) {
                503 -> tr(state.lang,
                    "Casino is unavailable on the server. Please try again later.",
                    "کازینو در سرور در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.")
                else -> tr(state.lang,
                    "Unable to refresh casino games. Please check your connection and retry.",
                    "به‌روزرسانی بازی‌های کازینو انجام نشد. اتصال خود را بررسی و دوباره تلاش کنید.")
            }
            // Retain previously fetched real game cards during temporary outages.
            // Never manufacture games or bypass server authorization to launch.
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
    // First paint uses the primary catalogue immediately. The top two shelves
    // load after a short defer; lower shelves and deeper live pages only after
    // the user scrolls. No unnecessary search/provider showcase requests.
    var categoryShowcase by remember { mutableStateOf<Map<String, List<CasinoGame>>>(emptyMap()) }
    var expandShowcase by remember(category, provider, debouncedQuery) { mutableStateOf(false) }
    LaunchedEffect(category, provider, debouncedQuery, refreshSerial, expandShowcase) {
        if (provider.isBlank() && debouncedQuery.isBlank()) {
            val types = when (category) {
                "live" -> listOf("live")
                "crash", "instant" -> listOf("crash", "instant")
                "" -> if (expandShowcase) listOf("slots", "live", "instant", "crash", "table")
                      else listOf("slots", "live")
                else -> emptyList()
            }
            val pages = if (expandShowcase) when (category) {
                "live" -> 4
                "crash", "instant" -> 3
                else -> 1
            } else 1
            if (!expandShowcase) delay(220)
            categoryShowcase = coroutineScope {
                val jobs = types.map { type ->
                    async {
                        val collected = mutableListOf<CasinoGame>()
                        for (index in 1..pages) {
                            val response = try {
                                model.casinoGames(index, type, "", "")
                            } catch (cancel: CancellationException) {
                                throw cancel
                            } catch (_: Exception) {
                                break
                            }
                            collected += response.games
                            if (!response.hasMore || response.games.isEmpty()) break
                        }
                        type to collected.distinctBy { it.id }
                    }
                }
                jobs.awaitAll().toMap()
            }
        } else {
            categoryShowcase = emptyMap()
        }
    }

    Box(Modifier.fillMaxSize().background(ChromeTokens.black)) {
    CasinoPremiumHome(
        state = state,
        model = model,
        games = games,
        showcase = categoryShowcase,
        category = category,
        provider = provider,
        providers = availableProviders,
        query = query,
        total = total,
        hasMore = hasMore,
        loading = loading,
        error = error,
        launching = launching,
        eligibility = pilot,
        eligibilityLoading = eligibilityLoading,
        onCategory = { selected ->
            if (category != selected || provider.isNotBlank() || query.isNotBlank()) {
                category = selected
                provider = ""
                query = ""
                debouncedQuery = ""
                page = 1
                games = emptyList()
            }
        },
        onProvider = { selected ->
            provider = selected
            page = 1
            games = emptyList()
        },
        onQuery = { search ->
            query = search
            if (search.isBlank()) debouncedQuery = ""
            page = 1
            games = emptyList()
        },
        onRetry = {
            model.invalidateCasinoCatalogue()
            categoryShowcase = emptyMap()
            pilotRefreshSerial++
            page = 1
            games = emptyList()
            refreshSerial++
        },
        onMore = { if (!loading && hasMore) page++ },
        onExploreMore = { expandShowcase = true },
        onDemo = { game -> tryDemo(game.id, game.name, game.demoSupported) },
        onReal = { game ->
            if (pilot?.realMoneyEnabled == true && state.signedIn) {
                realMoneyAcknowledged = false
                pendingRealGame = game
            }
        },
        fullscreen = gameFullscreen,
        onFullscreenChange = { gameFullscreen = it }
    )
    sessionUrl?.let { secureUrl ->
        CasinoGameDialog(secureUrl, state.lang, gameUsesRealMoney, gameFullscreen) {
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
    } // Casino lobby/player content under the existing application chrome.
    pendingRealGame?.let { game ->
        AlertDialog(
            onDismissRequest = {
                pendingRealGame = null
                realMoneyAcknowledged = false
            },
            icon = { Icon(Icons.Default.Casino, null, tint = Palette.green) },
            title = { Text(tr(state.lang, "Play with USD", "اجرای بازی دلاری"),
                fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(game.name, fontWeight = FontWeight.Bold,
                        color = Palette.text, fontSize = 15.sp)
                    Text(tr(state.lang,
                        "This is real-money gambling. Game amounts are USD; bets and winnings " +
                            "settle in your " + (pilot?.walletCurrency ?: "USD") +
                            " wallet. Minimum normal bet: $" +
                            (pilot?.displayedMinimumUsd ?: "0.20") + ".",
                        "این بازی با پول واقعی انجام می‌شود. مبلغ بازی به دلار است و شرط‌ها و بردها " +
                            "در کیف پول " + (pilot?.walletCurrency ?: "USD") +
                            " تسویه می‌شوند. حداقل شرط معمول: " +
                            (pilot?.displayedMinimumUsd ?: "0.20") + " دلار."),
                        color = Palette.text, fontSize = 13.sp, lineHeight = 21.sp)
                    Text(tr(state.lang,
                        "You can lose money. Only eligible adults in authorized locations " +
                            "can play. Server-side limits, KYC and wallet controls apply.",
                        "احتمال از دست‌دادن پول وجود دارد. فقط کاربران بزرگسال و تأییدشده " +
                            "در مناطق مجاز می‌توانند بازی کنند. محدودیت‌ها و کنترل کیف پول در سرور اعمال می‌شود."),
                        color = Palette.muted, fontSize = 12.sp, lineHeight = 19.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = realMoneyAcknowledged,
                            onCheckedChange = { realMoneyAcknowledged = it },
                            colors = CheckboxDefaults.colors(checkedColor = Palette.green)
                        )
                        Text(tr(state.lang,
                            "I understand this is a real-money game and game amounts are in USD.",
                            "متوجه هستم که این بازی با پول واقعی است و مبالغ بازی دلاری هستند."),
                            modifier = Modifier.weight(1f).clickable {
                                realMoneyAcknowledged = !realMoneyAcknowledged
                            },
                            color = Palette.text, fontSize = 12.sp, lineHeight = 19.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { launchWithRealWallet(game) },
                    enabled = realMoneyAcknowledged && launching == null
                ) {
                    Text(tr(state.lang, "Open real-money game", "ورود به بازی با پول واقعی"))
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    pendingRealGame = null
                    realMoneyAcknowledged = false
                }) {
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
                        else tr(state.lang, "Game launch failed", "خطا در اجرای بازی"),
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
                        model = casinoArtwork216(game.imageUrl, 480, 600), contentDescription = game.name,
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
                    Text(tr(lang, casinoCategoryLabel(game.category, false), casinoCategoryLabel(game.category, true)),
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
private fun CasinoGameDialog(
    url: String, lang: Lang, realMoney: Boolean, fullscreen: Boolean, onClose: () -> Unit
) {
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
    val gameContent: @Composable () -> Unit = {
        Surface(Modifier.fillMaxSize(), color = Palette.ink) {
            Column {
                Row(Modifier.fillMaxWidth().height(55.dp).padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, tr(lang, "Close game", "بستن بازی"),
                            tint = Color.White)
                    }
                    Text(if (realMoney) tr(lang, "Casino · USD", "کازینو · دلاری")
                        else tr(lang, "Casino", "کازینو"),
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
    if (fullscreen) {
        Dialog(onDismissRequest = onClose,
            properties = DialogProperties(usePlatformDefaultWidth = false)) {
            gameContent()
        }
    } else {
        gameContent()
    }
}
