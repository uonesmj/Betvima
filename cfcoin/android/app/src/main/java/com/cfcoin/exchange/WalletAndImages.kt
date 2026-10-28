package com.cfcoin.exchange

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val bgColor = Color(0xFF080D16)
private val cardColor = Color(0xFF111B2B)
private val brightBlue = Color(0xFF2385FF)
private val bluePale = Color(0xFF86C6FF)
private val bodyWhite = Color(0xFFF3F7FC)
private val muted = Color(0xFF91A4BB)
private val accentLine = Color(0xFF26394F)

@Composable
fun CryptoLogo(ticker: String, size: Int = 34) {
    val ctx = LocalContext.current
    val icon = remember(ticker) {
        ctx.resources.getIdentifier("crypto_" + ticker.lowercase(java.util.Locale.ROOT), "drawable", ctx.packageName)
    }
    if (icon != 0) {
        Image(
            painter = painterResource(icon), contentDescription = ticker,
            modifier = Modifier.size(size.dp), contentScale = ContentScale.Fit
        )
    } else {
        Box(
            Modifier.size(size.dp).background(brightBlue.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center
        ) { Text(ticker.take(1), color = bluePale, fontWeight = FontWeight.Black, fontSize = (size * 0.47f).sp) }
    }
}

private data class Promo(val headline: String, val subtitle: String, val action: String, val asset: String, val dark: Color, val light: Color)
private val promoItems = listOf(
    Promo("دارایی‌های دیجیتال، آینده روشن", "بازار را حرفه‌ای‌تر دنبال کن", "مشاهده بازار", "₿", Color(0xFF0D2D55), Color(0xFF207BDE)),
    Promo("تجربه معامله هوشمند", "نمودارهای پیشرفته، در یک نگاه", "مشاهده معاملات", "Ξ", Color(0xFF152848), Color(0xFF19559E)),
    Promo("کنترل دارایی با CFCoin", "کیف پول شخصی، شفاف و منظم", "مشاهده کیف پول", "◎", Color(0xFF112D52), Color(0xFF1664BB))
)

@Composable
fun PromoSlider(
    toMarket: () -> Unit,
    toTrade: () -> Unit,
    toWallet: () -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(end = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        items(promoItems.size) { index ->
            val promo = promoItems[index]
            Box(
                Modifier.width(292.dp).height(167.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(promo.dark, promo.light)))
                    .border(1.dp, Color(0xFF3989E1), RoundedCornerShape(18.dp))
                    .clickable {
                        when (index) { 0 -> toMarket(); 1 -> toTrade(); else -> toWallet() }
                    }
            ) {
                Canvas(Modifier.fillMaxSize()) {
                    drawCircle(Color.White.copy(alpha = 0.045f), size.minDimension * 0.58f, Offset(size.width * 0.90f, size.height * 0.15f))
                    drawCircle(Color(0xFF69B9FF).copy(alpha = 0.15f), size.minDimension * 0.48f, Offset(size.width * 0.85f, size.height * 0.69f))
                    drawCircle(Color.White.copy(alpha = 0.06f), size.minDimension * 0.32f, Offset(size.width * 0.55f, size.height * 1.02f))
                    for (i in 0..5) {
                        val yy = size.height * (i + 1) / 7f
                        drawLine(Color.White.copy(alpha = 0.07f), Offset(0f, yy), Offset(size.width, yy), 0.7.dp.toPx())
                    }
                }
                Box(
                    Modifier.size(109.dp).align(Alignment.CenterEnd).offset(x = (-12).dp)
                        .background(Brush.radialGradient(listOf(Color(0xFF65BEFF), Color(0xFF0044AA), Color(0xFF001D52))), CircleShape)
                        .border(2.dp, Color.White.copy(alpha = 0.45f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(promo.asset, color = Color.White, fontSize = 60.sp, fontWeight = FontWeight.Black)
                }
                Column(
                    Modifier.fillMaxSize().padding(18.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("CFCoin", color = Color(0xFFD9EEFF), fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                    Column(Modifier.width(180.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(promo.headline, color = bodyWhite, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                        Text(promo.subtitle, color = Color(0xFFC4E0FD), fontSize = 10.sp)
                    }
                    Text(promo.action + " ‹", color = bodyWhite, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun FullWallet(
    modifier: Modifier,
    hideBalance: Boolean,
    onUnavailable: () -> Unit,
    onOpenProfile: () -> Unit
) {
    var tab by rememberSaveable { mutableStateOf("نمای کلی") }
    var assetsHidden by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 15.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("کیف پول من", color = bodyWhite, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onOpenProfile) {
                Icon(Icons.Default.ManageAccounts, "پروفایل", tint = bluePale)
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("نمای کلی", "اسپات", "فیوچرز", "تأمین وجه").forEach { value ->
                Box(
                    Modifier.clip(RoundedCornerShape(10.dp))
                        .background(if (tab == value) brightBlue.copy(alpha = 0.16f) else cardColor)
                        .border(1.dp, if (tab == value) brightBlue else accentLine, RoundedCornerShape(10.dp))
                        .clickable { tab = value }.padding(horizontal = 13.dp, vertical = 10.dp)
                ) { Text(value, color = if (tab == value) bluePale else muted, fontSize = 12.sp) }
            }
        }
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF143D79), Color(0xFF102445), cardColor)))
                .padding(19.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("مجموع دارایی‌های " + tab, color = Color(0xFFC9E7FF), fontSize = 12.sp)
                Text(if (hideBalance) "•••••• USDT" else "0.00 USDT", color = bodyWhite, fontWeight = FontWeight.Black, fontSize = 30.sp)
                Text("≈ 0 تومان", color = muted, fontSize = 11.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Shield, null, tint = bluePale, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("دارایی واقعی هنوز متصل نیست", color = bluePale, fontSize = 11.sp)
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            WalletShortcut("واریز", Icons.Default.ArrowDownward, Modifier.weight(1f), onUnavailable)
            WalletShortcut("برداشت", Icons.Default.ArrowUpward, Modifier.weight(1f), onUnavailable)
            WalletShortcut("انتقال", Icons.Default.SwapHoriz, Modifier.weight(1f), onUnavailable)
            WalletShortcut("تبدیل", Icons.Default.CurrencyExchange, Modifier.weight(1f), onUnavailable)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("دارایی‌های دیجیتال", color = bodyWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { assetsHidden = !assetsHidden }, modifier = Modifier.size(32.dp)) {
                Icon(if (assetsHidden) Icons.Default.VisibilityOff else Icons.Default.Visibility, "نمایش لیست", tint = muted)
            }
        }
        if (!assetsHidden) {
            listOf("USDT" to "Tether", "BTC" to "Bitcoin", "ETH" to "Ethereum", "SOL" to "Solana", "XRP" to "Ripple", "BNB" to "BNB").forEach { (ticker, name) ->
                Surface(color = cardColor, shape = RoundedCornerShape(14.dp)) {
                    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        CryptoLogo(ticker, 40)
                        Spacer(Modifier.width(11.dp))
                        Column {
                            Text(ticker, color = bodyWhite, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text(name, color = muted, fontSize = 11.sp)
                        }
                        Spacer(Modifier.weight(1f))
                        Column(horizontalAlignment = Alignment.End) {
                            Text(if (hideBalance) "••••" else "0.000000", color = bodyWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text("≈ 0.00 USDT", color = muted, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
        Text("تاریخچه واریز و برداشت", color = bodyWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        TransactionsSection()
        Text("تحلیل مالی حساب", color = bodyWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        FundsGraph()
        CFCoinLegalFooter()
    }
}

@Composable
private fun WalletShortcut(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier,
    click: () -> Unit
) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).clickable { click() }.padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier.size(52.dp).background(cardColor, RoundedCornerShape(14.dp))
                .border(1.dp, accentLine, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) { Icon(icon, title, tint = bluePale, modifier = Modifier.size(23.dp)) }
        Spacer(Modifier.height(7.dp))
        Text(title, color = bodyWhite, fontSize = 12.sp)
    }
}
