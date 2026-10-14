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
                    })
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
                Column {
                    if (state.tab in setOf(Tab.HOME, Tab.LIVE, Tab.SPORTS) &&
                        state.feature == Feature.NONE) {
                        Box(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 5.dp),
                            contentAlignment = Alignment.Center) {
                            Surface(color = Palette.blue, shadowElevation = 6.dp,
                                shape = RoundedCornerShape(28.dp),
                                modifier = Modifier.width(144.dp).height(43.dp)
                                    .clickable { model.showSlip(true) }) {
                                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.ConfirmationNumber, null,
                                        tint = Color.White, modifier = Modifier.size(20.dp))
                                    Spacer(Modifier.width(7.dp))
                                    Text(state.picks.size.toString(), color = Color.White,
                                        fontWeight = FontWeight.Black, fontSize = 15.sp)
                                    Spacer(Modifier.width(11.dp))
                                    Icon(Icons.Default.KeyboardArrowUp,
                                        tr(state.lang, "Open bet slip", "باز کردن برگه شرط"),
                                        tint = Color.White, modifier = Modifier.size(23.dp))
                                }
                            }
                        }
                    }
                    NavigationBar(containerColor = Palette.ink,
                        tonalElevation = 0.dp) {
                        listOf(
                            Triple("menu", tr(state.lang, "Menu", "منو"), Icons.Default.Menu),
                            Triple("home", tr(state.lang, "Home", "خانه"), Icons.Default.Home),
                            Triple("casino", tr(state.lang, "Casino", "کازینو"), Icons.Default.Casino),
                            Triple("bonus", tr(state.lang, "Bonuses", "بونوس"), Icons.Default.CardGiftcard),
                            Triple("sports", tr(state.lang, "Sports", "ورزش‌ها"), Icons.Default.SportsSoccer)
                        ).forEach { (destination, label, icon) ->
                            val selected = when(destination) {
                                "home" -> state.tab == Tab.HOME && state.feature == Feature.NONE
                                "casino" -> state.feature == Feature.CASINO
                                "bonus" -> state.feature == Feature.BONUSES
                                "sports" -> state.tab in setOf(Tab.LIVE, Tab.SPORTS) &&
                                    state.feature == Feature.NONE
                                else -> false
                            }
                            NavigationBarItem(selected = selected, onClick = {
                                when(destination) {
                                    "menu" -> drawerScope.launch { drawer.open() }
                                    "home" -> model.tab(Tab.HOME)
                                    "casino" -> model.feature(Feature.CASINO)
                                    "bonus" -> model.feature(Feature.BONUSES)
                                    "sports" -> model.tab(Tab.SPORTS)
                                }
                            },
                                icon = { Icon(icon, null, modifier = Modifier.size(22.dp)) },
                                label = { Text(label, fontSize = 10.sp, maxLines = 1,
                                    overflow = TextOverflow.Ellipsis) },
                                alwaysShowLabel = true,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = Palette.blue,
                                    selectedTextColor = Palette.blue,
                                    unselectedIconColor = Color(0xFF9BACB9),
                                    unselectedTextColor = Color(0xFF9BACB9),
                                    indicatorColor = Color.Transparent
                                ))
                        }
                    }
                }
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
                when {
                    state.detail != null || state.detailLoading -> MatchDetailPage(state, model)
                    state.feature != Feature.NONE -> FeaturePage(state, model)
                    state.tab == Tab.HOME -> HomePage(filtered, model) {
                        searchOpen = !searchOpen
                    }
                    state.tab == Tab.LIVE -> CatalogPage(filtered, model, live = true) {
                        searchOpen = !searchOpen
                    }
                    state.tab == Tab.SPORTS -> CatalogPage(filtered, model, live = false) {
                        searchOpen = !searchOpen
                    }
                    state.tab == Tab.BETS -> BetsPage(state, model)
                    state.tab == Tab.WALLET -> WalletPage(state, model)
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
