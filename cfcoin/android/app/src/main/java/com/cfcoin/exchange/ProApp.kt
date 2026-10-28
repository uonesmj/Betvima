package com.cfcoin.exchange

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.util.Locale

private val bg = Color(0xFF090A0F)
private val panel = Color(0xFF151921)
private val surface = Color(0xFF101319)
private val line = Color(0xFF292F3A)
private val red = Color(0xFFFF3E55)
private val green = Color(0xFF20C99A)
private val white = Color(0xFFF6F7FA)
private val gray = Color(0xFF929BAA)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CFCoinProApp() {
    var page by rememberSaveable { mutableIntStateOf(0) }
    var filter by rememberSaveable { mutableStateOf(MarketFilter.ALL) }
    var symbol by rememberSaveable { mutableStateOf("BTC") }
    var mode by rememberSaveable { mutableStateOf("اسپات") }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    var sheet by rememberSaveable { mutableStateOf("") }
    var balanceHidden by rememberSaveable { mutableStateOf(false) }
    val stars = remember { mutableStateListOf("BTC", "ETH") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val disabled: () -> Unit = { scope.launch { snackbar.showSnackbar("نسخه نمایشی CFCoin؛ سفارش و انتقال واقعی غیرفعال است.") }; Unit }
    val toTrade: (String, String) -> Unit = { pair, targetMode -> symbol = pair; mode = targetMode; page = 2 }
    val openAction: (String) -> Unit = {
        when (it) {
            "اسپات", "فیوچرز", "مارجین", "تبدیل" -> toTrade(symbol, it)
            "بازار" -> page = 1
            "دارایی" -> page = 3
            else -> sheet = it
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = darkColorScheme(primary = red, background = bg, surface = panel)) {
            Scaffold(
                containerColor = bg,
                topBar = {
                    Column(Modifier.background(bg)) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(36.dp).background(
                                    Brush.linearGradient(listOf(red, Color(0xFF7B1832))),
                                    RoundedCornerShape(12.dp)
                                ), contentAlignment = Alignment.Center
                            ) { Text("CF", color = white, fontSize = 14.sp, fontWeight = FontWeight.Black) }
                            Spacer(Modifier.width(7.dp))
                            Column {
                                Text("CFCoin", color = white, fontSize = 16.sp, fontWeight = FontWeight.Black)
                                Text("EXCHANGE · DEMO", color = red, fontSize = 9.sp)
                            }
                            Spacer(Modifier.weight(1f))
                            Column(horizontalAlignment = Alignment.End) {
                                Text("موجودی کل", color = gray, fontSize = 10.sp)
                                Text(if (balanceHidden) "•••• USDT" else "0.00 USDT", color = white, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            SmallAction(Icons.Default.Visibility, "نمایش موجودی") { balanceHidden = !balanceHidden }
                            SmallAction(Icons.Default.Search, "جستجو") { searchOpen = !searchOpen; if (searchOpen) page = 1 }
                            SmallAction(Icons.Default.HeadsetMic, "پشتیبانی") { sheet = "پشتیبانی" }
                            SmallAction(Icons.Default.NotificationsNone, "اعلان‌ها") { sheet = "اعلان‌ها" }
                        }
                        AnimatedVisibility(searchOpen) {
                            OutlinedTextField(
                                search, { search = it },
                                label = { Text("جستجوی ارز یا جفت‌ارز") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 3.dp),
                                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = red, unfocusedBorderColor = line, focusedTextColor = white, unfocusedTextColor = white)
                            )
                        }
                        HorizontalDivider(color = line)
                    }
                },
                bottomBar = {
                    NavigationBar(containerColor = panel, tonalElevation = 0.dp) {
                        val labels = listOf("خانه", "بازار", "معاملات", "کیف پول")
                        val icons = listOf(Icons.Default.Home, Icons.Default.ShowChart, Icons.Default.SwapHoriz, Icons.Default.AccountBalanceWallet)
                        labels.forEachIndexed { idx, label ->
                            NavigationBarItem(
                                selected = page == idx,
                                onClick = { page = idx },
                                icon = { Icon(icons[idx], label, modifier = Modifier.size(23.dp)) },
                                label = { Text(label, fontSize = 11.sp) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = red, selectedTextColor = red,
                                    indicatorColor = red.copy(alpha = 0.16f),
                                    unselectedIconColor = gray, unselectedTextColor = gray
                                )
                            )
                        }
                    }
                },
                snackbarHost = { SnackbarHost(snackbar) }
            ) { pads ->
                when (page) {
                    0, 1 -> ProMarkets(
                        Modifier.padding(pads), page == 0, filter, { filter = it },
                        search, stars.toSet(),
                        onStar = { token -> if (stars.contains(token)) stars.remove(token) else stars.add(token) },
                        onTrade = { toTrade(it, "اسپات") },
                        onAction = openAction, disabled = disabled
                    )
                    2 -> ProTrade(Modifier.padding(pads), symbol, mode, { mode = it }, { sheet = "انتخاب جفت‌ارز" }, disabled)
                    else -> ProWallet(Modifier.padding(pads), balanceHidden, openAction, disabled)
                }
            }
            if (sheet.isNotBlank()) {
                ModalBottomSheet(onDismissRequest = { sheet = "" }, containerColor = panel) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(sheet, color = white, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        if (sheet == "انتخاب جفت‌ارز") {
                            SAMPLE_MARKETS.forEach { coin ->
                                Row(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).clickable { symbol = coin.ticker; sheet = "" }
                                        .padding(9.dp), verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CoinDot(coin.ticker)
                                    Spacer(Modifier.width(12.dp))
                                    Text(coin.ticker + "/USDT", color = white, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.weight(1f))
                                    Text(coin.priceUsdt, color = gray)
                                }
                            }
                        } else {
                            Text(
                                when (sheet) {
                                    "اعلان‌ها" -> "فعلاً اعلانی وجود ندارد؛ این بخش به حساب واقعی متصل نیست."
                                    "پشتیبانی" -> "چت پشتیبانی در نسخه بعدی فعال می‌شود؛ هیچ پیام شخصی ارسال نمی‌شود."
                                    "P2P" -> "بازار همتابه‌همتا هنوز فعال نیست؛ وجهی جابه‌جا نمی‌شود."
                                    "Earn" -> "محصولات کسب درآمد پس از بررسی قانونی و ریسک اضافه می‌شوند."
                                    "ربات‌ها" -> "ربات‌های معاملاتی در نسخه آزمایشی بعدی توسعه داده می‌شوند."
                                    else -> "این سرویس در نسخه نمایشی هنوز به بک‌اند متصل نیست."
                                }, color = gray, fontSize = 13.sp
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
private fun SmallAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, click: () -> Unit) {
    IconButton(onClick = click, modifier = Modifier.size(31.dp)) {
        Icon(icon, label, tint = white, modifier = Modifier.size(19.dp))
    }
}

@Composable
private fun ProMarkets(
    modifier: Modifier,
    home: Boolean,
    filter: MarketFilter,
    onFilter: (MarketFilter) -> Unit,
    query: String,
    stars: Set<String>,
    onStar: (String) -> Unit,
    onTrade: (String) -> Unit,
    onAction: (String) -> Unit,
    disabled: () -> Unit
) {
    val coins = filterMarkets(SAMPLE_MARKETS, filter, stars, query)
    LazyColumn(
        modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 15.dp, end = 15.dp, top = 16.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (home) {
            item {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("به CFCoin خوش آمدید", color = white, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.weight(1f))
                        DemoPill()
                    }
                    Spacer(Modifier.height(14.dp))
                    Box(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFF702039), Color(0xFF291A27), panel)))
                            .border(1.dp, Color(0xFF85364B), RoundedCornerShape(20.dp))
                            .padding(19.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("ارزش کل دارایی (USDT)", color = Color(0xFFE4C7D0), fontSize = 12.sp)
                            Text("0.00", color = white, fontSize = 30.sp, fontWeight = FontWeight.Black)
                            Text("سود و زیان امروز  +0.00 (0.00%)", color = Color(0xFFD3B4C0), fontSize = 11.sp)
                            Spacer(Modifier.height(10.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("حساب آزمایشی", color = Color(0xFFEAC8D1), fontSize = 11.sp)
                                Spacer(Modifier.weight(1f))
                                Box(
                                    Modifier.background(red, RoundedCornerShape(10.dp))
                                        .clickable { disabled() }
                                        .padding(horizontal = 17.dp, vertical = 9.dp)
                                ) { Text("افزودن وجه", color = white, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                            }
                        }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    QuickTile("خرید سریع", Icons.Default.FlashOn, Modifier.weight(1f)) { onAction("تبدیل") }
                    QuickTile("واریز", Icons.Default.ArrowDownward, Modifier.weight(1f)) { onAction("دارایی") }
                    QuickTile("P2P", Icons.Default.People, Modifier.weight(1f)) { onAction("P2P") }
                    QuickTile("فیوچرز", Icons.Default.ShowChart, Modifier.weight(1f)) { onAction("فیوچرز") }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    QuickTile("برداشت", Icons.Default.ArrowUpward, Modifier.weight(1f), disabled)
                    QuickTile("Earn", Icons.Default.Savings, Modifier.weight(1f)) { onAction("Earn") }
                    QuickTile("ربات‌ها", Icons.Default.SmartToy, Modifier.weight(1f)) { onAction("ربات‌ها") }
                    QuickTile("اسپات", Icons.Default.CandlestickChart, Modifier.weight(1f)) { onAction("اسپات") }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    SAMPLE_MARKETS.take(2).forEach { coin ->
                        Surface(
                            color = panel, shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f).clickable { onTrade(coin.ticker) }
                        ) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CoinDot(coin.ticker)
                                    Spacer(Modifier.width(6.dp))
                                    Text(coin.ticker + "/USDT", color = white, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Text(coin.priceUsdt, color = white, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                                Text(percent(coin.change24h), color = if (coin.change24h >= 0) green else red, fontSize = 12.sp)
                                SparkChart(coin.sparkline, coin.change24h >= 0, Modifier.fillMaxWidth().height(27.dp))
                            }
                        }
                    }
                }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (home) "بازار در یک نگاه" else "بازارهای ارز دیجیتال", color = white, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                DemoPill()
            }
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    MarketFilter.FAVORITES to "مورد علاقه",
                    MarketFilter.GAINERS to "بیشترین رشد",
                    MarketFilter.LOSERS to "بیشترین افت",
                    MarketFilter.ALL to "لیست قیمت‌ها"
                ).forEach { (id, label) -> ProPill(label, id == filter) { onFilter(id) } }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("نام / ارز", color = gray, fontSize = 11.sp)
                Text("قیمت / تغییر ۲۴ ساعت", color = gray, fontSize = 11.sp)
            }
        }
        items(coins, key = { it.ticker }) { coin ->
            Surface(color = surface, shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().clickable { onTrade(coin.ticker) }.padding(horizontal = 9.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CoinDot(coin.ticker)
                    Spacer(Modifier.width(9.dp))
                    Column(modifier = Modifier.widthIn(min = 63.dp)) {
                        Text(coin.ticker + "/USDT", color = white, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text(coin.fullName, color = gray, fontSize = 10.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    SparkChart(coin.sparkline, coin.change24h >= 0, Modifier.size(width = 57.dp, height = 29.dp))
                    Spacer(Modifier.width(7.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Text(coin.priceUsdt, color = white, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Text(percent(coin.change24h), color = if (coin.change24h >= 0) green else red, fontSize = 11.sp)
                    }
                    IconButton(onClick = { onStar(coin.ticker) }, modifier = Modifier.size(31.dp)) {
                        Icon(
                            if (coin.ticker in stars) Icons.Default.Star else Icons.Default.StarBorder,
                            "علاقه‌مندی", tint = if (coin.ticker in stars) red else gray, modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
        if (coins.isEmpty()) item { Text("ارزی پیدا نشد.", color = gray, modifier = Modifier.padding(25.dp)) }
        item { DemoFootnote() }
    }
}

@Composable
private fun QuickTile(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, click: () -> Unit) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).clickable { click() }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(49.dp).background(panel, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, label, tint = red, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(label, color = white, fontSize = 11.sp)
    }
}

@Composable
private fun ProPill(label: String, selected: Boolean, click: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(10.dp))
            .background(if (selected) red.copy(alpha = 0.16f) else panel)
            .border(1.dp, if (selected) red else line, RoundedCornerShape(10.dp))
            .clickable { click() }.padding(horizontal = 12.dp, vertical = 10.dp)
    ) { Text(label, color = if (selected) red else gray, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal, fontSize = 12.sp) }
}

@Composable
private fun DemoPill() {
    Box(Modifier.background(red.copy(alpha = 0.14f), RoundedCornerShape(7.dp)).padding(horizontal = 8.dp, vertical = 5.dp)) {
        Text("DEMO", color = red, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun DemoFootnote() {
    Text(
        "CFCoin v0.2 — قیمت‌ها و نمودارها نمایشی‌اند؛ هیچ معامله یا انتقال واقعی انجام نمی‌شود.",
        color = gray, fontSize = 11.sp, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp)
    )
}

@Composable
private fun CoinDot(ticker: String) {
    val color = when (ticker) {
        "BTC" -> Color(0xFFFFAA3B)
        "ETH" -> Color(0xFF8CA0EA)
        "SOL" -> Color(0xFFB08EE8)
        else -> red
    }
    Box(Modifier.size(34.dp).background(color.copy(alpha = 0.16f), CircleShape), contentAlignment = Alignment.Center) {
        Text(ticker.take(1), color = color, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SparkChart(points: List<Float>, up: Boolean, modifier: Modifier) {
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val min = points.minOrNull() ?: return@Canvas
        val max = points.maxOrNull() ?: return@Canvas
        val range = (max - min).coerceAtLeast(0.01f)
        val path = Path()
        points.forEachIndexed { i, value ->
            val x = size.width * i / (points.size - 1)
            val y = size.height * (0.92f - 0.84f * (value - min) / range)
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, if (up) green else red, style = Stroke(1.8.dp.toPx()))
    }
}

private fun percent(value: Double): String =
    (if (value >= 0) "+" else "") + String.format(Locale.US, "%.2f", value) + "%"
