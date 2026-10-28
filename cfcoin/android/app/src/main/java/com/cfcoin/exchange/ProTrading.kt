package com.cfcoin.exchange

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

private val tradingBG = Color(0xFF090A0F)
private val tradingPanel = Color(0xFF151921)
private val tradingSurface = Color(0xFF101319)
private val tradingBorder = Color(0xFF292F3A)
private val tradingRed = Color(0xFFFF3E55)
private val tradingGreen = Color(0xFF20C99A)
private val tradingWhite = Color(0xFFF6F7FA)
private val tradingGray = Color(0xFF929BAA)

@Composable
fun ProTrade(
    modifier: Modifier,
    pair: String,
    mode: String,
    onMode: (String) -> Unit,
    onPair: () -> Unit,
    disabled: () -> Unit
) {
    val coin = SAMPLE_MARKETS.firstOrNull { it.ticker == pair } ?: SAMPLE_MARKETS.first()
    var action by rememberSaveable { mutableStateOf("خرید") }
    var orderType by rememberSaveable { mutableStateOf("Limit") }
    var timeframe by rememberSaveable { mutableStateOf("1H") }
    var amount by rememberSaveable { mutableStateOf("") }
    var price by remember(coin.ticker) { mutableStateOf(coin.priceUsdt.replace(",", "")) }
    var leverage by rememberSaveable { mutableIntStateOf(5) }
    var cross by rememberSaveable { mutableStateOf(false) }
    var tpSl by rememberSaveable { mutableStateOf(false) }
    val futures = mode == "فیوچرز"
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 15.dp, vertical = 13.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("اسپات", "فیوچرز", "مارجین", "تبدیل").forEach {
                TradeChip(it, it == mode) { onMode(it) }
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.clip(RoundedCornerShape(9.dp)).clickable { onPair() }.padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(coin.ticker + "/USDT", fontSize = 21.sp, color = tradingWhite, fontWeight = FontWeight.ExtraBold)
                Icon(Icons.Default.KeyboardArrowDown, "انتخاب بازار", tint = tradingGray)
            }
            Spacer(Modifier.weight(1f))
            Text("DEMO", color = tradingRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(coin.priceUsdt, color = if (coin.change24h >= 0) tradingGreen else tradingRed, fontSize = 27.sp, fontWeight = FontWeight.Black)
                Text("قیمت نمایشی · USDT", color = tradingGray, fontSize = 11.sp)
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text("تغییرات ۲۴ ساعت", color = tradingGray, fontSize = 11.sp)
                Text(
                    (if (coin.change24h >= 0) "+" else "") + String.format(Locale.US, "%.2f", coin.change24h) + "%",
                    color = if (coin.change24h >= 0) tradingGreen else tradingRed, fontWeight = FontWeight.Bold
                )
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("15M", "1H", "4H", "1D", "1W").forEach { tf ->
                TradeChip(tf, timeframe == tf) { timeframe = tf }
            }
        }
        ExampleCandleChart(coin, Modifier.fillMaxWidth().height(182.dp))
        if (mode == "مارجین" || mode == "تبدیل") {
            Surface(color = tradingPanel, shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    Text(if (mode == "مارجین") "معاملات مارجین" else "تبدیل فوری", color = tradingWhite, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text(
                        if (mode == "مارجین") "وام، وثیقه و معاملات مارجین در نسخه نمایشی فقط در سطح رابط کاربری خواهند بود."
                        else "سیستم تبدیل ارز و قیمت‌گذاری واقعی در نسخه بعدی متصل خواهد شد.",
                        color = tradingGray, fontSize = 13.sp
                    )
                    TradeActionButton("این قابلیت هنوز فعال نیست", tradingRed, disabled)
                }
            }
        } else {
            if (futures) {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    TradeChip(if (cross) "Cross" else "Isolated", true) { cross = !cross }
                    listOf(3, 5, 10, 20).forEach { value ->
                        TradeChip(value.toString() + "x", leverage == value) { leverage = value }
                    }
                }
                Text("فیوچرز آزمایشی است؛ اهرم انتخاب‌شده هیچ معامله‌ای اجرا نمی‌کند.", color = tradingRed, fontSize = 11.sp)
            }
            ExampleOrderBook(coin)
            Text("ثبت سفارش " + if (futures) "فیوچرز" else "اسپات", color = tradingWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                TradeSide(if (futures) "Long" else "خرید", action == "خرید", tradingGreen, Modifier.weight(1f)) { action = "خرید" }
                TradeSide(if (futures) "Short" else "فروش", action == "فروش", tradingRed, Modifier.weight(1f)) { action = "فروش" }
            }
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Limit", "Market", "Stop-Limit").forEach {
                    TradeChip(it, it == orderType) { orderType = it }
                }
            }
            if (orderType != "Market") TradeNumberInput("قیمت (USDT)", price) { price = it.take(24) }
            TradeNumberInput("مقدار (" + coin.ticker + ")", amount) { amount = it.take(24) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("25%", "50%", "75%", "100%").forEach { share ->
                    Box(
                        Modifier.weight(1f).background(tradingPanel, RoundedCornerShape(8.dp)).clickable { disabled() }.padding(vertical = 9.dp),
                        contentAlignment = Alignment.Center
                    ) { Text(share, color = tradingGray, fontSize = 11.sp) }
                }
            }
            if (futures) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = tpSl, onCheckedChange = { tpSl = it },
                        colors = CheckboxDefaults.colors(checkedColor = tradingRed)
                    )
                    Text("فعال‌کردن پیش‌نمایش حد سود / حد ضرر", color = tradingGray, fontSize = 12.sp)
                }
                if (tpSl) {
                    TradeNumberInput("حد سود (USDT)", "") { disabled() }
                    TradeNumberInput("حد ضرر (USDT)", "") { disabled() }
                }
            }
            Text("موجودی قابل استفاده: 0.00 USDT", color = tradingGray, fontSize = 12.sp)
            TradeActionButton(
                (if (futures) (if (action == "خرید") "Long" else "Short") else action + " " + coin.ticker) + " · غیرفعال",
                if (action == "خرید") tradingGreen else tradingRed,
                disabled
            )
            Surface(color = tradingSurface, shape = RoundedCornerShape(13.dp)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(if (futures) "پوزیشن‌های باز (0)" else "سفارش‌های باز (0)", color = tradingWhite, fontWeight = FontWeight.Bold)
                    Text("هیچ سفارشی ثبت نشده است.", color = tradingGray, fontSize = 12.sp)
                }
            }
        }
        Text(
            "داده‌ها نمونه‌اند؛ سفارش، تسویه، واریز و برداشت واقعی غیرفعال هستند.",
            color = tradingGray, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun TradeChip(name: String, active: Boolean, click: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(10.dp))
            .background(if (active) tradingRed.copy(alpha = 0.17f) else tradingPanel)
            .border(1.dp, if (active) tradingRed else tradingBorder, RoundedCornerShape(10.dp))
            .clickable { click() }.padding(horizontal = 12.dp, vertical = 10.dp)
    ) { Text(name, color = if (active) tradingRed else tradingGray, fontSize = 12.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal) }
}

