package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.ui.geometry.Rect
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
private val walletGreen: Color get() = ThemeTokens.accent
private val walletInk: Color get() = ThemeTokens.ink
private val walletMute: Color get() = ThemeTokens.muted
private val walletEdge: Color get() = ThemeTokens.outline
private val walletCanvas: Color get() = ThemeTokens.canvas
private val walletPanel: Color get() = ThemeTokens.panel

// Ticket outline follows the two inward cutouts on both sides, including its
// bright-blue border. No overlay touches any wallet or transaction data.
private val walletTicketShape = GenericShape { size, _ ->
    val width = size.width
    val height = size.height
    val radius = width * .045f
    val notch = width * .034f
    val cy = height * .43f
    moveTo(radius, 0f)
    lineTo(width - radius, 0f)
    quadraticBezierTo(width, 0f, width, radius)
    lineTo(width, cy - notch)
    arcTo(Rect(width - notch, cy - notch, width + notch, cy + notch),
        -90f, -180f, false)
    lineTo(width, height - radius)
    quadraticBezierTo(width, height, width - radius, height)
    lineTo(radius, height)
    quadraticBezierTo(0f, height, 0f, height - radius)
    lineTo(0f, cy + notch)
    arcTo(Rect(-notch, cy - notch, notch, cy + notch),
        90f, -180f, false)
    lineTo(0f, radius)
    quadraticBezierTo(0f, 0f, radius, 0f)
    close()
}

