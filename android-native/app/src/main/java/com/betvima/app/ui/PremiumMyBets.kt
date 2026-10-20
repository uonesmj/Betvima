package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.alpha
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
    var activeFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var openedTicket by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(filter) { openedTicket = null }
    LaunchedEffect(filter.search) {
        if (filter.search.isNotBlank()) {
            model.setBetHistoryQuery(filter.copy(search = ""))
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Color(0xFF081322)),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    , flingBehavior = rememberPremiumFlingBehavior()) {
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
            item(key = "history-filters") {
                Surface(
                    modifier = Modifier.fillMaxWidth().animateContentSize(),
                    shape = RoundedCornerShape(15.dp),
                    color = Color(0xFF13243B),
                    border = BorderStroke(1.dp, Color(0xFF324760))
                ) {
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                            .padding(6.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HistoryFilterTrigger(
                            title = tr(state.lang, "Status", "وضعیت"),
                            selected = when(filter.status) {
                                "open" -> tr(state.lang, "Open", "باز")
                                "settled" -> tr(state.lang, "Finished", "نهایی")
                                else -> tr(state.lang, "All", "همه")
                            },
                            active = filter.status != "all",
                            modifier = Modifier.width(130.dp)
                        ) { activeFilter = "status" }
                        HistoryFilterTrigger(
                            title = tr(state.lang, "Bet type", "نوع شرط"),
                            selected = when(filter.type) {
                                "single" -> tr(state.lang, "Single", "تکی")
                                "multiple" -> tr(state.lang, "Multiple", "میکس")
                                else -> tr(state.lang, "All", "همه")
                            },
                            active = filter.type != "all",
                            modifier = Modifier.width(130.dp)
                        ) { activeFilter = "type" }
                        HistoryFilterTrigger(
                            title = tr(state.lang, "Date", "تاریخ"),
                            selected = if (filter.days == 0) tr(state.lang, "Any time", "همه")
                                else filter.days.toString() + " " + tr(state.lang, "days", "روز"),
                            active = filter.days != 0,
                            modifier = Modifier.width(130.dp)
                        ) { activeFilter = "days" }
                        IconButton(
                            onClick = { model.refreshBetHistory() },
                            modifier = Modifier.size(38.dp)
                        ) {
                            Icon(Icons.Default.Refresh,
                                tr(state.lang, "Refresh tickets", "تازه‌سازی شرط‌ها"),
                                tint = Color(0xFF81C5FF))
                        }
                        if (filter.status != "all" || filter.type != "all" ||
                            filter.days != 0 || filter.search.isNotBlank()) {
                            IconButton(onClick = {
                                model.setBetHistoryQuery(BetHistoryQuery())
                            }, modifier = Modifier.size(38.dp)) {
                                Icon(Icons.Default.RestartAlt,
                                    tr(state.lang, "Clear all filters", "پاک‌کردن همه فیلترها"),
                                    tint = Color(0xFF95B0CB))
                            }
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
                    }
                }
            }
            items(state.historyBets, key = { "ticket-"+it.id }) { bet ->
                val isOpen = openedTicket == bet.id ||
                    (openedTicket == null && state.historyBets.firstOrNull()?.id == bet.id)
                PremiumTicket(
                    bet = bet, state = state, expanded = isOpen,
                    onToggle = { openedTicket = if (isOpen) "" else bet.id }
                )
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
    if (activeFilter != null && state.signedIn) {
        HistoryFilterPopup(
            kind = activeFilter!!, filter = state.historyQuery, lang = state.lang,
            onSelect = { next ->
                activeFilter = null
                model.setBetHistoryQuery(next)
            },
            onClose = { activeFilter = null }
        )
    }
}

@Composable
private fun HistoryFilterTrigger(
    title: String, selected: String, active: Boolean,
    modifier: Modifier = Modifier, onClick: () -> Unit
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(15.dp),
        color = if (active) Color(0xFF173B53) else Color(0xFF15263C),
        border = BorderStroke(1.dp, if (active) Palette.blue else Color(0xFF2C4361))
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 10.sp, color = Color(0xFF9CB0C5),
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(selected, modifier = Modifier.weight(1f),
                    color = if (active) Color(0xFF86C4FF) else Color.White,
                    fontSize = 12.sp, fontWeight = FontWeight.Black,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Icon(Icons.Default.KeyboardArrowDown, null,
                    modifier = Modifier.size(17.dp),
                    tint = if (active) Color(0xFF86C4FF) else Color(0xFF9CB0C5))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HistoryFilterPopup(
    kind: String, filter: BetHistoryQuery, lang: Lang,
    onSelect: (BetHistoryQuery) -> Unit, onClose: () -> Unit
) {
    val options: List<Triple<String, String, String>> = when(kind) {
        "status" -> listOf(
            Triple("all", tr(lang, "All tickets", "همه بلیت‌ها"),
                tr(lang, "Open and finished tickets", "بلیت‌های باز و نهایی‌شده")),
            Triple("open", tr(lang, "Open", "باز"),
                tr(lang, "Pending and active bets", "شرط‌های در انتظار و باز")),
            Triple("settled", tr(lang, "Finished", "نهایی‌شده"),
                tr(lang, "Settled, voided and refunded", "تسویه‌شده، باطل و برگشتی"))
        )
        "type" -> listOf(
            Triple("all", tr(lang, "All bet types", "همه نوع شرط‌ها"),
                tr(lang, "Single and multiple", "شرط‌های تکی و میکس")),
            Triple("single", tr(lang, "Single", "تکی"),
                tr(lang, "One selection per ticket", "یک انتخاب در هر بلیت")),
            Triple("multiple", tr(lang, "Multiple", "میکس"),
                tr(lang, "Combined selections", "چند انتخاب در یک بلیت"))
        )
        else -> listOf(
            Triple("0", tr(lang, "All dates", "همه تاریخ‌ها"),
                tr(lang, "No date restriction", "بدون محدودیت زمانی")),
            Triple("7", tr(lang, "Last 7 days", "۷ روز گذشته"),
                tr(lang, "Recent bets", "شرط‌های اخیر")),
            Triple("30", tr(lang, "Last 30 days", "۳۰ روز گذشته"),
                tr(lang, "This month", "ماه اخیر")),
            Triple("90", tr(lang, "Last 90 days", "۹۰ روز گذشته"),
                tr(lang, "Last three months", "سه ماه اخیر"))
        )
    }
    val chosen = when (kind) {
        "status" -> filter.status
        "type" -> filter.type
        else -> filter.days.toString()
    }
    val heading = when (kind) {
        "status" -> tr(lang, "Ticket status", "وضعیت بلیت‌ها")
        "type" -> tr(lang, "Bet type", "نوع شرط")
        else -> tr(lang, "Time period", "بازه زمانی")
    }
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(heading, fontSize = 20.sp, fontWeight = FontWeight.Black,
                        color = Palette.text)
                    Text(tr(lang, "Choose one filter", "یک گزینه انتخاب کنید"),
                        fontSize = 12.sp, color = Palette.muted)
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, tr(lang, "Close", "بستن"), tint = Palette.muted)
                }
            }
            options.forEach { (key, label, subtitle) ->
                val selected = key == chosen
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable {
                        onSelect(when (kind) {
                            "status" -> filter.copy(status = key)
                            "type" -> filter.copy(type = key)
                            else -> filter.copy(days = key.toInt())
                        })
                    },
                    shape = RoundedCornerShape(15.dp),
                    color = if (selected) Color(0xFFEAF5FF) else Color(0xFFF7F9FC),
                    border = BorderStroke(1.dp,
                        if (selected) Palette.blue else Color(0xFFE2E7EE))
                ) {
                    Row(Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(label, fontWeight = FontWeight.Bold,
                                color = Palette.text, fontSize = 14.sp)
                            Spacer(Modifier.height(3.dp))
                            Text(subtitle, color = Palette.muted, fontSize = 11.sp)
                        }
                        Icon(if (selected) Icons.Default.RadioButtonChecked
                            else Icons.Default.RadioButtonUnchecked, null,
                            tint = if (selected) Palette.blue else Palette.muted)
                    }
                }
            }
        }
    }
}

