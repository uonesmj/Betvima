package com.cfcoin.exchange

import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val base = Color(0xFF080D16)
private val panel = Color(0xFF111B2B)
private val blue = Color(0xFF2385FF)
private val pale = Color(0xFF8CC9FF)
private val white = Color(0xFFF2F7FF)
private val dim = Color(0xFF96A9BD)
private val stroke = Color(0xFF26394F)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CFCoinV3App() {
    val pager = rememberPagerState(initialPage = 0, pageCount = { 4 })
    val scope = rememberCoroutineScope()
    var profile by rememberSaveable { mutableStateOf(false) }
    var session by remember { mutableStateOf<LocalAccount?>(null) }
    var popup by rememberSaveable { mutableStateOf("") }
    var query by rememberSaveable { mutableStateOf("") }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var hidden by rememberSaveable { mutableStateOf(false) }
    var filter by rememberSaveable { mutableStateOf(MarketFilter.ALL) }
    var symbol by rememberSaveable { mutableStateOf("BTC") }
    var mode by rememberSaveable { mutableStateOf("اسپات") }
    val stars = remember { mutableStateListOf("BTC", "ETH") }
    val snack = remember { SnackbarHostState() }
    val toPage: (Int) -> Unit = { next -> profile = false; scope.launch { pager.animateScrollToPage(next) } }
    val toTrade: (String, String) -> Unit = { target, tradeMode ->
        symbol = target
        mode = tradeMode
        toPage(2)
    }
    val unavailable: () -> Unit = {
        scope.launch { snack.showSnackbar("قابلیت مالی فعلاً غیرفعال است؛ این نسخه صرفاً آزمایشی است.") }
        Unit
    }
    BackHandler(enabled = profile) { profile = false }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = darkColorScheme(primary = blue, background = base, surface = panel)) {
            Scaffold(
                containerColor = base,
                topBar = {
                    Column(Modifier.background(base)) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                Modifier.size(38.dp)
                                    .background(Brush.linearGradient(listOf(Color(0xFF0053B7), blue, Color(0xFF45CAFF))), RoundedCornerShape(13.dp))
                                    .clip(RoundedCornerShape(13.dp))
                                    .clickable { profile = true },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(if (session == null) Icons.Default.PersonOutline else Icons.Default.Person, "پروفایل", tint = white)
                            }
                            Spacer(Modifier.width(7.dp))
                            Column(
                                Modifier.clickable { profile = true },
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Text("CFCoin", color = white, fontSize = 17.sp, fontWeight = FontWeight.Black)
                                Text(if (session == null) "حساب مهمان" else "پروفایل آزمایشی", color = pale, fontSize = 10.sp)
                            }
                            Spacer(Modifier.weight(1f))
                            Column(horizontalAlignment = Alignment.End) {
                                Text("موجودی", color = dim, fontSize = 10.sp)
                                Text(if (hidden) "••••" else "0.00 USDT", color = white, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            TinyButton(Icons.Default.Visibility, "نمایش/پنهان‌سازی موجودی") { hidden = !hidden }
                            TinyButton(Icons.Default.Search, "جستجو") {
                                profile = false
                                searchOpen = !searchOpen
                                if (searchOpen) toPage(1)
                            }
                            TinyButton(Icons.Default.HeadsetMic, "پشتیبانی") { popup = "پشتیبانی" }
                            TinyButton(Icons.Default.NotificationsNone, "اعلان‌ها") { popup = "اعلان‌ها" }
                        }
                        AnimatedVisibility(searchOpen && !profile) {
                            OutlinedTextField(
                                value = query, onValueChange = { query = it },
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
                                leadingIcon = { Icon(Icons.Default.Search, null, tint = blue) },
                                label = { Text("جستجوی رمزارز") },
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = white, unfocusedTextColor = white,
                                    focusedBorderColor = blue, unfocusedBorderColor = stroke
                                )
                            )
                        }
                        HorizontalDivider(color = stroke, thickness = 0.5.dp)
                    }
                },
                bottomBar = {
                    NavigationBar(containerColor = panel, tonalElevation = 0.dp) {
                        val labels = listOf("خانه", "بازار", "معاملات", "کیف پول")
                        val icons = listOf(Icons.Default.Home, Icons.Default.ShowChart, Icons.Default.SwapHoriz, Icons.Default.AccountBalanceWallet)
                        labels.forEachIndexed { idx, label ->
                            val selected = pager.currentPage == idx && !profile
                            NavigationBarItem(
                                selected = selected,
                                onClick = { toPage(idx) },
                                icon = {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Icon(icons[idx], label, modifier = Modifier.size(23.dp))
                                        Spacer(Modifier.height(3.dp))
                                        Box(
                                            Modifier.size(width = if (selected) 17.dp else 5.dp, height = 2.dp)
                                                .background(if (selected) blue else Color.Transparent, CircleShape)
                                        )
                                    }
                                },
                                label = { Text(label, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = pale, selectedTextColor = pale,
                                    indicatorColor = blue.copy(alpha = 0.14f),
                                    unselectedIconColor = dim, unselectedTextColor = dim
                                )
                            )
                        }
                    }
                },
                snackbarHost = { SnackbarHost(snack) }
            ) { contentPadding ->
                if (profile) {
                    Box(Modifier.fillMaxSize().padding(contentPadding)) { AccountCenter(
                        account = session,
                        onBack = { profile = false },
                        onSignInDemo = { session = it },
                        onLogout = { session = null },
                        onSupport = { popup = "پشتیبانی" }
                    ) }
                } else {
                    HorizontalPager(
                        state = pager,
                        modifier = Modifier.fillMaxSize().padding(contentPadding),
                        beyondViewportPageCount = 1
                    ) { idx ->
                        when (idx) {
                            0, 1 -> ProMarkets(
                                modifier = Modifier.fillMaxSize(),
                                home = idx == 0,
                                filter = filter,
                                onFilter = { filter = it },
                                query = query,
                                stars = stars.toSet(),
                                onStar = { code -> if (stars.contains(code)) stars.remove(code) else stars.add(code) },
                                onTrade = { toTrade(it, "اسپات") },
                                onAction = { feature ->
                                    when (feature) {
                                        "اسپات", "فیوچرز", "مارجین", "تبدیل" -> toTrade(symbol, feature)
                                        "بازار" -> toPage(1)
                                        "دارایی" -> toPage(3)
                                        else -> popup = feature
                                    }
                                },
                                disabled = unavailable
                            )
                            2 -> ProTrade(
                                modifier = Modifier.fillMaxSize(),
                                pair = symbol,
                                mode = mode,
                                onMode = { mode = it },
                                onPair = { popup = "انتخاب جفت‌ارز" },
                                disabled = unavailable
                            )
                            else -> FullWallet(
                                modifier = Modifier.fillMaxSize(),
                                hideBalance = hidden,
                                onUnavailable = unavailable,
                                onOpenProfile = { profile = true }
                            )
                        }
                    }
                }
            }
            if (popup.isNotBlank()) {
                ModalBottomSheet(onDismissRequest = { popup = "" }, containerColor = panel) {
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(13.dp)
                    ) {
                        Text(popup, color = white, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        if (popup == "انتخاب جفت‌ارز") {
                            SAMPLE_MARKETS.forEach { coin ->
                                Row(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                        .clickable { symbol = coin.ticker; popup = "" }
                                        .padding(9.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CryptoLogo(coin.ticker)
                                    Spacer(Modifier.width(10.dp))
                                    Text(coin.ticker + "/USDT", color = white, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.weight(1f))
                                    Text(coin.priceUsdt, color = dim)
                                }
                            }
                        } else {
                            Text(
                                when (popup) {
                                    "اعلان‌ها" -> "در حال حاضر اعلان واقعی موجود نیست."
                                    "پشتیبانی" -> "مرکز پشتیبانی در نسخه بعدی به سامانه مستقل CFCoin متصل می‌شود."
                                    else -> "این بخش هنوز به سرویس واقعی متصل نشده است."
                                },
                                color = dim, fontSize = 13.sp
                            )
                        }
                        Spacer(Modifier.height(28.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun TinyButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, click: () -> Unit) {
    IconButton(onClick = click, modifier = Modifier.size(31.dp)) {
        Icon(icon, contentDescription = label, tint = white, modifier = Modifier.size(19.dp))
    }
}