@Composable
private fun WalletAction(
    name: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector,
    dark: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(17.dp)
    val background = if (dark)
        listOf(Color(0xFF0587FF), Color(0xFF0874E9))
    else listOf(Color(0xFF26282D), Color(0xFF1E2025))
    // Standalone actions, no shared outer panel.
    Box(modifier = modifier.height(76.dp).clip(shape)
        .background(Brush.linearGradient(background))
        .border(if (dark) 1.2.dp else 1.dp,
            if (dark) Color(0xFF59B3FF) else Color(0xFF3D424B), shape)
        .clickable(onClick = onClick),
        contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Icon(icon, null, tint = Color(0xFFF2F5FB),
                modifier = Modifier.size(23.dp))
            Text(name, color = Color.White, fontSize = 11.sp,
                fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

@Composable
private fun WalletSummary(state: AppState, wallet: Wallet) {
    val lang = state.lang
    Surface(
        shape = walletTicketShape,
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 2.dp,
        border = BorderStroke(1.5.dp, Color(0xFF168AFF)),
        color = Color(0xFF0C2346)
    ) {
        Box {
            Box(
                Modifier.matchParentSize().background(
                    Brush.linearGradient(
                        listOf(Color(0xFF051D3D), Color(0xFF0A3B80), Color(0xFF0966C1))
                    )
                )
            )
            // Layered low-contrast shapes create depth inside the ticket.
            Box(Modifier.align(Alignment.TopEnd).offset(x = 75.dp, y = (-88).dp)
                .size(230.dp).clip(CircleShape)
                .background(Color(0xFF4EA9FF).copy(alpha = .08f)))
            Box(Modifier.align(Alignment.BottomEnd).offset(x = 98.dp, y = 92.dp)
                .size(205.dp).clip(CircleShape)
                .background(Color(0xFF042147).copy(alpha = .22f)))
            Box(Modifier.align(Alignment.BottomStart).offset(x = (-65).dp, y = 93.dp)
                .size(135.dp).clip(CircleShape)
                .background(walletGreen.copy(alpha = .05f)))
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(13.dp)
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
                        Text(tr(LocalNativeLanguage176.current, "BETVIMA / WALLET", "BETVIMA / WALLET"), color = Color.White,
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
                        color = Color.White, fontSize = 30.sp,
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
    val accent = if (incoming) Color(0xFF2ED2A4) else Color(0xFF69B6FF)
    val statusColor = when (payment.status.lowercase()) {
        "succeeded" -> Color(0xFF54D7A4)
        "failed", "cancelled", "reversed" -> Color(0xFFFF879A)
        else -> Color(0xFFFFD488)
    }
    val shape = RoundedCornerShape(16.dp)
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = walletPanel, shape = shape,
        border = BorderStroke(1.dp, walletEdge)
    ) {
        Box(Modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(
                walletPanel, walletPanel, ThemeTokens.elevated
            )))) {
            Box(Modifier.align(Alignment.TopEnd).offset(x = 44.dp, y = (-57).dp)
                .size(133.dp).clip(CircleShape)
                .background(accent.copy(alpha = .045f)))
            Box(Modifier.align(Alignment.CenterStart).width(3.dp).height(45.dp)
                .clip(RoundedCornerShape(topEnd = 3.dp, bottomEnd = 3.dp))
                .background(accent.copy(alpha = .77f)))
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp))
                    .background(if (incoming) Color(0xFF10503D) else Color(0xFF173954))
                    .border(1.dp, accent.copy(alpha = .19f), RoundedCornerShape(13.dp)),
                    contentAlignment = Alignment.Center) {
                    Icon(if (incoming) Icons.Default.SouthWest else Icons.Default.NorthEast,
                        null, tint = accent, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(if (incoming) tr(lang, "Deposit", "واریز")
                        else tr(lang, "Withdrawal", "برداشت"),
                        color = walletInk, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(walletDate(payment.createdAt), color = walletMute, fontSize = 10.sp)
                    Text(payment.publicId.take(18), color = walletMute, fontSize = 9.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(6.dp))
                Column(horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text((if (incoming) "+" else "−") +
                        money(payment.amountMinor, payment.currency),
                        color = if (incoming) ThemeTokens.accent else walletInk,
                        fontSize = 12.sp, fontWeight = FontWeight.Black,
                        maxLines = 1)
                    Text(walletStatusText(payment.status, lang),
                        color = statusColor, fontSize = 10.sp)
                }
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
    var showAllRecentPayments by rememberSaveable { mutableStateOf(false) }
    var detail by remember { mutableStateOf<WalletPaymentRecord?>(null) }
    val wallet = state.wallet

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(walletCanvas),
        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    , flingBehavior = rememberPremiumFlingBehavior()) {
        if (!state.signedIn) {
            item {
                LockedFeature(lang,
                    tr(lang, "Sign in to open your secure wallet",
                        "برای استفاده از کیف پول وارد حساب شوید"),
                    onRegister = { model.showLogin(true, register = true) },
                    icon = Icons.Default.AccountBalanceWallet
                ) { model.showLogin(true) }
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
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()) {
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
                        IconButton(onClick = model::refreshAccount,
                            enabled = state.signedIn && !state.accountLoading,
                            modifier = Modifier.size(36.dp)) {
                            Icon(Icons.Default.Refresh,
                                tr(lang, "Refresh", "تازه‌سازی"),
                                tint = walletBlue, modifier = Modifier.size(21.dp))
                        }
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
                                        onClick = {
                                            filter = opt
                                            showAllRecentPayments = false
                                            filterOpen = false
                                        },
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
                if (payments.isNotEmpty()) item {
                    val recentPayments = payments.take(6)
                    Column(
                        modifier = Modifier.fillMaxWidth().animateContentSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // The newest receipt is always visible; additional receipts stay collapsed.
                        WalletPaymentRow(recentPayments.first(), lang) {
                            detail = recentPayments.first()
                        }
                        if (recentPayments.size > 1) {
                            Surface(
                                onClick = { showAllRecentPayments = !showAllRecentPayments },
                                modifier = Modifier.fillMaxWidth(),
                                color = walletPanel,
                                shape = RoundedCornerShape(13.dp),
                                border = BorderStroke(1.dp, walletEdge)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 9.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        if (showAllRecentPayments)
                                            tr(lang, "Show fewer payments", "بستن پرداخت‌های بیشتر")
                                        else tr(lang,
                                            "Show ${recentPayments.size - 1} more payments",
                                            "نمایش ${recentPayments.size - 1} پرداخت دیگر"),
                                        color = Color(0xFF70B9FF),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Icon(
                                        if (showAllRecentPayments) Icons.Default.ExpandLess
                                        else Icons.Default.ExpandMore,
                                        contentDescription = null,
                                        tint = Color(0xFF70B9FF),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                            if (showAllRecentPayments) {
                                recentPayments.drop(1).forEach { payment ->
                                    WalletPaymentRow(payment, lang) { detail = payment }
                                }
                            }
                        }
                    }
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
                    color = if (filter == choice) Palette.blue else walletPanel,
                    border = BorderStroke(1.dp,
                        if (filter == choice) walletBlue else walletEdge)
                ) {
                    Text(when(choice) {
                        "credit" -> tr(lang, "Incoming", "ورودی")
                        "debit" -> tr(lang, "Outgoing", "خروجی")
                        else -> tr(lang, "All", "همه")
                    }, modifier = Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
                        color = if (filter == choice) Color.White else walletInk, fontSize = 11.sp)
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
