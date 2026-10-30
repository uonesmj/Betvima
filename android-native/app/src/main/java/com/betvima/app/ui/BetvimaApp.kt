package com.betvima.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.Lifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BetvimaApp(model: AppViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val context87 = LocalContext.current
    val deviceSettings87 = remember(context87) { SettingsDevice87(context87) }
    var pinUnlocked87 by remember { mutableStateOf(!deviceSettings87.hasPin()) }

    var accountOpen by rememberSaveable { mutableStateOf(false) }
    var languageOpen by rememberSaveable { mutableStateOf(false) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var notificationPopupOpen by rememberSaveable { mutableStateOf(false) }
    var supportOpen by rememberSaveable { mutableStateOf(false) }
    var supportRequestedTicketId by rememberSaveable { mutableStateOf<String?>(null) }
    var initialSplash by rememberSaveable { mutableStateOf(true) }
    var affiliateOpen by rememberSaveable { mutableStateOf(false) }
    var vipOpen by rememberSaveable { mutableStateOf(false) }
    var bonusOpen by rememberSaveable { mutableStateOf(false) }
    var appWindowOrigin by remember { mutableStateOf(Offset.Zero) }
    var slipFabWindowCenter by remember { mutableStateOf(Offset.Unspecified) }
    var footerCoversSlip by remember { mutableStateOf(false) }
    // Navigation always starts visible; only the active list's footer can hide the FAB.
    LaunchedEffect(state.tab, state.homeMode, state.feature, searchOpen, state.detail?.id) {
        footerCoversSlip = false
    }
    LaunchedEffect(Unit) {
        // Motion is an entrance identity, not a proxy for backend progress.
        delay(1050)
        initialSplash = false
    }
    var isForeground by remember { mutableStateOf(true) }
    val snackbars = remember { SnackbarHostState() }
    var notificationBaseline87 by remember(state.signedIn) { mutableStateOf(false) }
    var observedNotificationIds87 by remember(state.signedIn) {
        mutableStateOf(emptySet<String>())
    }
    // Support replies stay in the bell inbox only: never show a bottom Snackbar.
    // Keep the existing optional bet settlement feedback unchanged.
    LaunchedEffect(state.notifications, state.signedIn, isForeground) {
        if (!state.signedIn) {
            notificationBaseline87 = false
            observedNotificationIds87 = emptySet()
        } else {
            val incoming = state.notifications
            if (!notificationBaseline87) {
                observedNotificationIds87 = incoming.map { it.id }.toSet()
                notificationBaseline87 = true
            } else if (isForeground) {
                val newResults = incoming.filter { note ->
                    note.id !in observedNotificationIds87 && note.eventKey in setOf(
                        "bet.won", "bet.lost", "bet.void", "bet.partial"
                    )
                }
                observedNotificationIds87 += incoming.map { it.id }
                if (deviceSettings87.appAlerts()) {
                    if (deviceSettings87.betAlerts()) {
                        newResults.take(3).forEach { note ->
                            snackbars.showSnackbar(note.title + " · " + note.body)
                        }
                    }
                }
            }
        }
    }

    val pageStates = rememberSaveableStateHolder()
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val drawerScope = rememberCoroutineScope()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        isForeground = true
        if (state.tab in setOf(Tab.HOME, Tab.LIVE) &&
            state.feature == Feature.NONE && state.detail == null) {
            model.refreshLive(silent = true)
        }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) {
        isForeground = false
        if (deviceSettings87.hasPin()) pinUnlocked87 = false
    }
    // Keep both the header and Wallet in sync with the server's confirmed ledger.
    // Lifecycle-aware: resume triggers an immediate read, and pauses cancel polling.
    // A payment intent is NOT proof of credit, so balances are never incremented locally.
    LaunchedEffect(state.signedIn, isForeground) {
        if (state.signedIn && isForeground) {
            model.refreshWallet()
            while (true) {
                delay(model.walletRefreshIntervalMs())
                model.refreshWallet()
            }
        }
    }
    // Refresh unread notifications while the app is foregrounded. No mock counters.
    LaunchedEffect(state.signedIn, isForeground) {
        if (state.signedIn && isForeground) {
            model.refreshNotifications(silent = true)
            while (true) {
                delay(15_000)
                model.refreshNotifications(silent = true)
            }
        }
    }
    // Open bonuses using the same overlay navigation convention as VIP.
    // Keep the authenticated bonus ledger untouched and inside the popup.
    LaunchedEffect(state.feature) {
        if (state.feature == Feature.BONUSES) {
            bonusOpen = true
            model.feature(Feature.NONE)
        }
    }
    // VIP is always a modal, never a full-screen Feature page.
    // Preserve all existing drawer/footer/notification entry points.
    LaunchedEffect(state.feature) {
        if (state.feature == Feature.VIP) {
            vipOpen = true
            model.feature(Feature.NONE)
        }
    }
    // Native support is a full-screen modal, not a separate ticket-list page.
    // Preserve the active server conversation when the user closes the modal.
    LaunchedEffect(state.feature) {
        if (state.feature == Feature.SUPPORT) {
            supportRequestedTicketId = null
            supportOpen = true
            model.feature(Feature.NONE)
        }
    }
    // Compatibility: catch any older in-app route that still selects the
    // historical full Notifications feature, and redirect to the overlay.
    LaunchedEffect(state.feature) {
        if (state.feature == Feature.NOTIFICATIONS) {
            notificationPopupOpen = true
            model.feature(Feature.NONE)
            if (state.signedIn) model.refreshNotifications(silent = true)
        }
    }

    LaunchedEffect(state.notice) {
        val message = state.notice
        if (message != null) {
            model.notice(null)
            snackbars.showSnackbar(message, withDismissAction = true)
        }
    }
    LaunchedEffect(state.tab, state.feature, state.detail?.id, isForeground) {
        if (isForeground && state.tab in setOf(Tab.LIVE, Tab.HOME) &&
            state.feature == Feature.NONE && state.detail == null) {
            while (true) {
                delay(if (state.tab == Tab.LIVE) 6_000 else 18_000)
                model.refreshLive(silent = true)
            }
        }
    }
    LaunchedEffect(state.tab, state.feature, state.signedIn, isForeground) {
        if (isForeground && state.signedIn && state.tab == Tab.BETS &&
            state.feature == Feature.NONE) {
            // Live scores update while My Bets is visible, not only on Home/Live.
            // The account ledger is still refreshed by its own authenticated API.
            model.refreshLive(silent = true)
            while (true) {
                delay(18_000)
                model.refreshLive(silent = true)
                model.refreshBetHistory(silent = true)
            }
        }
    }
    BackHandler(enabled = !bonusOpen && !vipOpen && !affiliateOpen && !supportOpen && (notificationPopupOpen || languageOpen || searchOpen || state.betDetailVisible || state.showLogin ||
        state.showSlip || state.detail != null ||
        state.feature != Feature.NONE || accountOpen || drawer.isOpen ||
        state.tab != Tab.HOME || state.homeMode == HomeMode.TOP_BETS)) {
        when {
            bonusOpen -> bonusOpen = false
            vipOpen -> vipOpen = false
            notificationPopupOpen -> notificationPopupOpen = false
            affiliateOpen -> affiliateOpen = false
            languageOpen -> languageOpen = false
            state.betDetailVisible -> model.closeBet()
            state.showLogin -> model.showLogin(false)
            state.showSlip -> model.showSlip(false)
            drawer.isOpen -> drawerScope.launch { drawer.close() }
            accountOpen -> accountOpen = false
            searchOpen -> { model.clearSearch(); searchOpen = false }
            state.detail != null -> model.closeMatch()
            state.feature != Feature.NONE -> model.feature(Feature.NONE)
            state.tab == Tab.HOME && state.homeMode == HomeMode.TOP_BETS ->
                model.homeMode(HomeMode.TOP)
            else -> model.tab(Tab.HOME)
        }
    }

    // Keep the app shell, headers, footer and cards anchored in the same places
    // for both languages. Text content itself remains Unicode Persian when selected.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr,
        LocalNativeLanguage176 provides state.lang) {
        ModalNavigationDrawer(
            drawerState = drawer,
            drawerContent = {
                ReferenceMenuDrawer(state, model,
                    dismiss = { drawerScope.launch { drawer.close() } },
                    openAccount = {
                        if (state.signedIn) accountOpen = true else model.showLogin(true)
                    },
                    openLanguage = { languageOpen = true },
                    openAffiliate = { affiliateOpen = true },
                    openNotifications = {
                        notificationPopupOpen = true
                        if (state.signedIn) model.refreshNotifications(silent = true)
                    })
            }
        ) {
        Box(Modifier.fillMaxSize().onGloballyPositioned {
            val origin = it.positionInWindow()
            if (appWindowOrigin != origin) appWindowOrigin = origin
        }) {
        Scaffold(
            containerColor = when {
                state.feature == Feature.CASINO -> ThemeTokens.canvas
                state.feature == Feature.SUPPORT || state.feature == Feature.PROFILE -> Palette.headerDark
                state.feature == Feature.NONE &&
                    state.tab in setOf(Tab.BETS, Tab.WALLET, Tab.HOME, Tab.LIVE, Tab.SPORTS) -> Palette.headerDark
                else -> ThemeTokens.canvas
            },
            topBar = {
                Column {
                    BrandHeader(state.lang,
                        signedIn = state.signedIn,
                        onHome = {
                            if (searchOpen) { searchOpen = false; model.clearSearch() }
                            model.tab(Tab.HOME)
                        },
                        onAccount = {
                            if (state.signedIn) accountOpen = true else model.showLogin(true)
                        },
                        onRegister = { model.showLogin(true, register = true) },
                        onNotifications = {
                            notificationPopupOpen = true
                            if (state.signedIn) model.refreshNotifications(silent = true)
                        },
                        unread = state.notificationUnreadCount,
                        walletBalance = if (state.signedIn && state.wallet != null)
                            com.betvima.app.data.money(state.wallet!!.availableMinor,
                                state.wallet!!.currency) else null,
                        walletCurrency = if (state.signedIn) state.wallet?.currency else null,
                        onWallet = { model.tab(Tab.WALLET) },
                        userName = state.accountName,
                        casinoStyle = state.feature == Feature.CASINO)

                }
            },
            bottomBar = {
                ReferenceBottomBar(
                    state = state,
                    menuOpen = drawer.isOpen,
                    onNavigate = { destination ->
                        if (searchOpen) { searchOpen = false; model.clearSearch() }
                        when (destination) {
                            "menu" -> drawerScope.launch { drawer.open() }
                            "home" -> model.tab(Tab.HOME)
                            "casino" -> model.feature(Feature.CASINO)
                            "bets" -> model.tab(Tab.BETS)
                            "sports" -> model.tab(Tab.SPORTS)
                        }
                    }
                )
            },
            floatingActionButton = {
                if (state.tab in setOf(Tab.HOME, Tab.LIVE, Tab.SPORTS) &&
                    state.feature == Feature.NONE && !drawer.isOpen) {
                    // Reserve the same 112x48 FAB slot even while hidden, so
                    // neither the scaffold nor any surrounding UI shifts.
                    Box(Modifier.width(112.dp).height(48.dp),
                        contentAlignment = Alignment.Center) {
                        AnimatedVisibility(
                            visible = !footerCoversSlip,
                            enter = fadeIn(animationSpec = tween(260, delayMillis = 35)) +
                                slideInVertically(animationSpec = tween(
                                    280, easing = FastOutSlowInEasing)) { it / 3 } +
                                scaleIn(initialScale = .94f,
                                    animationSpec = tween(280, easing = FastOutSlowInEasing)),
                            exit = fadeOut(animationSpec = tween(200)) +
                                slideOutVertically(animationSpec = tween(
                                    230, easing = FastOutSlowInEasing)) { it / 3 } +
                                scaleOut(targetScale = .94f,
                                    animationSpec = tween(220, easing = FastOutSlowInEasing))
                        ) {
                            AnimatedFloatingBetslip(
                                count = state.picks.size,
                                lang = state.lang,
                                onOpen = { model.showSlip(true) },
                                onCenterChanged = { center ->
                                    if (slipFabWindowCenter != center) slipFabWindowCenter = center
                                },
                                receivingPick = state.pickFlight != null
                            )
                        }
                    }
                }
            },
            floatingActionButtonPosition = FabPosition.Center,
            snackbarHost = { SnackbarHost(snackbars) }
        ) { padding ->
            val filtered = state
            Box(Modifier.fillMaxSize().padding(padding)) {
                val screenId = when {
                    searchOpen -> "search"
                    state.detailLoading || state.detail != null ->
                        "match-" + (state.detail?.id ?: "loading")
                    state.feature != Feature.NONE -> "feature-" + state.feature.name
                    state.tab == Tab.HOME -> "home-" + state.homeMode.name
                    else -> "tab-" + state.tab.name
                }
                AnimatedContent(
                    targetState = screenId,
                    label = "mainScreenNavigation",
                    transitionSpec = {
                        (slideInHorizontally(animationSpec = tween(350)) { it / 9 } +
                            fadeIn(animationSpec = tween(300)))
                            .togetherWith(
                                slideOutHorizontally(animationSpec = tween(280)) { -it / 9 } +
                                    fadeOut(animationSpec = tween(230)))
                    }
                ) { destination ->
                    pageStates.SaveableStateProvider(destination) {
                        when {
                            destination == "search" ->
                                NativeSearchSheet(state, model) { searchOpen = false }
                            destination.startsWith("match-") ->
                                MatchDetailPage(state, model)
                            destination.startsWith("feature-") ->
                                FeaturePage(stateForAnimatedDestination(destination, state), model)
                            destination.startsWith("home-") ->
                                HomePage(filtered, model,
                                    onSearch = { searchOpen = !searchOpen },
                                    onFooterOverlapChanged = { footerCoversSlip = it })
                            destination == "tab-LIVE" ->
                                CatalogPage(filtered, model, live = true,
                                    onSearch = { searchOpen = !searchOpen },
                                    onFooterOverlapChanged = { footerCoversSlip = it })
                            destination == "tab-SPORTS" ->
                                CatalogPage(filtered, model, live = false,
                                    onSearch = { searchOpen = !searchOpen },
                                    onFooterOverlapChanged = { footerCoversSlip = it })
                            destination == "tab-BETS" -> BetsPage(state, model)
                            destination == "tab-WALLET" -> WalletPage(state, model)
                        }
                    }
                }
                if ((state.liveLoading || state.upcomingLoading) &&
                    state.live.isNotEmpty() && state.upcoming.isNotEmpty()) {
                    LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter),
                        color = Palette.green)
                }
            }
        }
        PickFlightOverlay84(
            flight = state.pickFlight,
            windowOrigin = appWindowOrigin,
            targetWindowCenter = slipFabWindowCenter,
            onLanded = model::finishPickFlight
        )
        }
        }

        if (notificationPopupOpen) {
            NotificationsPopup(
                state = state,
                model = model,
                onDismiss = { notificationPopupOpen = false },
                onLogin = {
                    notificationPopupOpen = false
                    model.showLogin(true)
                },
                onNavigate = { destination, ticketId ->
                    notificationPopupOpen = false
                    when (destination) {
                        NotificationDestination.BONUSES -> model.feature(Feature.BONUSES)
                        NotificationDestination.WALLET -> model.tab(Tab.WALLET)
                        NotificationDestination.CASINO -> model.feature(Feature.CASINO)
                        NotificationDestination.SPORTS -> model.tab(Tab.SPORTS)
                        NotificationDestination.BETS -> model.tab(Tab.BETS)
                        NotificationDestination.SUPPORT -> {
                            supportRequestedTicketId = ticketId
                            supportOpen = true
                        }
                        NotificationDestination.VIP -> model.feature(Feature.VIP)
                        NotificationDestination.AFFILIATE -> affiliateOpen = true
                        NotificationDestination.PROFILE -> model.feature(Feature.PROFILE)
                    }
                }
            )
        }
        if (supportOpen) {
            SupportMessenger(state, model, supportRequestedTicketId,
                onDismiss = {
                    supportOpen = false
                    supportRequestedTicketId = null
                    model.refreshNotifications(silent = true)
                })
        }
        if (state.showSlip) SlipSheet(state, model)
        if (state.showLogin) LoginSheet(state, model)
        if (state.betDetailVisible) BetReceiptSheet(state, model)
        if (accountOpen) ReferenceProfileSheet(state, model) { accountOpen = false }
        if (languageOpen) LanguagePickerDialog(
            state.lang,
            onSelect = { selected -> model.setLanguage(selected) },
            onDismiss = { languageOpen = false }
        )
        if (affiliateOpen) PremiumAffiliateSheet(state, model) { affiliateOpen = false }
        if (bonusOpen) BonusPopup83(state, model) { bonusOpen = false }
        if (vipOpen) VipClubPopup82(
            state = state,
            model = model,
            onDismiss = { vipOpen = false },
            onSupport = { vipOpen = false; model.feature(Feature.SUPPORT) }
        )
        PremiumLoadingOverlay(initialSplash, state.lang)
        LocalPinGate87(
            locked = deviceSettings87.hasPin() && !pinUnlocked87,
            onUnlock = { pinUnlocked87 = true }
        )
    }
}