@Composable
private fun TradeSide(name: String, active: Boolean, tint: Color, modifier: Modifier, click: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp))
            .background(if (active) tint.copy(alpha = 0.17f) else tradingPanel)
            .border(1.dp, if (active) tint else tradingBorder, RoundedCornerShape(12.dp))
            .clickable { click() }.padding(vertical = 13.dp),
        contentAlignment = Alignment.Center
    ) { Text(name, color = if (active) tint else tradingGray, fontWeight = FontWeight.Bold) }
}

@Composable
private fun TradeNumberInput(name: String, value: String, update: (String) -> Unit) {
    OutlinedTextField(
        value, update,
        label = { Text(name, fontSize = 12.sp) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = tradingRed, unfocusedBorderColor = tradingBorder,
            focusedTextColor = tradingWhite, unfocusedTextColor = tradingWhite
        )
    )
}

@Composable
private fun TradeActionButton(name: String, color: Color, click: () -> Unit) {
    Button(
        onClick = click,
        modifier = Modifier.fillMaxWidth().height(53.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color)
    ) { Text(name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
}

@Composable
private fun ExampleOrderBook(coin: MarketCoin) {
    val center = coin.priceUsdt.replace(",", "").toDoubleOrNull() ?: 100.0
    Surface(color = tradingSurface, shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row {
                Text("دفتر سفارشات · نمونه", color = tradingWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(Modifier.weight(1f))
                Text("قیمت / مقدار", color = tradingGray, fontSize = 11.sp)
            }
            repeat(3) { idx ->
                Row {
                    Text(String.format(Locale.US, "%.3f", center * (1.002 + (2 - idx) * 0.0005)), color = tradingRed, fontSize = 11.sp)
                    Spacer(Modifier.weight(1f))
                    Text(String.format(Locale.US, "%.4f", 0.12 + idx * 0.13), color = tradingWhite, fontSize = 11.sp)
                }
            }
            HorizontalDivider(color = tradingBorder)
            Text(coin.priceUsdt + " USDT", color = if (coin.change24h >= 0) tradingGreen else tradingRed, fontWeight = FontWeight.Bold)
            HorizontalDivider(color = tradingBorder)
            repeat(3) { idx ->
                Row {
                    Text(String.format(Locale.US, "%.3f", center * (0.999 - idx * 0.0005)), color = tradingGreen, fontSize = 11.sp)
                    Spacer(Modifier.weight(1f))
                    Text(String.format(Locale.US, "%.4f", 0.2 + idx * 0.1), color = tradingWhite, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun ExampleCandleChart(coin: MarketCoin, modifier: Modifier) {
    Surface(color = tradingSurface, shape = RoundedCornerShape(15.dp), modifier = modifier) {
        Box(Modifier.fillMaxSize().padding(12.dp)) {
            Canvas(Modifier.fillMaxSize()) {
                for (i in 1..3) {
                    val y = size.height * i / 4
                    drawLine(tradingBorder, Offset(0f, y), Offset(size.width, y), 1.dp.toPx())
                }
                val values = coin.sparkline
                if (values.size < 3) return@Canvas
                val lo = values.minOrNull() ?: 0f
                val hi = values.maxOrNull() ?: 1f
                val range = (hi - lo).coerceAtLeast(0.01f)
                val slot = size.width / (values.size + 1)
                fun getY(p: Float) = size.height * (0.9f - ((p - lo) / range) * 0.78f)
                for (i in 1 until values.size) {
                    val open = values[i - 1]
                    val close = values[i]
                    val x = slot * (i + 0.3f)
                    val color = if (close >= open) tradingGreen else tradingRed
                    drawLine(
                        color, Offset(x, getY(minOf(open, close) - 0.12f)),
                        Offset(x, getY(maxOf(open, close) + 0.12f)), 1.3.dp.toPx()
                    )
                    drawRect(
                        color,
                        topLeft = Offset(x - slot * 0.24f, minOf(getY(open), getY(close))),
                        size = Size(slot * 0.48f, kotlin.math.abs(getY(open) - getY(close)).coerceAtLeast(3.dp.toPx()))
                    )
                }
            }
            Text("نمودار نمایشی", color = tradingGray, fontSize = 10.sp, modifier = Modifier.align(Alignment.TopEnd))
        }
    }
}

@Composable
fun ProWallet(modifier: Modifier, hidden: Boolean, openAction: (String) -> Unit, disabled: () -> Unit) {
    var tab by rememberSaveable { mutableStateOf("نمای کلی") }
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("کیف پول CFCoin", color = tradingWhite, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("نمای کلی", "اسپات", "فیوچرز", "تأمین وجه").forEach {
                TradeChip(it, it == tab) { tab = it }
            }
        }
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF702039), Color(0xFF231A26), tradingPanel)))
                .padding(19.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("مجموع دارایی (USDT)", color = Color(0xFFE4C5D0), fontSize = 12.sp)
                Text(if (hidden) "••••••" else "0.00", color = tradingWhite, fontWeight = FontWeight.Black, fontSize = 29.sp)
                Text("سود / زیان روزانه: 0.00 (0.00%)", color = Color(0xFFE1BBC9), fontSize = 11.sp)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            WalletTile("واریز", Icons.Default.ArrowDownward, Modifier.weight(1f), disabled)
            WalletTile("برداشت", Icons.Default.ArrowUpward, Modifier.weight(1f), disabled)
            WalletTile("انتقال", Icons.Default.SwapHoriz, Modifier.weight(1f), disabled)
            WalletTile("تبدیل", Icons.Default.CurrencyExchange, Modifier.weight(1f)) { openAction("تبدیل") }
        }
        Surface(color = tradingPanel, shape = RoundedCornerShape(13.dp)) {
            Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Shield, null, tint = tradingRed)
                Spacer(Modifier.width(9.dp))
                Column {
                    Text("حساب آزمایشی", color = tradingWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text("هیچ دارایی، بانک یا کیف پول واقعی متصل نیست.", color = tradingGray, fontSize = 11.sp)
                }
            }
        }
        Text("دارایی‌های " + tab, color = tradingWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        listOf("USDT" to "Tether", "BTC" to "Bitcoin", "ETH" to "Ethereum", "SOL" to "Solana").forEach { (code, full) ->
            Surface(color = tradingSurface, shape = RoundedCornerShape(13.dp)) {
                Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(35.dp).background(tradingRed.copy(alpha = 0.14f), CircleShape), contentAlignment = Alignment.Center) {
                        Text(code.take(1), color = tradingRed, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(code, color = tradingWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(full, color = tradingGray, fontSize = 11.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (hidden) "••••" else "0.000000", color = tradingWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("≈ 0.00 USDT", color = tradingGray, fontSize = 11.sp)
                    }
                }
            }
        }
        Text("تاریخچه تراکنش‌ها", color = tradingWhite, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.fillMaxWidth().background(tradingPanel, RoundedCornerShape(13.dp)).padding(25.dp), contentAlignment = Alignment.Center) {
            Text("تراکنشی ثبت نشده است.", color = tradingGray, fontSize = 12.sp)
        }
        Text(
            "CFCoin v0.2 · نسخه نمایشی بدون انتقال پول واقعی",
            modifier = Modifier.fillMaxWidth(), color = tradingGray, fontSize = 11.sp, textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun WalletTile(
    title: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier, click: () -> Unit
) {
    Column(
        modifier.clip(RoundedCornerShape(13.dp)).clickable { click() }.padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.size(50.dp).background(tradingPanel, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, title, tint = tradingRed, modifier = Modifier.size(21.dp))
        }
        Spacer(Modifier.height(7.dp))
        Text(title, color = tradingWhite, fontSize = 11.sp)
    }
}
