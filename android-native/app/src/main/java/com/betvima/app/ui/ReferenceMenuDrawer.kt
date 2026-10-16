package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Native left/right gesture drawer matching the reference's dense, dark information architecture. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferenceMenuDrawer(
    state: AppState,
    model: AppViewModel,
    dismiss: () -> Unit,
    openAccount: () -> Unit,
    openLanguage: () -> Unit,
    openAffiliate: () -> Unit
) {
    ModalDrawerSheet(modifier = Modifier.width(306.dp),
        drawerContainerColor = Color(0xFF1B1C20)) {
        Column(Modifier.fillMaxHeight().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())) {
            Row(Modifier.fillMaxWidth().padding(19.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp),
                    color = Palette.green.copy(alpha = .14f)) {
                    Icon(Icons.Default.PersonOutline, null, tint = Palette.green,
                        modifier = Modifier.padding(12.dp).size(25.dp))
                }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text("BETVIMA", color = Color.White,
                        fontWeight = FontWeight.Black, fontSize = 19.sp)
                    Text(if (state.signedIn) tr(state.lang, "My account", "حساب من")
                        else tr(state.lang, "Guest", "مهمان"),
                        color = Color(0xFFABB0BE), fontSize = 11.sp)
                }
                IconButton(onClick = dismiss) {
                    Icon(Icons.Default.Close, tr(state.lang, "Close menu", "بستن منو"),
                        tint = Color.White)
                }
            }
            Surface(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .clickable { dismiss(); openAccount() },
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFF2D3037)) {
                Row(Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccountCircle, null, tint = Palette.green,
                        modifier = Modifier.size(25.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "Profile & account", "پروفایل و حساب"),
                            color = Color.White, fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp)
                        Text(tr(state.lang, "Wallet, tickets & settings",
                            "کیف‌پول، شرط‌ها و تنظیمات"),
                            color = Color(0xFFB3B9C4), fontSize = 10.sp)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = Color.White)
                }
            }
            Spacer(Modifier.height(16.dp))
            DrawerGroup(tr(state.lang, "SPORTS & CASINO", "ورزش و کازینو"))
            DrawerRow(tr(state.lang, "Home", "خانه"), Icons.Default.Home) {
                dismiss(); model.tab(Tab.HOME)
            }
            DrawerRow(tr(state.lang, "Live", "زنده"), Icons.Default.Sensors) {
                dismiss(); model.tab(Tab.LIVE)
            }
            DrawerRow(tr(state.lang, "Upcoming", "آینده"), Icons.Default.Event) {
                dismiss(); model.tab(Tab.SPORTS)
            }
            DrawerRow(tr(state.lang, "TOP Bets", "شرط‌های برتر"),
                Icons.Default.Whatshot) {
                dismiss(); model.homeMode(HomeMode.TOP_BETS)
            }
            DrawerRow(tr(state.lang, "Casino", "کازینو"), Icons.Default.Casino) {
                dismiss(); model.feature(Feature.CASINO)
            }
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = Color.White.copy(alpha = .12f))
            Spacer(Modifier.height(10.dp))
            DrawerGroup(tr(state.lang, "MY BETVIMA", "حساب بت‌ویما"))
            DrawerRow(tr(state.lang, "Wallet", "کیف‌پول"),
                Icons.Default.AccountBalanceWallet) { dismiss(); model.tab(Tab.WALLET) }
            DrawerRow(tr(state.lang, "My bets", "شرط‌های من"),
                Icons.Default.ReceiptLong) { dismiss(); model.tab(Tab.BETS) }
            DrawerRow(tr(state.lang, "Bonuses", "بونوس‌ها"),
                Icons.Default.CardGiftcard) { dismiss(); model.feature(Feature.BONUSES) }
            DrawerRow(tr(state.lang, "VIP Club", "باشگاه VIP"),
                Icons.Default.Star) { dismiss(); model.feature(Feature.VIP) }
            DrawerRow(tr(state.lang, "Affiliate", "همکاری در فروش"),
                Icons.Default.Groups) { dismiss(); openAffiliate() }
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = Color.White.copy(alpha = .12f))
            Spacer(Modifier.height(10.dp))
            DrawerGroup(tr(state.lang, "HELP & SETTINGS", "راهنما و تنظیمات"))
            DrawerRow(tr(state.lang, "24/7 Support", "پشتیبانی ۲۴ ساعته"),
                Icons.Default.SupportAgent) { dismiss(); model.feature(Feature.SUPPORT) }
            DrawerRow(tr(state.lang, "Notifications", "اعلان‌ها"),
                Icons.Default.NotificationsNone) {
                dismiss(); model.feature(Feature.NOTIFICATIONS)
            }
            DrawerRow(tr(state.lang, "Language", "زبان"),
                Icons.Default.Language, if (state.lang == Lang.FA) "فارسی" else "English") {
                dismiss(); openLanguage()
            }
            Spacer(Modifier.height(15.dp))
            Text(tr(state.lang,
                "18+ · Please play responsibly. BetVima uses server-verified results.",
                "۱۸+ · مسئولانه بازی کنید. نتایج از سرور تأیید می‌شوند."),
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                fontSize = 10.sp, lineHeight = 16.sp, color = Color(0xFF9AA4AF))
        }
    }
}

@Composable
private fun DrawerGroup(label: String) {
    Text(label, color = Color(0xFF9CA7B9), fontSize = 10.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
}

@Composable
private fun DrawerRow(label: String, icon: ImageVector, value: String = "",
    action: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 49.dp)
        .clickable(onClick = action)
        .padding(horizontal = 20.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Color(0xFFADB5C4),
            modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = Color.White, fontSize = 13.sp,
            modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
        if (value.isNotBlank()) Text(value, color = Palette.green, fontSize = 11.sp)
        else Icon(Icons.Default.ChevronRight, null,
            tint = Color(0xFF8792A3), modifier = Modifier.size(17.dp))
    }
}