@Composable
private fun QuickToolbar(lang: Lang, onSports: () -> Unit, onSearch: () -> Unit,
    onBonus: () -> Unit, onVip: () -> Unit, onSupport: () -> Unit, onCasino: () -> Unit) {
    LazyRow(Modifier.fillMaxWidth().background(ThemeTokens.canvas),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { ToolbarAction(tr(lang, "Sports", "ورزش‌ها"), Icons.Default.SportsSoccer, onSports) }
        item { ToolbarAction(tr(lang, "Search", "جست‌وجو"), Icons.Default.Search, onSearch) }
        item { ToolbarAction(tr(lang, "Bonuses", "بونوس‌ها"), Icons.Default.CardGiftcard, onBonus) }
        item { ToolbarAction("VIP", Icons.Default.Stars, onVip) }
        item { ToolbarAction(tr(lang, "Support", "پشتیبانی"), Icons.Default.SupportAgent, onSupport) }
        item { ToolbarAction(tr(lang, "Casino", "کازینو"), Icons.Default.Casino, onCasino) }
    }
}
@Composable
private fun ToolbarAction(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Surface(color = Palette.darkElevated, shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = .07f)),
        modifier = Modifier.clickable(onClick = onClick)) {
        Row(Modifier.heightIn(min = 35.dp).padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Palette.green, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(5.dp))
            Text(title, color = ThemeTokens.ink, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}
