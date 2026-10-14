package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import com.betvima.app.data.Bet
import com.betvima.app.data.BetHistoryQuery
import com.betvima.app.data.money
import com.betvima.app.data.odds
import kotlinx.coroutines.delay

/**
 * Server-owned history, not a local filter over the initial 30 records.
 * One query and stable pagination per selected filter, with session isolation.
 */
@Composable
fun PremiumMyBetsPage(state: AppState, model: AppViewModel) {
    val filter = state.historyQuery
    var search by rememberSaveable { mutableStateOf(filter.search) }
    LaunchedEffect(search) {
        delay(380)
        if (search.trim() != state.historyQuery.search) {
            model.setBetHistoryQuery(state.historyQuery.copy(search = search.trim()))
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "SECURE TICKET HISTORY", "تاریخچه امن بلیت‌ها"),
                title = tr(state.lang, "My Bets", "شرط‌های من"),
                subtitle = tr(state.lang,
                    "Every record is loaded from your account, with verified receipt details.",
                    "هر بلیت از حساب خودتان دریافت می‌شود و رسید قابل پیگیری دارد."),
                icon = Icons.Default.ReceiptLong
            ) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color.White.copy(alpha = .12f),
                        shape = RoundedCornerShape(13.dp)) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Shield, null,
                                tint = Palette.green, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(tr(state.lang, "Private & verified", "خصوصی و تأییدشده"),
                                color = Color.White, fontSize = 10.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                    if (state.signedIn) Text(
                        tr(state.lang, "Loaded ", "بارگذاری‌شده: ") + state.historyBets.size,
                        color = Color.White.copy(alpha = .83f),
                        fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                }
            }
        }
        if (!state.signedIn) {
            item {
                LockedFeature(state.lang, tr(state.lang,
                    "Log in to view your private ticket history",
                    "برای مشاهده تاریخچه خصوصی شرط‌ها وارد شوید")) {
                    model.showLogin(true)
                }
            }
            item {
                OutlinedButton(onClick = { model.showLogin(true, register = true) },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Default.PersonAdd, null,
                        modifier = Modifier.size(18.dp), tint = Palette.blue)
                    Spacer(Modifier.width(7.dp))
                    Text(tr(state.lang, "Create an account", "ساخت حساب کاربری"),
                        color = Palette.blue, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(state.lang, "Ticket explorer", "جست‌وجوی بلیت‌ها"),
                        modifier = Modifier.weight(1f),
                        color = Palette.text, fontSize = 17.sp,
                        fontWeight = FontWeight.Black)
                    IconButton(onClick = { model.refreshBetHistory() },
                        modifier = Modifier.size(43.dp)) {
                        Icon(Icons.Default.Refresh,
                            tr(state.lang, "Refresh tickets", "تازه‌سازی شرط‌ها"),
                            tint = Palette.blue)
                    }
                }
            }
            item {
                StatusSegment(state.lang, filter.status) { status ->
                    model.setBetHistoryQuery(filter.copy(status = status))
                }
            }
            item {
                OutlinedTextField(
                    value = search, onValueChange = { search = it.take(70) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(15.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    leadingIcon = { Icon(Icons.Default.Search, null, tint = Palette.blue) },
                    placeholder = { Text(tr(state.lang,
                        "Search ticket, match or reference", "جست‌وجوی بلیت، مسابقه یا شناسه"),
                        fontSize = 12.sp) },
                    trailingIcon = {
                        if (search.isNotBlank()) IconButton(onClick = { search = "" }) {
                            Icon(Icons.Default.Close,
                                tr(state.lang, "Clear search", "پاک‌کردن جست‌وجو"),
                                tint = Palette.muted)
                        }
                    }
                )
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    val typeValues = listOf(
                        "all" to tr(state.lang, "All types", "همه نوع‌ها"),
                        "single" to tr(state.lang, "Single", "تکی"),
                        "multiple" to tr(state.lang, "Multiple", "میکس"))
                    items(typeValues, key = { "type-"+it.first }) { (type, title) ->
                        HistoryChip(title, filter.type == type) {
                            model.setBetHistoryQuery(filter.copy(type = type))
                        }
                    }
                }
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    val dates = listOf(
                        0 to tr(state.lang, "All dates", "همه تاریخ‌ها"),
                        7 to tr(state.lang, "7 days", "۷ روز"),
                        30 to tr(state.lang, "30 days", "۳۰ روز"),
                        90 to tr(state.lang, "90 days", "۹۰ روز"))
                    items(dates, key = { "date-"+it.first }) { (days, title) ->
                        HistoryChip(title, filter.days == days) {
                            model.setBetHistoryQuery(filter.copy(days = days))
                        }
                    }
                }
            }
            if (state.historyLoading) {
                items(2) { FixtureSkeleton(Modifier.fillMaxWidth()) }
            }
            if (state.historyError != null && !state.historyLoading) {
                item {
                    EmptyPanel(tr(state.lang, "Couldn't load history",
                        "دریافت تاریخچه ناموفق بود"), state.historyError) {
                        model.refreshBetHistory()
                    }
                }
            }
            if (!state.historyLoading && state.historyError == null &&
                state.historyBets.isEmpty()) {
                item {
                    EmptyPanel(tr(state.lang, "No tickets match these filters",
                        "بلیتی با این مشخصات موجود نیست"),
                        tr(state.lang,
                            "Change the filters to explore your history.",
                            "برای مشاهده بلیت‌های دیگر، فیلترها را تغییر دهید.")) {
                        model.setBetHistoryQuery(BetHistoryQuery())
                        search = ""
                    }
                }
            }
            items(state.historyBets, key = { "ticket-"+it.id }) { bet ->
                PremiumTicket(bet, state.lang) { model.openBet(bet.id) }
            }
            if (state.historyHasMore) {
                item {
                    OutlinedButton(
                        onClick = { model.refreshBetHistory(more = true) },
                        enabled = !state.historyLoading && !state.historyMoreLoading,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        if (state.historyMoreLoading) CircularProgressIndicator(
                            Modifier.size(18.dp), color = Palette.blue, strokeWidth = 2.dp)
                        else Icon(Icons.Default.ExpandMore, null, tint = Palette.blue)
                        Spacer(Modifier.width(8.dp))
                        Text(tr(state.lang, "Load older tickets", "بارگذاری بلیت‌های قدیمی‌تر"),
                            color = Palette.blue, fontWeight = FontWeight.Bold)
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.VerifiedUser, null, tint = Palette.green,
                        modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(tr(state.lang,
                        "Figures are server-reported. Pending winnings are not account balance.",
                        "ارقام از سرور دریافت می‌شوند؛ برد احتمالی موجودی حساب نیست."),
                        color = Palette.muted, fontSize = 10.sp, lineHeight = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusSegment(lang: Lang, value: String, onChange: (String) -> Unit) {
    val options = listOf("all" to tr(lang, "All", "همه"),
        "open" to tr(lang, "Open", "باز"),
        "settled" to tr(lang, "Finished", "نهایی‌شده"))
    Surface(color = Color(0xFFE2E5EB), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(4.dp)) {
            options.forEach { (key, label) ->
                val active = value == key
                val bg by animateColorAsState(
                    if (active) Palette.blue else Color.Transparent,
                    animationSpec = tween(170), label = "ticketStatusColor")
                Surface(
                    color = bg, shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).heightIn(min = 46.dp)
                        .clickable { onChange(key) }
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(label, color = if (active) Color.White else Palette.text,
                            fontSize = 13.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryChip(label: String, chosen: Boolean, action: () -> Unit) {
    Surface(
        color = if (chosen) Palette.ink else Color(0xFFEDF0F5),
        border = BorderStroke(1.dp, if (chosen) Palette.ink else Palette.border),
        shape = RoundedCornerShape(13.dp),
        modifier = Modifier.clickable(onClick = action)
    ) {
        Text(label, color = if (chosen) Color.White else Palette.text,
            fontSize = 11.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp))
    }
}

@Composable
private fun PremiumTicket(bet: Bet, lang: Lang, onOpen: () -> Unit) {
    val isLost = (bet.netResultMinor?.startsWith("-") == true)
    val accent = when {
        isLost -> Palette.red
        bet.isSettled -> Palette.green
        else -> Palette.blue
    }
    Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column {
            Row(Modifier.fillMaxWidth().padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(color = accent.copy(alpha = .11f),
                    shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.ConfirmationNumber, null,
                        tint = accent, modifier = Modifier.padding(10.dp).size(20.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(if (bet.type.uppercase() == "MULTIPLE" || bet.legs > 1)
                        tr(lang, "Multiple bet", "شرط میکس")
                        else tr(lang, "Single bet", "شرط تکی"),
                        color = Palette.text, fontSize = 14.sp, fontWeight = FontWeight.Black)
                    Text("№ " + bet.id.take(8).uppercase() +
                        " · " + bet.placedAt.take(16).replace("T", " "),
                        color = Palette.muted, fontSize = 10.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Surface(color = accent.copy(alpha = .11f),
                    shape = RoundedCornerShape(10.dp)) {
                    Text(betStatus(bet.status, lang),
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 7.dp),
                        color = accent, fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold, maxLines = 1)
                }
            }
            HorizontalDivider(Modifier.padding(horizontal = 14.dp),
                color = Color(0xFFE7E9EE))
            Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 13.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Stake", "مبلغ شرط"),
                        fontSize = 10.sp, color = Palette.muted)
                    Spacer(Modifier.height(5.dp))
                    Text(money(bet.stakeMinor, bet.currency),
                        fontSize = 15.sp, fontWeight = FontWeight.Black,
                        color = Palette.text)
                }
                Column(Modifier.weight(1f)) {
                    Text(if (bet.settledPayoutMinor != null)
                        tr(lang, "Paid out", "پرداخت‌شده")
                        else tr(lang, "Possible return", "بازگشت احتمالی"),
                        fontSize = 10.sp, color = Palette.muted)
                    Spacer(Modifier.height(5.dp))
                    Text(money(bet.settledPayoutMinor ?: bet.payoutMinor, bet.currency),
                        fontSize = 15.sp, fontWeight = FontWeight.Black,
                        color = if (bet.settledPayoutMinor != null) accent else Palette.text)
                }
            }
            Row(Modifier.fillMaxWidth()
                .background(Color(0xFFF3F4F7))
                .padding(horizontal = 15.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Layers, null, tint = Palette.muted,
                    modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(bet.legs.toString() + " " +
                    tr(lang, "selections", "انتخاب"),
                    color = Palette.muted, fontSize = 11.sp,
                    modifier = Modifier.weight(1f))
                if (bet.combinedOddsScaled != "0") {
                    Text(tr(lang, "Odds", "ضریب") +
                        " " + odds(bet.combinedOddsScaled),
                        color = Palette.blue, fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.width(9.dp))
                }
                Text(tr(lang, "Receipt", "رسید"), fontSize = 11.sp,
                    color = Palette.blue, fontWeight = FontWeight.Bold)
                Icon(Icons.Default.ChevronRight, null,
                    tint = Palette.blue, modifier = Modifier.size(17.dp))
            }
        }
    }
}
