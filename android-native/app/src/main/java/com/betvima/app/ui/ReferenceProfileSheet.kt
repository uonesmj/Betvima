package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.money

/**
 * Native account navigation with the same premium dark surfaces as Casino,
 * My Bets and Wallet. Every destination and displayed amount remains server-owned.
 */
private object ProfileColors {
    val canvas = Palette.headerDark
    val surface = Color(0xFF222224)
    val edge = Color(0xFF38383D)
    val accent = Palette.blue
    val blueSoft = Color(0xFF85C5FF)
    val white = Color(0xFFF5F6F9)
    val secondary = Color(0xFFA6A9B3)
    val red = Color(0xFFFF8293)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferenceProfileSheet(state: AppState, model: AppViewModel, onClose: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val animatedDismiss: () -> Unit = {
        scope.launch {
            sheetState.hide()
            onClose()
        }
    }

    ModalBottomSheet(
        onDismissRequest = animatedDismiss,
        containerColor = ProfileColors.canvas,
        contentColor = ProfileColors.white,
        scrimColor = Color.Black.copy(alpha = .72f),
        dragHandle = null,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
                .verticalScroll(
                    rememberScrollState(),
                    flingBehavior = rememberPremiumFlingBehavior()
                )
                .padding(horizontal = 17.dp)
                .padding(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    tr(state.lang, "Profile", "پروفایل"),
                    modifier = Modifier.weight(1f),
                    color = ProfileColors.white,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
                Surface(
                    modifier = Modifier.size(39.dp).clickable(onClick = animatedDismiss),
                    shape = RoundedCornerShape(12.dp),
                    color = ProfileColors.surface,
                    border = BorderStroke(1.dp, ProfileColors.edge)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Close,
                            tr(state.lang, "Close", "بستن"),
                            modifier = Modifier.size(20.dp),
                            tint = ProfileColors.secondary)
                    }
                }
            }

            // A compact profile identity row avoids the large empty hero area.
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color(0xFF19374E),
                    border = BorderStroke(1.dp, Color(0xFF285C7A))
                ) {
                    Icon(Icons.Default.Person, null,
                        modifier = Modifier.padding(13.dp).size(28.dp),
                        tint = ProfileColors.blueSoft)
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(tr(state.lang, "BetVima account", "حساب بت‌ویما"),
                        color = ProfileColors.white,
                        fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text(tr(state.lang, "Secure account center", "مرکز امن حساب کاربری"),
                        color = ProfileColors.secondary, fontSize = 11.sp)
                }
                Icon(Icons.Default.VerifiedUser, null,
                    modifier = Modifier.size(19.dp),
                    tint = Color(0xFF67D8AA))
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = ProfileColors.surface,
                shape = RoundedCornerShape(19.dp),
                border = BorderStroke(1.dp, ProfileColors.edge)
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(15.dp),
                    verticalArrangement = Arrangement.spacedBy(13.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(state.lang, "AVAILABLE BALANCE", "موجودی قابل استفاده"),
                            modifier = Modifier.weight(1f),
                            color = ProfileColors.secondary,
                            letterSpacing = .7.sp,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Default.AccountBalanceWallet, null,
                            modifier = Modifier.size(17.dp),
                            tint = ProfileColors.blueSoft)
                    }
                    Text(state.wallet?.let { money(it.availableMinor, it.currency) }
                        ?: tr(state.lang, "Unavailable", "نامشخص"),
                        color = ProfileColors.white,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        ProfilePrimaryAction(
                            text = tr(state.lang, "Wallet", "کیف‌پول"),
                            icon = Icons.Default.AccountBalanceWallet,
                            primary = true,
                            modifier = Modifier.weight(1f)
                        ) {
                            onClose()
                            model.tab(Tab.WALLET)
                        }
                        ProfilePrimaryAction(
                            text = tr(state.lang, "Bet history", "تاریخچه شرط"),
                            icon = Icons.Default.History,
                            primary = false,
                            modifier = Modifier.weight(1f)
                        ) {
                            onClose()
                            model.tab(Tab.BETS)
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
                ProfileDivider()
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
                ProfileDivider()
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
                ProfileDivider()
                ProfileEntry(Icons.Default.SupportAgent,
                    tr(state.lang, "24/7 support", "پشتیبانی ۲۴ ساعته"),
                    tr(state.lang, "Tickets and replies", "درخواست‌ها و پاسخ‌ها")) {
                    onClose(); model.feature(Feature.SUPPORT)
                }
                ProfileDivider()
                ProfileEntry(Icons.Default.Groups,
                    tr(state.lang, "Partnership", "همکاری در فروش"),
                    tr(state.lang, "Your affiliate dashboard", "پنل همکاران")) {
                    onClose(); model.feature(Feature.AFFILIATE)
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth().height(47.dp)
                    .clickable {
                        onClose()
                        model.signOut()
                    },
                color = Color(0xFF2B2025),
                shape = RoundedCornerShape(13.dp),
                border = BorderStroke(1.dp, Color(0xFF62404A))
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Default.Logout, null,
                        modifier = Modifier.size(17.dp),
                        tint = ProfileColors.red)
                    Spacer(Modifier.width(8.dp))
                    Text(tr(state.lang, "Sign out", "خروج از حساب"),
                        color = ProfileColors.red,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ProfilePrimaryAction(
    text: String,
    icon: ImageVector,
    primary: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.height(48.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(13.dp),
        color = if (primary) ProfileColors.accent else Color(0xFF2B2B30),
        border = BorderStroke(1.dp,
            if (primary) ProfileColors.accent else Color(0xFF46464B))
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 7.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, null,
                modifier = Modifier.size(17.dp),
                tint = if (primary) Color.White else ProfileColors.blueSoft)
            Spacer(Modifier.width(6.dp))
            Text(text,
                color = ProfileColors.white,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ProfileGroup(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        color = ProfileColors.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, ProfileColors.edge),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 3.dp),
            content = content)
    }
}

@Composable
private fun ProfileDivider() {
    HorizontalDivider(color = ProfileColors.edge, thickness = 1.dp)
}

@Composable
private fun ProfileEntry(
    icon: ImageVector, title: String, subtitle: String,
    onClick: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick)
            .heightIn(min = 69.dp)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = RoundedCornerShape(11.dp),
            color = Color(0xFF19344C)
        ) {
            Box(Modifier.size(38.dp), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null,
                    tint = ProfileColors.blueSoft,
                    modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title,
                color = ProfileColors.white,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis)
            Text(subtitle,
                color = ProfileColors.secondary,
                fontSize = 10.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(5.dp))
        Icon(Icons.Default.ChevronRight, contentDescription = null,
            tint = ProfileColors.secondary,
            modifier = Modifier.size(18.dp))
    }
}
