package com.betvima.app.ui

import androidx.activity.compose.BackHandler
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BetvimaApp(model: AppViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    var accountOpen by rememberSaveable { mutableStateOf(false) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    val snackbars = remember { SnackbarHostState() }

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
    BackHandler(enabled = state.betDetailVisible || state.showLogin || state.showSlip || state.detail != null ||
        state.feature != Feature.NONE || accountOpen || state.tab != Tab.HOME) {
        when {
            state.betDetailVisible -> model.closeBet()
            state.showLogin -> model.showLogin(false)
            state.showSlip -> model.showSlip(false)
            accountOpen -> accountOpen = false
            state.detail != null -> model.closeMatch()
            state.feature != Feature.NONE -> model.feature(Feature.NONE)
            else -> model.tab(Tab.HOME)
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides
        (if (state.lang == Lang.FA) LayoutDirection.Rtl else LayoutDirection.Ltr)) {
        Scaffold(
            containerColor = Palette.paper,
            topBar = {
                Column {
                    BrandHeader(state.lang,
                        onHome = { model.tab(Tab.HOME) },
                        onLanguage = model::language,
                        onAccount = {
                            if (state.signedIn) accountOpen = true else model.showLogin(true)
                        },
                        onNotifications = { model.feature(Feature.NOTIFICATIONS) },
                        unread = state.notifications.count { it.readAt == null },
                        walletBalance = if (state.signedIn && state.wallet != null)
                            com.betvima.app.data.money(state.wallet!!.availableMinor,
                                state.wallet!!.currency) else null,
                        onWallet = { model.tab(Tab.WALLET) })
                    if (state.detail == null && state.feature == Feature.NONE) {
                        QuickToolbar(state.lang,
                            onSports = { model.tab(Tab.SPORTS) },
                            onSearch = { searchOpen = !searchOpen },
                            onBonus = { model.feature(Feature.BONUSES) },
                            onVip = { model.feature(Feature.VIP) },
                            onSupport = { model.feature(Feature.SUPPORT) },
                            onCasino = { model.feature(Feature.CASINO) })
                        if (searchOpen) {
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
                    if (state.picks.isNotEmpty() && !state.showSlip) {
                        Surface(Modifier.fillMaxWidth()
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                                .clickable { model.showSlip(true) },
                            shape = RoundedCornerShape(14.dp),
                            color = Palette.green, shadowElevation = 7.dp) {
                            Row(Modifier.padding(horizontal = 17.dp, vertical = 11.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ConfirmationNumber, null, tint = Palette.ink)
                                Spacer(Modifier.width(9.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(tr(state.lang, "Bet slip", "برگه شرط"),
                                        color = Palette.ink, fontWeight = FontWeight.Black)
                                    Text(tr(state.lang, "Selections · ", "انتخاب‌ها · ") +
                                        state.picks.size, fontSize = 10.sp, color = Palette.ink)
                                }
                                Surface(color = Palette.ink, shape = RoundedCornerShape(10.dp)) {
                                    Text(state.picks.size.toString(), color = Color.White,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                                        fontWeight = FontWeight.Black)
                                }
                                Spacer(Modifier.width(7.dp))
                                Icon(Icons.Default.KeyboardArrowUp, null, tint = Palette.ink)
                            }
                        }
                    }
                    NavigationBar(containerColor = Palette.ink,
                        tonalElevation = 0.dp) {
                        listOf(
                            Triple(Tab.HOME, tr(state.lang, "Home", "خانه"), Icons.Default.Home),
                            Triple(Tab.LIVE, tr(state.lang, "Live", "زنده"), Icons.Default.Sensors),
                            Triple(Tab.BETS, tr(state.lang, "My Bets", "شرط‌های من"), Icons.Default.ReceiptLong),
                            Triple(Tab.WALLET, tr(state.lang, "Wallet", "کیف‌پول"), Icons.Default.AccountBalanceWallet)
                        ).forEach { (tab, label, icon) ->
                            NavigationBarItem(selected = state.tab == tab, onClick = { model.tab(tab) },
                                icon = { Icon(icon, null, modifier = Modifier.size(22.dp)) },
                                label = { Text(label, fontSize = 10.sp, maxLines = 1,
                                    overflow = TextOverflow.Ellipsis) },
                                alwaysShowLabel = true,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = Palette.ink,
                                    selectedTextColor = Palette.green,
                                    unselectedIconColor = Color(0xFF9BACB9),
                                    unselectedTextColor = Color(0xFF9BACB9),
                                    indicatorColor = Palette.green
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
                    state.tab == Tab.HOME -> HomePage(filtered, model)
                    state.tab == Tab.LIVE -> CatalogPage(filtered, model, live = true)
                    state.tab == Tab.SPORTS -> CatalogPage(filtered, model, live = false)
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

        if (state.showSlip) SlipSheet(state, model)
        if (state.showLogin) LoginSheet(state, model)
        if (state.betDetailVisible) BetReceiptSheet(state, model)
        if (accountOpen) {
            ModalBottomSheet(onDismissRequest = { accountOpen = false },
                containerColor = Palette.paper) {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(horizontal = 17.dp).padding(bottom = 32.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    BvPageBanner(
                        eyebrow = tr(state.lang, "YOUR ACCOUNT", "حساب کاربری"),
                        title = tr(state.lang, "Welcome to BetVima", "به حساب خود خوش آمدید"),
                        subtitle = tr(state.lang,
                            "Your wallet and account features, one tap away.",
                            "کیف‌پول و امکانات حساب شما، تنها با یک لمس."),
                        icon = Icons.Default.PersonOutline
                    ) {
                        if (state.wallet != null) {
                            Spacer(Modifier.height(7.dp))
                            Text(com.betvima.app.data.money(
                                state.wallet!!.availableMinor, state.wallet!!.currency),
                                color = Palette.green, fontSize = 25.sp,
                                fontWeight = FontWeight.Black)
                        }
                    }
                    SectionHeading(tr(state.lang, "Quick access", "دسترسی سریع"),
                        tr(state.lang, "Your account and services", "امکانات و خدمات کاربری"))
                    BvFeatureTile(tr(state.lang, "My profile", "پروفایل من"),
                        tr(state.lang, "Personal details and account status",
                            "اطلاعات شخصی و وضعیت حساب"),
                        Icons.Default.PersonOutline, Palette.blue,
                        onClick = { accountOpen = false; model.feature(Feature.PROFILE) })
                    BvFeatureTile(tr(state.lang, "Wallet", "کیف‌پول"),
                        tr(state.lang, "USD balance and account statement",
                            "موجودی دلاری و گردش حساب"),
                        Icons.Default.AccountBalanceWallet, Palette.green,
                        onClick = { accountOpen = false; model.tab(Tab.WALLET) })
                    BvFeatureTile(tr(state.lang, "My bets", "شرط‌های من"),
                        tr(state.lang, "Review tickets and settlement",
                            "بررسی بلیت‌ها و تسویه‌ها"),
                        Icons.Default.ReceiptLong, Palette.blue,
                        onClick = { accountOpen = false; model.tab(Tab.BETS) })
                    BvFeatureTile(tr(state.lang, "My bonuses", "بونوس‌های من"),
                        tr(state.lang, "Your issued rewards", "پاداش‌های ثبت‌شده"),
                        Icons.Default.CardGiftcard, Palette.gold,
                        onClick = { accountOpen = false; model.feature(Feature.BONUSES) })
                    BvFeatureTile(tr(state.lang, "Support", "پشتیبانی"),
                        tr(state.lang, "Follow your requests and replies",
                            "پیگیری درخواست‌ها و پیام‌ها"),
                        Icons.Default.SupportAgent, Palette.blue,
                        onClick = { accountOpen = false; model.feature(Feature.SUPPORT) })
                    Spacer(Modifier.height(5.dp))
                    OutlinedButton(
                        onClick = { accountOpen = false; model.signOut() },
                        shape = RoundedCornerShape(13.dp),
                        border = BorderStroke(1.dp, Palette.red.copy(alpha = .28f)),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 49.dp)) {
                        Icon(Icons.Default.Logout, null, tint = Palette.red,
                            modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(state.lang, "Sign out", "خروج از حساب"),
                            color = Palette.red, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
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
