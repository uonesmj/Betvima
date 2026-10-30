package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
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
    openAffiliate: () -> Unit,
    openNotifications: () -> Unit
) {
    var sportsShortcutsExpanded by rememberSaveable { mutableStateOf(false) }
    val arrowRotation by animateFloatAsState(
        targetValue = if (sportsShortcutsExpanded) 180f else 0f,
        animationSpec = tween(durationMillis = 220),
        label = "sportsShortcutsArrow"
    )
    ModalDrawerSheet(modifier = Modifier.width(306.dp),
        drawerContainerColor = ThemeTokens.canvas) {
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
                    Text("BETVIMA", color = ThemeTokens.ink,
                        fontWeight = FontWeight.Black, fontSize = 19.sp)
                    Text(if (state.signedIn) tr(state.lang, "My account", "حساب من")
                        else tr(state.lang, "Guest", "مهمان"),
                        color = ThemeTokens.muted, fontSize = 11.sp)
                }
                IconButton(onClick = dismiss) {
                    Icon(Icons.Default.Close, tr(state.lang, "Close menu", "بستن منو"),
                        tint = ThemeTokens.ink)
                }
            }
            Surface(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .clickable { dismiss(); openAccount() },
                shape = RoundedCornerShape(16.dp),
                color = ThemeTokens.panel) {
                Row(Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccountCircle, null, tint = Palette.green,
                        modifier = Modifier.size(25.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "Profile & account", "پروفایل و حساب"),
                            color = ThemeTokens.ink, fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp)
                        Text(tr(state.lang, "Wallet, tickets & settings",
                            "کیف‌پول، شرط‌ها و تنظیمات"),
                            color = ThemeTokens.muted, fontSize = 10.sp)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = ThemeTokens.ink)
                }
            }
            Spacer(Modifier.height(16.dp))
            // Four sportsbook shortcuts collapse independently of the Casino link.
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    .semantics {
                        stateDescription = if (sportsShortcutsExpanded)
                            tr(state.lang, "Expanded", "باز")
                        else tr(state.lang, "Collapsed", "بسته")
                    }
                    .clickable { sportsShortcutsExpanded = !sportsShortcutsExpanded }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    tr(state.lang, "SPORTS & CASINO", "ورزش و کازینو"),
                    color = ThemeTokens.muted, fontSize = 10.sp,
                    fontWeight = FontWeight.Black, modifier = Modifier.weight(1f)
                )
                Icon(
                    Icons.Default.ExpandMore,
                    contentDescription = tr(state.lang, "Toggle sports shortcuts", "باز و بسته کردن گزینه‌های ورزشی"),
                    tint = ThemeTokens.muted,
                    modifier = Modifier.size(20.dp).rotate(arrowRotation)
                )
            }
            AnimatedVisibility(
                visible = sportsShortcutsExpanded,
                enter = expandVertically(animationSpec = tween(220)) + fadeIn(animationSpec = tween(150)),
                exit = shrinkVertically(animationSpec = tween(180)) + fadeOut(animationSpec = tween(120))
            ) {
                Column {
                    DrawerRow(tr(state.lang, "Home", "خانه"), Icons.Default.Home) {
                        dismiss(); model.tab(Tab.HOME)
                    }
                    DrawerRow(tr(state.lang, "Live", "زنده"), Icons.Default.Sensors) {
                        dismiss(); model.tab(Tab.LIVE)
                    }
                    DrawerRow(tr(state.lang, "Upcoming", "آینده"), Icons.Default.Event) {
                        dismiss(); model.tab(Tab.SPORTS)
                    }
                    DrawerRow(tr(state.lang, "TOP Bets", "شرط‌های برتر"), Icons.Default.Whatshot) {
                        dismiss(); model.homeMode(HomeMode.TOP_BETS)
                    }
                }
            }
            // Casino remains a standalone, always-visible destination.
            DrawerRow(tr(state.lang, "Casino", "کازینو"), Icons.Default.Casino) {
                dismiss(); model.feature(Feature.CASINO)
            }
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = ThemeTokens.outline)
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
            HorizontalDivider(color = ThemeTokens.outline)
            Spacer(Modifier.height(10.dp))
            DrawerGroup(tr(state.lang, "HELP & SETTINGS", "راهنما و تنظیمات"))
            DrawerRow(tr(state.lang, "24/7 Support", "پشتیبانی ۲۴ ساعته"),
                Icons.Default.SupportAgent) { dismiss(); model.feature(Feature.SUPPORT) }
            DrawerRow(tr(state.lang, "Notifications", "اعلان‌ها"),
                Icons.Default.NotificationsNone) {
                dismiss(); openNotifications()
            }
            DrawerRow(tr(state.lang, "Language", "زبان"),
                Icons.Default.Language, when(state.lang) { Lang.FA -> "🇮🇷 فارسی"; Lang.TR -> "🇹🇷 Türkçe"; Lang.DARI -> "🇦🇫 دری"; Lang.HY -> "🇦🇲 Հայերեն"; Lang.AR -> "🇸🇦 العربية"; Lang.AZ -> "🇦🇿 Azərbaycan dili"; Lang.RU -> "🇷🇺 Русский"; Lang.EN -> "🇬🇧 English" }, Icons.Default.Settings) {
                openLanguage()
            }
            Spacer(Modifier.height(15.dp))
            Text(tr(state.lang,
                "18+ · Please play responsibly. BetVima uses server-verified results.",
                "۱۸+ · مسئولانه بازی کنید. نتایج از سرور تأیید می‌شوند."),
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                fontSize = 10.sp, lineHeight = 16.sp, color = ThemeTokens.muted)
        }
    }
}

@Composable
private fun DrawerGroup(label: String) {
    Text(label, color = ThemeTokens.muted, fontSize = 10.sp,
        fontWeight = FontWeight.Black,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
}

@Composable
private fun DrawerRow(label: String, icon: ImageVector, value: String = "",
    trailingIcon: ImageVector? = null, action: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 49.dp)
        .clickable(onClick = action)
        .padding(horizontal = 20.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = ThemeTokens.muted,
            modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = ThemeTokens.ink, fontSize = 13.sp,
            modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
        if (value.isNotBlank()) {
            Text(value, color = ThemeTokens.accent, fontSize = 10.sp, maxLines = 1)
            if (trailingIcon != null) {
                Spacer(Modifier.width(9.dp))
                Surface(shape = RoundedCornerShape(9.dp), color = ThemeTokens.accent.copy(alpha = .12f)) {
                    Icon(trailingIcon, null, tint = ThemeTokens.accent,
                        modifier = Modifier.padding(6.dp).size(15.dp))
                }
            }
        } else Icon(Icons.Default.ChevronRight, null,
            tint = ThemeTokens.muted, modifier = Modifier.size(17.dp))
    }
}