/**
 * Compact, legible ticket ledger card. Selection grade and confirmed returns
 * remain separate from any live score, so no ungraded leg is shown as won.
 */
@Composable
private fun PremiumTicket(
    bet: Bet,
    state: AppState,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    val lang = state.lang
    var showAllPicks by rememberSaveable(bet.id) { mutableStateOf(false) }
    val accent = ticketResultColor(bet)
    val isMix = bet.type.equals("MULTIPLE", ignoreCase = true) || bet.legs > 1
    val title = if (isMix)
        tr(lang, "Mix bet", "شرط میکس") + " (" + bet.legs + " " +
            tr(lang, "picks", "انتخاب") + ")"
        else tr(lang, "Single bet", "شرط تکی")
    val green = Color(0xFF00BB81)
    val ink = Color(0xFF14243A)
    val muted = Color(0xFF77889A)
    Box(Modifier.fillMaxWidth()) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 3.dp),
        shape = RoundedCornerShape(18.dp),
        color = if (expanded) Color.White else Color(0xFF102035),
        border = BorderStroke(1.dp,
            if (expanded) green else Color(0xFF2A4260)),
        shadowElevation = if (expanded) 6.dp else 1.dp
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            if (expanded) listOf(Color(0xFF006B53), Color(0xFF00A77B))
                            else listOf(Color(0xFF123152), Color(0xFF091629))
                        )
                    ).clickable(onClick = onToggle)
                    .padding(horizontal = 11.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = if (expanded) Color(0xFFE9FFF4) else Color(0xFFE5F2FF),
                    shape = RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.ConfirmationNumber, null,
                        tint = if (expanded) Color(0xFF029A71) else Palette.blue,
                        modifier = Modifier.padding(8.dp).size(19.dp))
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Black,
                        fontSize = 14.sp, color = Color.White,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("ID " + bet.id.take(8).uppercase() +
                            " · " + bet.placedAt.take(16).replace("T", " "),
                        fontSize = 10.sp, color = Color.White.copy(alpha = .72f),
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(6.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (accent == Palette.green)
                        Color(0xFFD8FAEA) else if (accent == Palette.red)
                        Color(0xFFFFE0E6) else Color(0xFFE5F0FF)
                ) {
                    Text(ticketResult(bet, lang),
                        color = accent, fontWeight = FontWeight.Black,
                        fontSize = 11.sp, maxLines = 1,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp))
                }
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    tr(lang, if (expanded) "Collapse ticket" else "Expand ticket",
                        if (expanded) "بستن بلیت" else "بازکردن بلیت"),
                    modifier = Modifier.padding(start = 4.dp).size(20.dp),
                    tint = Color.White
                )
            }
            AnimatedVisibility(visible = expanded) {
                Column {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 11.dp, end = 11.dp,
                            top = 9.dp, bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        TicketMoneyColumn(
                            tr(lang, "Stake", "مبلغ شرط"),
                            money(bet.stakeMinor, bet.currency),
                            Modifier.weight(1f), ink
                        )
                        TicketMoneyColumn(
                            tr(lang, "Total odds", "ضریب کل"),
                            odds(bet.combinedOddsScaled),
                            Modifier.weight(0.85f), ink
                        )
                        TicketMoneyColumn(
                            if (bet.settledPayoutMinor != null)
                                tr(lang, "Confirmed return", "بازگشت قطعی")
                            else tr(lang, "Potential return", "بازگشت احتمالی"),
                            money(bet.settledPayoutMinor ?: bet.payoutMinor, bet.currency),
                            Modifier.weight(1.25f),
                            if (bet.settledPayoutMinor != null) accent else ink
                        )
                    }
                    if (bet.isSettled && bet.netResultMinor != null) {
                        Row(
                            Modifier.fillMaxWidth().padding(start = 11.dp, end = 11.dp,
                                bottom = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(tr(lang, "Net result", "سود / زیان خالص"),
                                color = muted, fontSize = 11.sp,
                                modifier = Modifier.weight(1f))
                            Text(money(bet.netResultMinor, bet.currency),
                                color = accent, fontSize = 14.sp,
                                fontWeight = FontWeight.Black)
                        }
                    }
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 9.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        bet.selections.take(if (showAllPicks) bet.selections.size else 2).forEach { leg ->
                            Box(Modifier.fillMaxWidth()) {
                                BetSelectionOverview(leg, lang,
                                    Modifier.fillMaxWidth(), state.matchForLeg(leg), compact = true)
                                Text(
                                    "BETVIMA",
                                    modifier = Modifier.align(Alignment.Center).alpha(.055f),
                                    fontSize = 30.sp, fontWeight = FontWeight.Black,
                                    color = Color(0xFF008965), maxLines = 1
                                )
                            }
                        }
                        if (bet.selections.isEmpty()) {
                            Text(
                                tr(lang, "Selection details are not available",
                                    "اطلاعات انتخاب‌ها در دسترس نیست"),
                                fontSize = 12.sp, color = muted,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                    if (bet.selections.size > 2) {
                        TextButton(
                            onClick = { showAllPicks = !showAllPicks },
                            modifier = Modifier.fillMaxWidth().heightIn(min = 34.dp)
                        ) {
                            Icon(
                                if (showAllPicks) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                null, modifier = Modifier.size(16.dp), tint = Palette.green
                            )
                            Spacer(Modifier.width(5.dp))
                            Text(
                                if (showAllPicks) tr(lang, "Show fewer picks", "نمایش کمتر")
                                else tr(lang, "Show remaining picks", "نمایش انتخاب‌های دیگر"),
                                color = Color(0xFF06835F), fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(Modifier.height(5.dp))
                    Row(
                        Modifier.fillMaxWidth()
                            .background(Color(0xFFF0F5F9))
                            .padding(start = 11.dp, end = 11.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Layers, null, tint = muted,
                            modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(bet.legs.toString() + " " + tr(lang, "picks", "انتخاب"),
                            color = muted, fontSize = 11.sp)
                        Spacer(Modifier.width(9.dp))
                        Text(tr(lang, "Odds", "ضریب") + " " + odds(bet.combinedOddsScaled),
                            color = ink, fontSize = 11.sp, fontWeight = FontWeight.Black)

                    }
                }
            }
        }
    }
    // Dark edge cutouts produce a ticket silhouette; they never change the data.
    Surface(
        modifier = Modifier.align(Alignment.CenterStart).offset(x = (-5).dp).size(17.dp),
        color = Color(0xFF081322), shape = CircleShape
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.CenterEnd).offset(x = 5.dp).size(17.dp),
        color = Color(0xFF081322), shape = CircleShape
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.TopCenter).offset(y = (-5).dp)
            .width(29.dp).height(11.dp),
        color = Color(0xFF081322),
        shape = RoundedCornerShape(bottomStart = 9.dp, bottomEnd = 9.dp)
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.BottomCenter).offset(y = 5.dp)
            .width(29.dp).height(11.dp),
        color = Color(0xFF081322),
        shape = RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp)
    ) {}
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
