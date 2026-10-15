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
    , flingBehavior = rememberPremiumFlingBehavior()) {
        item(key = "bets-heading") {
            Surface(
                color = Color.White, shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, Color(0xFFE1E7EE))
            ) {
                Row(Modifier.fillMaxWidth().padding(15.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color(0xFFE5F2FF),
                        shape = RoundedCornerShape(13.dp)) {
                        Icon(Icons.Default.ReceiptLong, null,
                            tint = Palette.blue,
                            modifier = Modifier.padding(12.dp).size(23.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "My Bets", "شرط‌های من"),
                            color = Palette.text, fontSize = 21.sp,
                            fontWeight = FontWeight.Black)
                        Spacer(Modifier.height(3.dp))
                        Text(tr(state.lang,
                            "Every selection, score and settlement in one place",
                            "انتخاب‌ها، نتایج و تسویه هر بلیت در یک نگاه"),
                            color = Palette.muted, fontSize = 11.sp,
                            lineHeight = 16.sp)
                    }
                    if (state.signedIn) Surface(
                        color = Color(0xFFF2F5F9),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(state.historyBets.size.toString(),
                            color = Palette.text, fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp))
                    }
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
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp), flingBehavior = rememberPremiumFlingBehavior()) {
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
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp), flingBehavior = rememberPremiumFlingBehavior()) {
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
                PremiumTicket(bet, state) { model.openBet(bet.id) }
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

/**
 * Compact, legible ticket ledger card. Selection grade and confirmed returns
 * remain separate from any live score, so no ungraded leg is shown as won.
 */
@Composable
private fun PremiumTicket(bet: Bet, state: AppState, onOpen: () -> Unit) {
    val lang = state.lang
    val accent = ticketResultColor(bet)
    val final = bet.isSettled
    var expanded by rememberSaveable(bet.id) { mutableStateOf(false) }
    val count = bet.selections.size
    val hasExtra = count > 2
    val title = if (bet.type.uppercase() == "MULTIPLE" || bet.legs > 1)
        tr(lang, "Multiple bet", "شرط میکس") else tr(lang, "Single bet", "شرط تکی")
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(21.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFDFE6EE)),
        shadowElevation = 2.dp
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(Color(0xFFF6F9FC))
                    .padding(horizontal = 14.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = Color(0xFFE7F3FF), shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.ConfirmationNumber, null,
                        tint = Palette.blue, modifier = Modifier.padding(11.dp).size(21.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Black,
                        fontSize = 15.sp, color = Palette.text)
                    Text("№ " + bet.id.take(8).uppercase() +
                        "  ·  " + bet.placedAt.take(16).replace("T", " "),
                        fontSize = 10.sp, color = Palette.muted,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(6.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = accent.copy(alpha = .12f)
                ) {
                    Text(ticketResult(bet, lang),
                        color = accent, fontWeight = FontWeight.Black,
                        fontSize = 11.sp, maxLines = 1,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp))
                }
            }
            HorizontalDivider(color = Color(0xFFE4EAF0))
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 13.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                TicketMoneyColumn(
                    title = tr(lang, "Stake", "مبلغ شرط"),
                    amount = money(bet.stakeMinor, bet.currency),
                    modifier = Modifier.weight(1f),
                    color = Palette.text
                )
                TicketMoneyColumn(
                    title = if (bet.settledPayoutMinor != null)
                        tr(lang, "Confirmed return", "بازگشت قطعی")
                    else tr(lang, "Potential return", "بازگشت احتمالی"),
                    amount = money(bet.settledPayoutMinor ?: bet.payoutMinor, bet.currency),
                    modifier = Modifier.weight(1f),
                    color = if (bet.settledPayoutMinor != null) accent else Palette.text
                )
            }
            if (final && bet.netResultMinor != null) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 15.dp, end = 15.dp, bottom = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(tr(lang, "Net result", "سود / زیان خالص"),
                        modifier = Modifier.weight(1f),
                        color = Palette.muted, fontSize = 11.sp)
                    Text(money(bet.netResultMinor, bet.currency),
                        color = accent, fontWeight = FontWeight.Black,
                        fontSize = 13.sp)
                }
            }
            if (count > 0) {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    bet.selections.take(2).forEach { leg ->
                        BetSelectionOverview(leg, lang,
                            Modifier.fillMaxWidth(), state.matchForLeg(leg))
                    }
                    if (hasExtra) {
                        SmoothExpandedContent(expanded) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                bet.selections.drop(2).forEach { leg ->
                                    BetSelectionOverview(leg, lang,
                                        Modifier.fillMaxWidth(), state.matchForLeg(leg))
                                }
                            }
                        }
                        TextButton(onClick = { expanded = !expanded },
                            modifier = Modifier.fillMaxWidth()) {
                            SmoothExpandChevron(expanded, tint = Palette.blue)
                            Spacer(Modifier.width(5.dp))
                            Text(if (expanded) tr(lang, "Show less", "نمایش کمتر")
                                else tr(lang, "View all selections", "نمایش تمام انتخاب‌ها"),
                                color = Palette.blue,
                                fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
            }
            Row(
                Modifier.fillMaxWidth()
                    .background(Color(0xFFF4F7FA))
                    .padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Layers, null, tint = Palette.muted,
                    modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(5.dp))
                Text(bet.legs.toString() + " " + tr(lang, "picks", "انتخاب"),
                    color = Palette.muted, fontSize = 11.sp)
                Spacer(Modifier.width(9.dp))
                if (bet.combinedOddsScaled != "0") {
                    Text(tr(lang, "Odds", "ضریب") + " " + odds(bet.combinedOddsScaled),
                        fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        color = Palette.text)
                }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onOpen) {
                    Icon(Icons.Default.ReceiptLong, null, tint = Palette.blue,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(tr(lang, "Full receipt", "رسید کامل"),
                        color = Palette.blue, fontSize = 11.sp,
                        fontWeight = FontWeight.Black)
                    Icon(Icons.Default.ChevronRight, null, tint = Palette.blue,
                        modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
private fun TicketMoneyColumn(
    title: String, amount: String, modifier: Modifier = Modifier,
    color: Color = Palette.text
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, fontSize = 10.sp, color = Palette.muted,
            fontWeight = FontWeight.Medium, maxLines = 2)
        Text(amount, fontSize = 16.sp, fontWeight = FontWeight.Black,
            color = color, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
