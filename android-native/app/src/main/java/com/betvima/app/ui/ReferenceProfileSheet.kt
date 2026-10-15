package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.money

/**
 * Real account sheet closely following the reference grouped-grey-cards layout.
 * No invented account ID / promotional tier, and no unimplemented payment action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferenceProfileSheet(state: AppState, model: AppViewModel, onClose: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val animatedDismiss = {
        scope.launch {
            sheetState.hide()
            onClose()
        }
    }
    ModalBottomSheet(onDismissRequest = animatedDismiss, containerColor = Color.White,
        dragHandle = null, sheetState = sheetState) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
            .padding(horizontal = 16.dp).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 3.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(tr(state.lang, "Profile", "پروفایل"), fontSize = 24.sp,
                    fontWeight = FontWeight.Black, color = Palette.text,
                    modifier = Modifier.weight(1f))
                IconButton(onClick = animatedDismiss, modifier = Modifier.size(45.dp)) {
                    Icon(Icons.Default.Close, tr(state.lang, "Close", "بستن"),
                        tint = Palette.muted, modifier = Modifier.size(24.dp))
                }
            }
            Column(Modifier.fillMaxWidth().padding(vertical = 13.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(shape = CircleShape, color = Color(0xFFE8EAEE)) {
                    Icon(Icons.Default.Person, null, tint = Palette.muted,
                        modifier = Modifier.padding(16.dp).size(32.dp))
                }
                Spacer(Modifier.height(10.dp))
                Text(tr(state.lang, "BetVima account", "حساب بت‌ویما"),
                    color = Palette.text, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text(tr(state.lang, "Secure account center", "مرکز امن حساب کاربری"),
                    color = Palette.muted, fontSize = 12.sp)
            }
            Surface(color = Color(0xFFF2F3F6),
                shape = RoundedCornerShape(23.dp),
                modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(11.dp)) {
                    Text(tr(state.lang, "Account", "حساب"), color = Palette.muted,
                        fontSize = 12.sp)
                    Text(state.wallet?.let { money(it.availableMinor, it.currency) }
                        ?: tr(state.lang, "Unavailable", "نامشخص"),
                        color = Palette.text, fontWeight = FontWeight.Black, fontSize = 23.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        Button(onClick = { onClose(); model.tab(Tab.WALLET) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Palette.green, contentColor = Palette.ink),
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier.weight(1f).heightIn(min = 46.dp)) {
                            Icon(Icons.Default.AccountBalanceWallet, null,
                                modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(tr(state.lang, "Wallet", "کیف‌پول"),
                                fontWeight = FontWeight.ExtraBold)
                        }
                        OutlinedButton(
                            onClick = { onClose(); model.tab(Tab.BETS) },
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier.weight(1f).heightIn(min = 46.dp)) {
                            Text(tr(state.lang, "Bet history", "تاریخچه شرط"),
                                color = Palette.text, fontWeight = FontWeight.ExtraBold,
                                fontSize = 11.sp)
                        }
                    }
                }
            }
            ProfileGroup {
                ProfileEntry(Icons.Default.CardGiftcard,
                    tr(state.lang, "Bonuses", "بونوس‌ها"),
                    tr(state.lang, "Your granted rewards", "پاداش‌های ثبت‌شده")) {
                    onClose(); model.feature(Feature.BONUSES)
                }
                HorizontalDivider(color = Color(0xFFE0E2E7))
                ProfileEntry(Icons.Default.EmojiEvents,
                    tr(state.lang, "VIP Loyalty Program", "باشگاه وفاداری VIP"),
                    tr(state.lang, "View current loyalty information", "مشاهده اطلاعات وفاداری")) {
                    onClose(); model.feature(Feature.VIP)
                }
            }
            ProfileGroup {
                ProfileEntry(Icons.Default.History,
                    tr(state.lang, "Bet history", "تاریخچه شرط‌ها"),
                    tr(state.lang, "Open and settled bets", "شرط‌های باز و تسویه‌شده")) {
                    onClose(); model.tab(Tab.BETS)
                }
                HorizontalDivider(color = Color(0xFFE0E2E7))
                ProfileEntry(Icons.Default.ReceiptLong,
                    tr(state.lang, "Transaction history", "تاریخچه تراکنش‌ها"),
                    tr(state.lang, "Authoritative USD account statement", "صورتحساب دلاری سرور")) {
                    onClose(); model.tab(Tab.WALLET)
                }
            }
            ProfileGroup {
                ProfileEntry(Icons.Default.Settings,
                    tr(state.lang, "Settings", "تنظیمات"),
                    tr(state.lang, "Edit personal data", "ویرایش اطلاعات کاربری")) {
                    onClose(); model.feature(Feature.PROFILE)
                }
                HorizontalDivider(color = Color(0xFFE0E2E7))
                ProfileEntry(Icons.Default.SupportAgent,
                    tr(state.lang, "24/7 support", "پشتیبانی ۲۴ ساعته"),
                    tr(state.lang, "Tickets and replies", "درخواست‌ها و پاسخ‌ها")) {
                    onClose(); model.feature(Feature.SUPPORT)
                }
                HorizontalDivider(color = Color(0xFFE0E2E7))
                ProfileEntry(Icons.Default.Groups,
                    tr(state.lang, "Partnership", "همکاری در فروش"),
                    tr(state.lang, "Your affiliate dashboard", "پنل همکاران")) {
                    onClose(); model.feature(Feature.AFFILIATE)
                }
            }
            OutlinedButton(onClick = { onClose(); model.signOut() },
                shape = RoundedCornerShape(13.dp),
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                border = BorderStroke(1.dp, Palette.red.copy(alpha = .35f))) {
                Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp),
                    tint = Palette.red)
                Spacer(Modifier.width(7.dp))
                Text(tr(state.lang, "Sign out", "خروج از حساب"),
                    color = Palette.red, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ProfileGroup(content: @Composable ColumnScope.() -> Unit) {
    Surface(color = Color(0xFFE8E9ED), shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
            content = content)
    }
}

@Composable
private fun ProfileEntry(icon: ImageVector, title: String, subtitle: String,
    onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick)
        .heightIn(min = 82.dp).padding(vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Color(0xFF858B97),
            modifier = Modifier.size(25.dp))
        Spacer(Modifier.width(15.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, color = Palette.text, fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold)
            Text(subtitle, color = Palette.muted, fontSize = 11.sp)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null,
            tint = Palette.muted, modifier = Modifier.size(18.dp))
    }
}
