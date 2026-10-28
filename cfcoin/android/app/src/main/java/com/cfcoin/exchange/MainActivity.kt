package com.cfcoin.exchange

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val Ink = Color(0xFF070A0D)
private val Panel = Color(0xFF12191F)
private val Border = Color(0xFF29343C)
private val Accent = Color(0xFF00D6A0)
private val White = Color(0xFFF4F7F8)
private val Muted = Color(0xFF8D9CA7)
private val Red = Color(0xFFFF6F80)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(7, 10, 13)
        window.navigationBarColor = android.graphics.Color.rgb(18, 25, 31)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Accent, background = Ink, surface = Panel)) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    CFCoinApp()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CFCoinApp() {
    var page by rememberSaveable { mutableIntStateOf(0) }
    var tab by rememberSaveable { mutableStateOf(MarketFilter.ALL) }
    var pair by rememberSaveable { mutableStateOf("BTC") }
    var searchVisible by rememberSaveable { mutableStateOf(false) }
    var search by rememberSaveable { mutableStateOf("") }
    var sheet by remember { mutableStateOf("") }
    val favorites = remember { mutableStateListOf("BTC", "ETH") }
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val showUnavailable: () -> Unit = {
        scope.launch { snack.showSnackbar("نسخه اولیه: تراکنش واقعی و حساب کاربری هنوز فعال نیست.") }
        Unit
    }

    Scaffold(
        containerColor = Ink,
        topBar = {
            Column {
                TopHeader(
                    notifications = { sheet = "notification" },
                    support = { sheet = "support" },
                    search = { searchVisible = !searchVisible }
                )
                AnimatedVisibility(searchVisible) {
                    OutlinedTextField(
                        search, { search = it },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
                        label = { Text("جستجوی ارز") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Accent,
                            unfocusedBorderColor = Border,
                            focusedTextColor = White,
                            unfocusedTextColor = White
                        )
                    )
                }
                HorizontalDivider(color = Border, thickness = 0.5.dp)
            }
        },
        bottomBar = {
            NavigationBar(containerColor = Panel, tonalElevation = 0.dp) {
                val labels = listOf("خانه", "بازار", "معاملات", "کیف پول")
                val icons = listOf(Icons.Default.Home, Icons.Default.ShowChart, Icons.Default.SwapHoriz, Icons.Default.AccountBalanceWallet)
                labels.forEachIndexed { index, label ->
                    NavigationBarItem(
                        selected = page == index,
                        onClick = { page = index },
                        icon = { Icon(icons[index], contentDescription = label, modifier = Modifier.size(23.dp)) },
                        label = { Text(label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Accent, selectedTextColor = Accent,
                            indicatorColor = Color(0xFF144238),
                            unselectedIconColor = Muted, unselectedTextColor = Muted
                        )
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snack) }
    ) { padding ->
        when (page) {
            0, 1 -> MarketPage(
                modifier = Modifier.padding(padding),
                home = page == 0,
                selectedTab = tab,
                onTab = { tab = it },
                favorites = favorites.toSet(),
                search = search,
                onStar = { ticker -> if (ticker in favorites) favorites.remove(ticker) else favorites.add(ticker) },
                onTrade = { coin -> pair = coin.ticker; page = 2 }
            )
            2 -> TradePage(
                modifier = Modifier.padding(padding),
                coin = SAMPLE_MARKETS.firstOrNull { it.ticker == pair } ?: SAMPLE_MARKETS.first(),
                unavailable = showUnavailable
            )
            else -> WalletPage(Modifier.padding(padding), showUnavailable)
        }
    }

    if (sheet.isNotEmpty()) {
        ModalBottomSheet(
            onDismissRequest = { sheet = "" },
            containerColor = Panel,
            dragHandle = { BottomSheetDefaults.DragHandle(color = Muted) }
        ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp)) {
                Text(if (sheet == "support") "پشتیبانی CFCoin" else "اعلان‌ها", color = White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(14.dp))
                Text(
                    if (sheet == "support") "پشتیبانی آنلاین در نسخه بعدی متصل خواهد شد."
                    else "فعلاً اعلانی وجود ندارد.",
                    color = Muted
                )
                Spacer(Modifier.height(6.dp))
                Text("این نسخه فقط پیش‌نمایش اپلیکیشن است؛ داده‌ای ارسال نمی‌شود.", color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(40.dp))
            }
        }
    }
}

@Composable
private fun TopHeader(notifications: () -> Unit, support: () -> Unit, search: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Ink).padding(horizontal = 9.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(33.dp).background(Color(0xFF16493B), CircleShape), contentAlignment = Alignment.Center) {
            Text("C", color = Accent, fontSize = 23.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(6.dp))
        Column {
            Text("CFCoin", color = White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            Text("نسخه اولیه", color = Accent, fontSize = 10.sp)
        }
        Spacer(Modifier.weight(1f))
        Column(horizontalAlignment = Alignment.End) {
            Text("موجودی", color = Muted, fontSize = 10.sp)
            Text("0.00 USDT", color = White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        HeaderButton(Icons.Default.Search, "جستجو", search)
        HeaderButton(Icons.Default.HeadsetMic, "پشتیبانی", support)
        HeaderButton(Icons.Default.NotificationsNone, "اعلان‌ها", notifications)
    }
}

@Composable
private fun HeaderButton(icon: androidx.compose.ui.graphics.vector.ImageVector, name: String, click: () -> Unit) {
    IconButton(onClick = click, modifier = Modifier.size(36.dp)) {
        Icon(icon, contentDescription = name, tint = White, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun MarketPage(
    modifier: Modifier,
    home: Boolean,
    selectedTab: MarketFilter,
    onTab: (MarketFilter) -> Unit,
    favorites: Set<String>,
    search: String,
    onStar: (String) -> Unit,
    onTrade: (MarketCoin) -> Unit
) {
    val marketList = filterMarkets(SAMPLE_MARKETS, selectedTab, favorites, search)
    LazyColumn(
        modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (home) {
            item {
                Column {
                    Text("به CFCoin خوش آمدید", color = White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(5.dp))
                    Text("صرافی دیجیتال شما", color = Muted, fontSize = 13.sp)
                    Spacer(Modifier.height(16.dp))
                    Surface(shape = RoundedCornerShape(20.dp), color = Color(0xFF10372E)) {
                        Column(Modifier.fillMaxWidth().padding(19.dp)) {
                            Text("ارزش کل دارایی", color = Color(0xFFBEDFD6), fontSize = 12.sp)
                            Spacer(Modifier.height(7.dp))
                            Text("0.00 USDT", color = White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            Text("موجودی واقعی متصل نشده است", color = Color(0xFFBEDFD6), fontSize = 11.sp)
                        }
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(top = 12.dp)) {
                Text(if (home) "بازار در یک نگاه" else "بازار ارزهای دیجیتال", color = White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(5.dp))
                Text("قیمت‌ها نمونه هستند، نه داده لحظه‌ای.", color = Muted, fontSize = 11.sp)
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                listOf(
                    MarketFilter.FAVORITES to "مورد علاقه",
                    MarketFilter.GAINERS to "بیشترین رشد",
                    MarketFilter.LOSERS to "بیشترین افت",
                    MarketFilter.ALL to "لیست قیمت‌ها"
                ).forEach { (filter, name) ->
                    val active = filter == selectedTab
                    Box(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .background(if (active) Color(0xFF144238) else Panel)
                            .border(1.dp, if (active) Accent else Border, RoundedCornerShape(12.dp))
                            .clickable { onTab(filter) }
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(name, color = if (active) Accent else Muted, fontSize = 12.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium)
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("ارز", color = Muted, fontSize = 11.sp)
                Text("قیمت / تغییر ۲۴ساعت", color = Muted, fontSize = 11.sp)
            }
        }
        items(marketList, key = { it.ticker }) { coin ->
            MarketRow(coin, coin.ticker in favorites, { onStar(coin.ticker) }, { onTrade(coin) })
        }
        if (marketList.isEmpty()) {
            item { Text("ارزی یافت نشد.", color = Muted, modifier = Modifier.padding(24.dp)) }
        }
        item {
            Text(
                "CFCoin 0.1 • پیش‌نمایش رابط کاربری",
                color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
            )
        }
    }
}

@Composable
private fun MarketRow(coin: MarketCoin, starred: Boolean, star: () -> Unit, trade: () -> Unit) {
    Surface(
        color = Panel,
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).clickable { trade() }
    ) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            CoinBadge(coin.ticker)
            Spacer(Modifier.width(7.dp))
            Column(modifier = Modifier.widthIn(min = 62.dp)) {
                Text(coin.ticker + "/USDT", color = White, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(coin.fullName, color = Muted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.weight(1f))
            Spark(coin.sparkline, coin.change24h >= 0, Modifier.size(width = 65.dp, height = 34.dp))
            Spacer(Modifier.width(7.dp))
            Column(modifier = Modifier.widthIn(min = 66.dp), horizontalAlignment = Alignment.End) {
                Text(coin.priceUsdt, color = White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                Text(
                    (if (coin.change24h >= 0) "+" else "") +
                        "%.2f".format(java.util.Locale.US, coin.change24h) + "%",
                    color = if (coin.change24h >= 0) Accent else Red, fontSize = 11.sp
                )
            }
            IconButton(onClick = star, modifier = Modifier.size(28.dp)) {
                Icon(
                    if (starred) Icons.Default.Star else Icons.Default.StarBorder,
                    contentDescription = "علاقه‌مندی",
                    tint = if (starred) Accent else Muted,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun CoinBadge(symbol: String) {
    val color = when (symbol) {
        "BTC" -> Color(0xFFE9A23A)
        "ETH" -> Color(0xFF8596F5)
        "SOL" -> Color(0xFFAF76F3)
        else -> Accent
    }
    Box(Modifier.size(34.dp).background(color.copy(alpha = 0.18f), CircleShape), contentAlignment = Alignment.Center) {
        Text(symbol.take(1), color = color, fontSize = 16.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun Spark(values: List<Float>, upward: Boolean, modifier: Modifier) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val lo = values.minOrNull() ?: return@Canvas
        val hi = values.maxOrNull() ?: return@Canvas
        val span = (hi - lo).coerceAtLeast(0.01f)
        val path = Path()
        values.forEachIndexed { index, point ->
            val x = size.width * index / (values.size - 1)
            val y = size.height * (0.95f - 0.90f * (point - lo) / span)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, if (upward) Accent else Red, style = Stroke(2.dp.toPx()))
    }
}

@Composable
private fun TradePage(modifier: Modifier, coin: MarketCoin, unavailable: () -> Unit) {
    var buy by rememberSaveable { mutableStateOf(true) }
    var limit by rememberSaveable { mutableStateOf(true) }
    var amount by rememberSaveable { mutableStateOf("") }
    var price by remember(coin.ticker) { mutableStateOf(coin.priceUsdt) }
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(coin.ticker + "/USDT", color = White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                Text("معاملات اسپات • آزمایشی", color = Muted, fontSize = 11.sp)
            }
            Spacer(Modifier.weight(1f))
            Text(coin.priceUsdt, color = Accent, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        }
        Surface(color = Panel, shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("نمودار بازار (نمونه)", color = White, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))
                Spark(coin.sparkline, coin.change24h >= 0, Modifier.fillMaxWidth().height(150.dp))
                Spacer(Modifier.height(12.dp))
                Text("نمودار به API بازار متصل نیست.", color = Muted, fontSize = 11.sp)
            }
        }
        Text("ثبت سفارش", color = White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectPill("خرید", buy, Accent, Modifier.weight(1f)) { buy = true }
            SelectPill("فروش", !buy, Red, Modifier.weight(1f)) { buy = false }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectPill("Limit", limit, Accent, Modifier.weight(1f)) { limit = true }
            SelectPill("Market", !limit, Accent, Modifier.weight(1f)) { limit = false }
        }
        if (limit) Entry(price, { price = it.take(24) }, "قیمت (USDT)")
        Entry(amount, { amount = it.take(24) }, "مقدار (" + coin.ticker + ")")
        Text("موجودی قابل معامله: 0.00 USDT", color = Muted, fontSize = 12.sp)
        Button(
            onClick = unavailable,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(13.dp),
            colors = ButtonDefaults.buttonColors(containerColor = if (buy) Accent else Red)
        ) {
            Text((if (buy) "خرید " else "فروش ") + coin.ticker + " (غیرفعال)", color = Color.Black, fontWeight = FontWeight.Bold)
        }
        Text("در این نسخه سفارشی ثبت نمی‌شود و پولی جابه‌جا نمی‌شود.", color = Muted, fontSize = 11.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    }
}

@Composable
private fun SelectPill(name: String, selected: Boolean, color: Color, modifier: Modifier = Modifier, select: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp))
            .background(if (selected) color.copy(alpha = 0.16f) else Panel)
            .border(1.dp, if (selected) color else Border, RoundedCornerShape(12.dp))
            .clickable { select() }.padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(name, color = if (selected) color else Muted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Entry(value: String, change: (String) -> Unit, label: String) {
    OutlinedTextField(
        value, change, label = { Text(label) },
        modifier = Modifier.fillMaxWidth(), singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Accent, unfocusedBorderColor = Border,
            focusedTextColor = White, unfocusedTextColor = White
        )
    )
}

@Composable
private fun WalletPage(modifier: Modifier, unavailable: () -> Unit) {
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("کیف پول من", color = White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Surface(color = Color(0xFF10372E), shape = RoundedCornerShape(19.dp)) {
            Column(Modifier.fillMaxWidth().padding(20.dp)) {
                Text("مجموع دارایی", color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                Text("0.00 USDT", color = White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text("هیچ کیف پول واقعی متصل نشده است", color = Color(0xFFB9DED1), fontSize = 11.sp)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            WalletAction("واریز", Icons.Default.ArrowDownward, Modifier.weight(1f), unavailable)
            WalletAction("برداشت", Icons.Default.ArrowUpward, Modifier.weight(1f), unavailable)
            WalletAction("انتقال", Icons.Default.SwapHoriz, Modifier.weight(1f), unavailable)
        }
        Text("دارایی‌ها", color = White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        listOf("USDT" to "Tether", "BTC" to "Bitcoin", "ETH" to "Ethereum").forEach { (symbol, name) ->
            Surface(color = Panel, shape = RoundedCornerShape(15.dp)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    CoinBadge(symbol)
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(symbol, color = White, fontWeight = FontWeight.Bold)
                        Text(name, color = Muted, fontSize = 11.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    Text("0.00", color = White, fontWeight = FontWeight.Bold)
                }
            }
        }
        Text("حساب آزمایشی، بدون امکان واریز یا برداشت واقعی", color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun WalletAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        color = Panel,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.clip(RoundedCornerShape(14.dp)).clickable { onClick() }
    ) {
        Column(
            Modifier.padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Icon(icon, contentDescription = label, tint = Accent, modifier = Modifier.size(22.dp))
            Text(label, color = White, fontSize = 12.sp)
        }
    }
}
