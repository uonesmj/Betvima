package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.animation.animateContentSize
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
private val walletInk = Color(0xFFF3F4F7)
private val walletMute = Color(0xFFA5A8B2)
private val walletEdge = Color(0xFF39393D)
private val walletCanvas = Palette.headerDark
private val walletPanel = Color(0xFF222224)

@Composable
private fun WalletAction(
    name: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    dark: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.height(68.dp).clickable(onClick = onClick),
        color = walletPanel,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp,
            if (dark) walletBlue.copy(alpha = .65f) else walletEdge)
    ) {
        Column(Modifier.fillMaxSize().padding(vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon, null, tint = if (dark) Color(0xFF70B9FF) else Color(0xFFE0E2E7),
                modifier = Modifier.size(20.dp))
            Text(name, color = Color.White, fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
    }
}

@Composable
private fun WalletSummary(state: AppState, wallet: Wallet) {
    val lang = state.lang
    Surface(
        shape = RoundedCornerShape(21.dp),
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 1.dp,
        color = Color(0xFF0C2346)
    ) {
        Box {
            Box(
                Modifier.matchParentSize().background(
                    Brush.linearGradient(
                        listOf(Color(0xFF0B2345), Color(0xFF103E79), Color(0xFF0B63B9))
                    )
                )
            )
            // Subtle glass-like circles provide depth without a static bitmap.
            Box(Modifier.align(Alignment.TopEnd).offset(x = 72.dp, y = (-74).dp)
                .size(150.dp).clip(CircleShape)
                .background(Color.White.copy(alpha = .03f)))
            Box(Modifier.align(Alignment.BottomStart).offset(x = (-82).dp, y = 89.dp)
                .size(120.dp).clip(CircleShape)
                .background(walletGreen.copy(alpha = .04f)))
            Column(
                Modifier.fillMaxWidth().padding(15.dp),
                verticalArrangement = Arrangement.spacedBy(11.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = walletGreen.copy(alpha = .14f),
                        shape = RoundedCornerShape(13.dp),
                        border = BorderStroke(1.dp, walletGreen.copy(alpha = .35f))) {
                        Icon(Icons.Default.AccountBalanceWallet, null,
                            tint = walletGreen,
                            modifier = Modifier.padding(7.dp).size(19.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("BETVIMA / WALLET", color = Color.White,
                            fontSize = 13.sp, fontWeight = FontWeight.Black,
                            letterSpacing = .8.sp)
                        Text(tr(lang, "Your private balance", "موجودی اختصاصی شما"),
                            color = Color(0xFFAFCAE4), fontSize = 10.sp)
                    }
                    Surface(
                        color = Color.White.copy(alpha = .12f),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = .16f)),
                        shape = RoundedCornerShape(50)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                when(wallet.currency) {
                                    "IRR", "IRT" -> "🇮🇷"
                                    "USD" -> "🇺🇸"
                                    else -> "🌐"
                                }, fontSize = 15.sp
                            )
                            Spacer(Modifier.width(5.dp))
                            Text(wallet.currency, color = Color.White,
                                fontWeight = FontWeight.Black, fontSize = 11.sp)
                        }
                    }
                }
                Column(Modifier.animateContentSize(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(6.dp).clip(CircleShape)
                            .background(if (wallet.integrity == "ok") walletGreen
                                else Color(0xFFFFCD6B)))
                        Spacer(Modifier.width(7.dp))
                        Text(
                            tr(lang,"AVAILABLE BALANCE","موجودی قابل استفاده"),
                            color = Color(0xFFC0D7EE), fontSize = 10.sp,
                            fontWeight = FontWeight.Bold, letterSpacing = 1.sp
                        )
                    }
                    Text(money(wallet.availableMinor, wallet.currency),
                        color = Color.White, fontSize = 27.sp,
                        fontWeight = FontWeight.Black, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    listOf(
                        Triple(Icons.Default.AccountBalanceWallet,
                            tr(lang, "Total balance", "کل موجودی"), wallet.balanceMinor),
                        Triple(Icons.Default.Lock,
                            tr(lang, "Reserved", "موجودی مسدود"), wallet.heldMinor)
                    ).forEach { (icon, label, minor) ->
                        Surface(
                            color = Color.White.copy(alpha = .105f),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = .10f)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(Modifier.padding(9.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(icon, null, tint = Color(0xFFBBD9F5),
                                        modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(5.dp))
                                    Text(label, fontSize = 10.sp,
                                        color = Color(0xFFC0D7EE), maxLines = 1)
                                }
                                Text(money(minor, wallet.currency), color = Color.White,
                                    fontSize = 12.sp, fontWeight = FontWeight.Black,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        if (wallet.integrity == "ok") Icons.Default.VerifiedUser
                        else Icons.Default.WarningAmber, null,
                        tint = if (wallet.integrity == "ok") Color(0xFF89F1C3)
                            else Color(0xFFFFD47A), modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (wallet.integrity == "ok")
                            tr(lang, "Balance verified by secure ledger", "تأیید موجودی توسط دفترکل امن")
                        else tr(lang, "Balance under review · financial requests blocked",
                            "موجودی در حال بررسی · عملیات مالی غیرفعال"),
                        color = Color(0xFFD3E4F5), fontSize = 10.sp
                    )
                }
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
        color = walletPanel, shape = RoundedCornerShape(15.dp),
        border = BorderStroke(1.dp, walletEdge)
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Surface(
                color = if (incoming) Color(0xFF183B31) else Color(0xFF202E43),
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
                    color = if (incoming) Color(0xFF54D7A4) else walletInk,
                    fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text(walletStatusText(payment.status, lang),
                    color = when (payment.status.lowercase()) {
                        "succeeded" -> Color(0xFF54D7A4)
                        "failed", "cancelled" -> Color(0xFFFF879A)
                        else -> Color(0xFFFFD488)
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
        modifier = Modifier.fillMaxSize().background(walletCanvas),
        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 15.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    , flingBehavior = rememberPremiumFlingBehavior()) {
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
                            onClick = { activeSheet = "deposit" }, modifier = Modifier.weight(1f))
                        WalletAction(tr(lang,"Withdraw","برداشت"),
                            tr(lang,"Cash out","انتقال وجه"),
                            Icons.Default.ArrowUpward, false,
                            onClick = { activeSheet = "withdraw" }, modifier = Modifier.weight(1f))
                        WalletAction(tr(lang,"History","تاریخچه"),
                            tr(lang,"Activity","تراکنش‌ها"),
                            Icons.Default.History, false,
                            onClick = { activeSheet = "history" }, modifier = Modifier.weight(1f))
                    }
                }
                if (wallet.integrity != "ok") item {
                    Surface(color = Color(0xFF352527), shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFF68464B))) {
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
                    Surface(color = walletPanel, shape = RoundedCornerShape(17.dp),
                        border = BorderStroke(1.dp, walletEdge)) {
                        Column(
                            Modifier.fillMaxWidth().padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.ReceiptLong, null, tint = walletBlue,
                                modifier = Modifier.size(27.dp))
                            Text(tr(lang, "No payment requests yet", "هنوز پرداختی ثبت نشده"),
                                color = walletInk, fontWeight = FontWeight.Black, fontSize = 13.sp)
                            Text(tr(lang, "New payment receipts will appear here.",
                                "رسیدهای واریز و برداشت در این بخش نمایش داده می‌شوند."),
                                color = walletMute, fontSize = 11.sp)
                        }
                    }
                }
                items(payments.take(6), key = { it.id }) { payment ->
                    WalletPaymentRow(payment, lang) { detail = payment }
                }
                item {
                    TextButton(onClick = { activeSheet = "history" },
                        modifier = Modifier.fillMaxWidth()) {
                        Text(tr(lang, "View all activity", "مشاهده کل گردش حساب"),
                            color = Color(0xFF70B9FF), fontSize = 12.sp)
                        Spacer(Modifier.width(6.dp))
                        Icon(Icons.Default.ArrowForward, null, tint = Color(0xFF70B9FF),
                            modifier = Modifier.size(15.dp))
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
        val historySheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        val historyScope = rememberCoroutineScope()
        val hideHistory: () -> Unit = {
            historyScope.launch {
                historySheet.hide()
                activeSheet = ""
            }
        }
        ModalBottomSheet(
            onDismissRequest = hideHistory,
            containerColor = walletCanvas,
            sheetState = historySheet
        ) {
            WalletHistorySheet(state, model, onDetail = { detail = it })
        }
    }
    detail?.let { payment ->
        AlertDialog(
            onDismissRequest = { detail = null },
            containerColor = walletPanel,
            icon = { Icon(Icons.Default.ReceiptLong, null, tint = walletBlue) },
            title = { Text(tr(lang, "Payment details", "جزئیات پرداخت"),
                color = walletInk) },
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
                    Icon(Icons.Default.ContentCopy, null, tint = Color(0xFF77BFFF),
                        modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(tr(lang, "Copy receipt ID", "کپی شناسه رسید"), color = Color(0xFF77BFFF))
                }
            },
            dismissButton = {
                TextButton(onClick = { detail = null }) {
                    Text(tr(lang, "Close", "بستن"), color = walletMute)
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
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
        Row(
            Modifier.fillMaxWidth().background(walletPanel, RoundedCornerShape(13.dp))
                .padding(3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf("ledger", "payments").forEach { choice ->
                Surface(
                    modifier = Modifier.weight(1f).height(39.dp)
                        .clickable { mode = choice },
                    color = if (mode == choice) walletBlue else Color.Transparent,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(if (choice == "ledger") tr(lang, "Account ledger", "گردش حساب")
                            else tr(lang, "Payments", "پرداخت‌ها"),
                            color = if (mode == choice) Color.White else walletMute,
                            fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all", "credit", "debit").forEach { choice ->
                Surface(
                    modifier = Modifier.clickable { filter = choice },
                    shape = RoundedCornerShape(10.dp),
                    color = if (filter == choice) Color(0xFF163B63) else walletPanel,
                    border = BorderStroke(1.dp,
                        if (filter == choice) walletBlue else walletEdge)
                ) {
                    Text(when(choice) {
                        "credit" -> tr(lang, "Incoming", "ورودی")
                        "debit" -> tr(lang, "Outgoing", "خروجی")
                        else -> tr(lang, "All", "همه")
                    }, modifier = Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
                        color = Color.White, fontSize = 11.sp)
                }
            }
        }
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 430.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp), flingBehavior = rememberPremiumFlingBehavior()) {
            if (mode == "ledger") {
                val entries = wallet.transactions.filter {
                    filter == "all" || it.direction == filter
                }
                if (entries.isEmpty()) item {
                    Text(tr(lang,"No ledger entries","گردش حسابی وجود ندارد"),
                        color = walletMute)
                }
                items(entries, key = { it.id }) { entry ->
                    Surface(color = walletPanel, shape = RoundedCornerShape(13.dp),
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
                                Text(entry.type.replace("_", " "), color = walletInk,
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text(walletDate(entry.time), fontSize = 10.sp, color = walletMute)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(money(entry.amountMinor, wallet.currency), color = walletInk,
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
