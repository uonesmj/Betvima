package com.betvima.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BetvimaApp(model: AppViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    var accountOpen by rememberSaveable { mutableStateOf(false) }
    var languageOpen by rememberSaveable { mutableStateOf(false) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    val snackbars = remember { SnackbarHostState() }
    val pageStates = rememberSaveableStateHolder()
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val drawerScope = rememberCoroutineScope()

    LaunchedEffect(state.notice) {
        val message = state.notice
        if (message != null) {
            model.notice(null)
            snackbars.showSnackbar(message, withDismissAction = true)
        }
    }
    LaunchedEffect(state.tab, state.feature, state.detail?.id) {
        if (state.tab == Tab.LIVE && state.feature == Feature.NONE && state.detail == null) {
            while (true) {
                delay(6_000)
                model.refreshLive(silent = true)
            }
        }
    }
    BackHandler(enabled = languageOpen || searchOpen || state.betDetailVisible || state.showLogin ||
        state.showSlip || state.detail != null ||
        state.feature != Feature.NONE || accountOpen || drawer.isOpen ||
        state.tab != Tab.HOME) {
        when {
            languageOpen -> languageOpen = false
            state.betDetailVisible -> model.closeBet()
            state.showLogin -> model.showLogin(false)
            state.showSlip -> model.showSlip(false)
            drawer.isOpen -> drawerScope.launch { drawer.close() }
            accountOpen -> accountOpen = false
            searchOpen -> { search = ""; searchOpen = false }
            state.detail != null -> model.closeMatch()
            state.feature != Feature.NONE -> model.feature(Feature.NONE)
            else -> model.tab(Tab.HOME)
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides
        (if (state.lang == Lang.FA) LayoutDirection.Rtl else LayoutDirection.Ltr)) {
        ModalNavigationDrawer(
            drawerState = drawer,
            drawerContent = {
                ReferenceMenuDrawer(state, model,
                    dismiss = { drawerScope.launch { drawer.close() } },
                    openAccount = {
                        if (state.signedIn) accountOpen = true else model.showLogin(true)
                    },
                    openLanguage = { languageOpen = true })
            }
        ) {
        Scaffold(
            containerColor = Palette.paper,
            topBar = {
                Column {
                    BrandHeader(state.lang,
                        signedIn = state.signedIn,
                        onHome = { model.tab(Tab.HOME) },
                        onLanguage = { languageOpen = true },
                        onAccount = {
                            if (state.signedIn) accountOpen = true else model.showLogin(true)
                        },
                        onRegister = { model.showLogin(true, register = true) },
                        onNotifications = { model.feature(Feature.NOTIFICATIONS) },
                        unread = state.notifications.count { it.readAt == null },
                        walletBalance = if (state.signedIn && state.wallet != null)
                            com.betvima.app.data.money(state.wallet!!.availableMinor,
                                state.wallet!!.currency) else null,
                        onWallet = { model.tab(Tab.WALLET) })
                    if (state.detail == null && state.feature == Feature.NONE) {
                        if (searchOpen && state.tab in setOf(Tab.HOME, Tab.LIVE, Tab.SPORTS)) {
                            OutlinedTextField(value = search, onValueChange = { search = it.take(80) },
                                singleLine = true, modifier = Modifier.fillMaxWidth()
                                    .background(Color.White).padding(horizontal = 14.dp, vertical = 4.dp),
                                placeholder = { Text(tr(state.lang, "Search teams or leagues",
                                    "جست‌وجوی تیم یا لیگ")) },
                                leadingIcon = { Icon(Icons.Default.Search, null) },
                                trailingIcon = {
                                    IconButton(onClick = { search = ""; searchOpen = false }) {
                                        Icon(Icons.Default.Close, "Close search")
                                    }
                                })
                        }
                    }
                }
            },
            bottomBar = {
                ReferenceBottomBar(
                    state = state,
                    showSlip = state.tab in setOf(Tab.HOME, Tab.LIVE, Tab.SPORTS) &&
                        state.feature == Feature.NONE,
                    onNavigate = { destination ->
                        when (destination) {
                            "menu" -> drawerScope.launch { drawer.open() }
                            "home" -> model.tab(Tab.HOME)
                            "casino" -> model.feature(Feature.CASINO)
                            "bonus" -> model.feature(Feature.BONUSES)
                            "sports" -> model.tab(Tab.SPORTS)
                        }
                    },
                    onSlip = { model.showSlip(true) }
                )
            },
            snackbarHost = { SnackbarHost(snackbars) }
        ) { padding ->
            val filtered = run {
                if (search.isBlank()) state
                else {
                    val query = search.trim()
                    state.copy(
                        live = state.live.filter {
                            it.title.contains(query, true) || it.league.contains(query, true)
                        },
                        upcoming = state.upcoming.filter {
                            it.title.contains(query, true) || it.league.contains(query, true)
                        }
                    )
                }
            }
            Box(Modifier.fillMaxSize().padding(padding)) {
                val screenId = when {
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
                        (slideInHorizontally(animationSpec = tween(240)) { it / 7 } +
                            fadeIn(animationSpec = tween(230)))
                            .togetherWith(
                                slideOutHorizontally(animationSpec = tween(190)) { -it / 7 } +
                                    fadeOut(animationSpec = tween(190)))
                    }
                ) { destination ->
                    pageStates.SaveableStateProvider(destination) {
                        when {
                            destination.startsWith("match-") ->
                                MatchDetailPage(state, model)
                            destination.startsWith("feature-") ->
                                FeaturePage(state, model)
                            destination.startsWith("home-") -> HomePage(filtered, model) {
                                searchOpen = !searchOpen
                            }
                            destination == "tab-LIVE" ->
                                CatalogPage(filtered, model, live = true) {
                                    searchOpen = !searchOpen
                                }
                            destination == "tab-SPORTS" ->
                                CatalogPage(filtered, model, live = false) {
                                    searchOpen = !searchOpen
                                }
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
        }

        if (state.showSlip) SlipSheet(state, model)
        if (state.showLogin) LoginSheet(state, model)
        if (state.betDetailVisible) BetReceiptSheet(state, model)
        if (accountOpen) ReferenceProfileSheet(state, model) { accountOpen = false }
        if (languageOpen) LanguagePickerDialog(
            state.lang,
            onSelect = { selected -> model.setLanguage(selected); languageOpen = false },
            onDismiss = { languageOpen = false }
        )
    }
}

@Composable
private fun QuickToolbar(lang: Lang, onSports: () -> Unit, onSearch: () -> Unit,
    onBonus: () -> Unit, onVip: () -> Unit, onSupport: () -> Unit, onCasino: () -> Unit) {
    LazyRow(Modifier.fillMaxWidth().background(Palette.ink),
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
            Text(title, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}
