package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import java.time.Instant

private val walletBlue = Color(0xFF087FF5)
private val walletGreen = Color(0xFF00D47A)
private val walletInk = Color(0xFF172033)
private val walletMute = Color(0xFF748195)
private val walletEdge = Color(0xFFE1E7EF)

@Composable
private fun WalletAction(
    name: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    dark: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (dark) walletBlue else Color.White,
        shape = RoundedCornerShape(17.dp),
        border = BorderStroke(1.dp, if (dark) walletBlue else walletEdge),
        shadowElevation = if (dark) 3.dp else 1.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(vertical = 13.dp, horizontal = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Icon(icon, null, tint = if (dark) Color.White else walletBlue,
                modifier = Modifier.size(22.dp))
            Text(name, color = if (dark) Color.White else walletInk,
                fontSize = 12.sp, fontWeight = FontWeight.Black)
            Text(detail, color = if (dark) Color.White.copy(alpha = .72f) else walletMute,
                fontSize = 9.sp, maxLines = 1)
        }
    }
}

@Composable
private fun WalletSummary(state: AppState, wallet: Wallet) {
    val lang = state.lang
    Surface(shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 4.dp, color = Color(0xFF133D75)) {
        Column(
            Modifier.background(Brush.linearGradient(listOf(
                Color(0xFF102B59), Color(0xFF144C98), Color(0xFF087FF5)
            ))).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AccountBalanceWallet, null, tint = Color(0xFF8EEDC1))
                Spacer(Modifier.width(8.dp))
                Text(tr(lang, "BETVIMA WALLET", "کیف پول بت‌ویما"),
                    color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                Surface(color = Color.White.copy(alpha = .13f),
                    shape = RoundedCornerShape(10.dp)) {
                    Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(if (wallet.currency == "IRR") "🇮🇷" else "🇺🇸", fontSize = 13.sp)
                        Spacer(Modifier.width(5.dp))
                        Text(wallet.currency, color = Color.White,
                            fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }
            }
            Column {
                Text(tr(lang, "AVAILABLE BALANCE", "موجودی قابل استفاده"),
                    color = Color(0xFFC8D8F3), fontSize = 10.sp,
                    fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Text(money(wallet.availableMinor, wallet.currency),
                    color = Color.White, fontSize = 29.sp, fontWeight = FontWeight.Black,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    tr(lang, "Total", "کل موجودی") to wallet.balanceMinor,
                    tr(lang, "Held", "مسدودشده") to wallet.heldMinor
                ).forEach { (label, minor) ->
                    Surface(color = Color.White.copy(alpha = .11f),
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.weight(1f)) {
                        Column(Modifier.padding(12.dp)) {
                            Text(label, fontSize = 10.sp, color = Color(0xFFC1D1E7))
                            Spacer(Modifier.height(4.dp))
                            Text(money(minor, wallet.currency), color = Color.White,
                                fontSize = 12.sp, fontWeight = FontWeight.Black,
                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (wallet.integrity == "ok") Icons.Default.VerifiedUser
                    else Icons.Default.ReportProblem, null,
                    tint = if (wallet.integrity == "ok") Color(0xFF8EEDC1) else Color(0xFFFFD78A),
                    modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    if (wallet.integrity == "ok")
                        tr(lang, "Server verified ledger", "موجودی تأییدشده توسط سرور")
                    else tr(lang, "Ledger needs review · transfers disabled",
                        "دفترکل نیازمند بررسی است · انتقال غیرفعال"),
                    color = Color.White.copy(alpha = .82f), fontSize = 10.sp
                )
            }
        }
    }
}

private fun walletStatusText(status: String, lang: Lang): String = when(status.lowercase()) {
    "succeeded" -> tr(lang, "Completed", "موفق")
    "failed", "cancelled", "reversed" -> tr(lang, "Failed", "ناموفق")
    "pending", "processing", "created", "approved" -> tr(lang, "Processing", "در انتظار")
    else -> status.replace("_", " ")
}
private fun walletDate(date: String): String =
    runCatching { Instant.parse(date).toString().take(16).replace("T", " ") }
        .getOrDefault(date.take(16).replace("T", " "))

@Composable
private fun WalletPaymentRow(
    payment: WalletPaymentRecord, lang: Lang, onClick: () -> Unit
) {
    val incoming = payment.direction == "deposit"
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = Color.White, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, walletEdge)
    ) {
        Row(Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Surface(
                color = if (incoming) Color(0xFFEAF9F1) else Color(0xFFEEF4FF),
                shape = RoundedCornerShape(13.dp)
            ) {
                Icon(if (incoming) Icons.Default.SouthWest else Icons.Default.NorthEast,
                    null, tint = if (incoming) Color(0xFF087D4D) else walletBlue,
                    modifier = Modifier.padding(10.dp).size(20.dp))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(if (incoming) tr(lang, "Deposit", "واریز")
                    else tr(lang, "Withdrawal", "برداشت"),
                    color = walletInk, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(walletDate(payment.createdAt), color = walletMute, fontSize = 10.sp)
                Text(payment.publicId.take(18), color = walletMute, fontSize = 9.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text((if (incoming) "+" else "−") +
                    money(payment.amountMinor, payment.currency),
                    color = if (incoming) Color(0xFF087D4D) else walletInk,
                    fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text(walletStatusText(payment.status, lang),
                    color = when (payment.status.lowercase()) {
                        "succeeded" -> Color(0xFF087D4D)
                        "failed", "cancelled" -> Color(0xFFCA3655)
                        else -> Color(0xFF8A6400)
                    }, fontSize = 10.sp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumWalletPage(state: AppState, model: AppViewModel) {
    val lang = state.lang
    val clipboard = LocalClipboardManager.current
    var activeSheet by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("all") }
    var filterOpen by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<WalletPaymentRecord?>(null) }
    val wallet = state.wallet

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 13.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Wallet", "کیف پول"), color = walletInk,
                        fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text(tr(lang, "Manage funds and payments",
                        "مدیریت موجودی و عملیات مالی"),
                        color = walletMute, fontSize = 11.sp)
                }
                IconButton(onClick = model::refreshAccount,
                    enabled = state.signedIn && !state.accountLoading) {
                    Icon(Icons.Default.Refresh, tr(lang, "Refresh", "تازه‌سازی"),
                        tint = walletBlue)
                }
            }
        }
        if (!state.signedIn) {
            item {
                LockedFeature(lang, tr(lang, "Sign in to open your secure wallet",
                    "برای استفاده از کیف پول وارد حساب شوید")) { model.showLogin(true) }
            }
        } else {
            if (state.accountLoading) item {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = walletBlue)
            }
            if (wallet == null) item {
                EmptyPanel(
                    tr(lang, "Wallet unavailable", "کیف پول در دسترس نیست"),
                    tr(lang, "Server balance is required. Refresh and try again.",
                        "نمایش موجودی فقط پس از دریافت اطلاعات از سرور امکان‌پذیر است.")
                ) { model.refreshAccount() }
            } else {
                item { WalletSummary(state, wallet) }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        WalletAction(tr(lang,"Deposit","واریز"),
                            tr(lang,"Add funds","شارژ حساب"),
                            Icons.Default.ArrowDownward, true,
                            onClick = { activeSheet = "deposit" }, Modifier.weight(1f))
                        WalletAction(tr(lang,"Withdraw","برداشت"),
                            tr(lang,"Cash out","انتقال وجه"),
                            Icons.Default.ArrowUpward, false,
                            onClick = { activeSheet = "withdraw" }, Modifier.weight(1f))
                        WalletAction(tr(lang,"History","تاریخچه"),
                            tr(lang,"Activity","تراکنش‌ها"),
                            Icons.Default.History, false,
                            onClick = { activeSheet = "history" }, Modifier.weight(1f))
                    }
                }
                if (wallet.integrity != "ok") item {
                    Surface(color = Color(0xFFFFF1ED), shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFFFFD2C5))) {
                        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.WarningAmber, null, tint = Color(0xFFB5472F))
                            Spacer(Modifier.width(9.dp))
                            Text(tr(lang,
                                "Financial requests are blocked until the server ledger is verified.",
                                "تا زمان تأیید دفترکل توسط سرور، درخواست مالی غیرفعال است."),
                                color = walletInk, fontSize = 11.sp)
                        }
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(lang,"Recent payments","پرداخت‌های اخیر"),
                            color = walletInk, fontSize = 17.sp, fontWeight = FontWeight.Black,
                            modifier = Modifier.weight(1f))
                        Box {
                            TextButton(onClick = { filterOpen = true }) {
                                Icon(Icons.Default.Tune, null, modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(tr(lang,"Filter","فیلتر"), fontSize = 12.sp)
                            }
                            DropdownMenu(expanded = filterOpen,
                                onDismissRequest = { filterOpen = false }) {
                                listOf("all", "deposit", "withdrawal").forEach { opt ->
                                    DropdownMenuItem(
                                        text = { Text(when(opt) {
                                            "deposit" -> tr(lang,"Deposits","واریزها")
                                            "withdrawal" -> tr(lang,"Withdrawals","برداشت‌ها")
                                            else -> tr(lang,"All payments","همه پرداخت‌ها")
                                        }) },
                                        onClick = { filter = opt; filterOpen = false },
                                        trailingIcon = {
                                            if (filter == opt) Icon(Icons.Default.Check, null,
                                                tint = walletBlue)
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
                val payments = wallet.payments.filter { filter == "all" || it.direction == filter }
                if (payments.isEmpty()) item {
                    Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                        border = BorderStroke(1.dp, walletEdge)) {
                        Text(tr(lang, "No recent payment requests. Open History for ledger activity.",
                            "درخواست پرداختی ثبت نشده است؛ گردش حساب را در تاریخچه ببینید."),
                            modifier = Modifier.padding(17.dp), fontSize = 12.sp, color = walletMute)
                    }
                }
                items(payments.take(6), key = { it.id }) { payment ->
                    WalletPaymentRow(payment, lang) { detail = payment }
                }
                item {
                    OutlinedButton(
                        onClick = { activeSheet = "history" },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.ReceiptLong, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(lang, "View all activity", "مشاهده کل گردش حساب"))
                    }
                }
            }
        }
    }

    if (state.signedIn && wallet != null && activeSheet in setOf("deposit", "withdraw")) {
        WalletTransferSheet(
            lang = lang, wallet = wallet, model = model,
            direction = activeSheet, onDismiss = { activeSheet = "" },
            onOpenHistory = { activeSheet = "history" }
        )
    }
    if (state.signedIn && wallet != null && activeSheet == "history") {
        ModalBottomSheet(
            onDismissRequest = { activeSheet = "" },
            containerColor = Color(0xFFF8FAFD),
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            WalletHistorySheet(state, model, onDetail = { detail = it })
        }
    }
    detail?.let { payment ->
        AlertDialog(
            onDismissRequest = { detail = null },
            icon = { Icon(Icons.Default.ReceiptLong, null, tint = walletBlue) },
            title = { Text(tr(lang, "Payment details", "جزئیات پرداخت")) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(walletStatusText(payment.status, lang), color = walletBlue,
                        fontWeight = FontWeight.Black)
                    Text(money(payment.amountMinor, payment.currency),
                        color = walletInk, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    Text(walletDate(payment.createdAt), color = walletMute)
                    Text(payment.publicId, fontSize = 11.sp, color = walletInk)
                    if (payment.failureMessage.isNotBlank())
                        Text(payment.failureMessage, color = Color(0xFFC93D52), fontSize = 11.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    clipboard.setText(AnnotatedString(payment.publicId))
                }) {
                    Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr(lang, "Copy receipt ID", "کپی شناسه رسید"))
                }
            },
            dismissButton = {
                TextButton(onClick = { detail = null }) {
                    Text(tr(lang, "Close", "بستن"))
                }
            }
        )
    }
}

@Composable
private fun WalletHistorySheet(
    state: AppState, model: AppViewModel, onDetail: (WalletPaymentRecord) -> Unit
) {
    val lang = state.lang
    val clipboard = LocalClipboardManager.current
    var mode by rememberSaveable { mutableStateOf("ledger") }
    var filter by rememberSaveable { mutableStateOf("all") }
    val wallet = state.wallet ?: return
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 22.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text(tr(lang, "Transaction history", "تاریخچه تراکنش‌ها"),
            color = walletInk, fontSize = 19.sp, fontWeight = FontWeight.Black)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("ledger", "payments").forEachIndexed { index, v ->
                SegmentedButton(
                    selected = mode == v, onClick = { mode = v },
                    shape = SegmentedButtonDefaults.itemShape(index, 2),
                    label = { Text(if (v == "ledger")
                        tr(lang, "Account ledger", "گردش حساب")
                    else tr(lang, "Payments", "پرداخت‌ها")) }
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all", "credit", "debit").forEach { option ->
                FilterChip(
                    selected = filter == option,
                    onClick = { filter = option },
                    label = { Text(when(option) {
                        "credit" -> tr(lang,"Incoming","ورودی")
                        "debit" -> tr(lang,"Outgoing","خروجی")
                        else -> tr(lang,"All","همه")
                    }, fontSize = 11.sp) }
                )
            }
        }
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 430.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (mode == "ledger") {
                val entries = wallet.transactions.filter {
                    filter == "all" || it.direction == filter
                }
                if (entries.isEmpty()) item {
                    Text(tr(lang,"No ledger entries","گردش حسابی وجود ندارد"),
                        color = walletMute)
                }
                items(entries, key = { it.id }) { entry ->
                    Surface(color = Color.White, shape = RoundedCornerShape(13.dp),
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, walletEdge)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (entry.direction == "credit") Icons.Default.SouthWest
                                else Icons.Default.NorthEast, null,
                                tint = if (entry.direction == "credit") Color(0xFF0A8B52)
                                else walletBlue, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(entry.type.replace("_", " "),
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(walletDate(entry.time), fontSize = 10.sp, color = walletMute)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(money(entry.amountMinor, wallet.currency),
                                    fontWeight = FontWeight.Black, fontSize = 12.sp)
                                IconButton(onClick = {
                                    clipboard.setText(AnnotatedString(entry.id))
                                }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.ContentCopy,
                                        tr(lang,"Copy ID","کپی شناسه"),
                                        tint = walletBlue, modifier = Modifier.size(15.dp))
                                }
                            }
                        }
                    }
                }
                if (wallet.hasMore) item {
                    OutlinedButton(
                        onClick = model::loadMoreWallet,
                        enabled = !state.moreWalletLoading,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (state.moreWalletLoading) CircularProgressIndicator(
                            modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        else Text(tr(lang, "Load more ledger entries", "تراکنش‌های بیشتر"))
                    }
                }
            } else {
                val entries = wallet.payments.filter {
                    filter == "all" ||
                        (filter == "credit" && it.direction == "deposit") ||
                        (filter == "debit" && it.direction == "withdrawal")
                }
                if (entries.isEmpty()) item {
                    Text(tr(lang,"No payment records","درخواست پرداختی وجود ندارد"),
                        color = walletMute)
                }
                items(entries, key = { it.id }) { entry ->
                    WalletPaymentRow(entry, lang) { onDetail(entry) }
                }
                item {
                    Text(tr(lang,
                        "Recent payment records are provided by the server. This list is not an archive of all historical payments.",
                        "این فهرست پرداخت‌های اخیر سرور است و آرشیو کامل تمام پرداخت‌های گذشته نیست."),
                        color = walletMute, fontSize = 10.sp)
                }
            }
        }
    }
}
