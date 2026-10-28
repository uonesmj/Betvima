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

// Match the casino/header canvas; ticket financial surfaces retain their own colors.
private val myBetsCanvas: Color get() = ThemeTokens.canvas
private val myBetsClosedPanel: Color get() = ThemeTokens.panel
private val myBetsClosedOutline: Color get() = ThemeTokens.outline

/**
 * Server-owned history, not a local filter over the initial 30 records.
 * One query and stable pagination per selected filter, with session isolation.
 */
@Composable
fun PremiumMyBetsPage(state: AppState, model: AppViewModel) {
    val filter = state.historyQuery
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    var openedTicket by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(filter) { openedTicket = null }
    LaunchedEffect(filter.search) {
        if (filter.search.isNotBlank()) {
            model.setBetHistoryQuery(filter.copy(search = ""))
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(myBetsCanvas),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    , flingBehavior = rememberPremiumFlingBehavior()) {
        if (!state.signedIn) {
            item {
                LockedFeature(
                    state.lang,
                    tr(state.lang, "Log in to view your private ticket history",
                        "برای مشاهده تاریخچه خصوصی شرط‌ها وارد شوید"),
                    onRegister = { model.showLogin(true, register = true) },
                    icon = Icons.Default.ReceiptLong
                ) {
                    model.showLogin(true)
                }
            }
        } else {
            item(key = "history-filters") {
                val selectedStatus = filter.status
                val refinedFilters = (if (filter.type != "all") 1 else 0) +
                    (if (filter.days != 0) 1 else 0)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // The status query remains server-side. Only the visual
                    // selection slides; no optimistic/fabricated tickets.
                    SmoothThreeTabs184(
                        selected = selectedStatus,
                        options = listOf(
                            SmoothTab184("all", tr(state.lang, "All", "همه")),
                            SmoothTab184("open", tr(state.lang, "Open", "باز")),
                            SmoothTab184("settled", tr(state.lang, "Finished", "نهایی"))
                        ),
                        modifier = Modifier.weight(1f),
                        height = 43.dp,
                        textSize = 11.sp
                    ) { status ->
                        if (filter.status != status) {
                            model.setBetHistoryQuery(filter.copy(status = status))
                        }
                    }
                    Surface(
                        modifier = Modifier.height(43.dp).clickable { filtersOpen = true },
                        shape = RoundedCornerShape(13.dp),
                        color = Color(0xFF252527),
                        border = BorderStroke(1.dp, if (refinedFilters > 0)
                            Palette.blue.copy(alpha = .75f) else Color(0xFF3B3B3F))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(Icons.Default.Tune,
                                tr(state.lang, "Filter bet history", "فیلتر تاریخچه شرط‌ها"),
                                modifier = Modifier.size(17.dp), tint = Color(0xFFDEE1E8))
                            Text(tr(state.lang, "Filters", "فیلتر"),
                                color = Color.White, fontSize = 11.sp,
                                fontWeight = FontWeight.Bold)
                            if (refinedFilters > 0) {
                                Box(Modifier.size(6.dp).background(Palette.blue, CircleShape))
                            }
                        }
                    }
                    IconButton(
                        onClick = { model.refreshBetHistory() },
                        modifier = Modifier.size(34.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            MyBetsRefreshGlyph(
                                loading = state.historyLoading &&
                                    state.historyBets.isNotEmpty(),
                                modifier = Modifier.size(21.dp)
                            )
                        }
                    }
                }
            }
            if (needsMyBetsSkeleton(state.historyLoading, state.historyBets.isNotEmpty())) {
                items(3, key = { "history-skeleton-" + it }) {
                    MyBetsTicketSkeleton(Modifier.fillMaxWidth())
                }
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
    if (filtersOpen && state.signedIn) {
        PremiumHistoryFilterSheet(
            filter = state.historyQuery,
            lang = state.lang,
            onApply = { next ->
                filtersOpen = false
                if (next != state.historyQuery) model.setBetHistoryQuery(next)
            },
            onClose = { filtersOpen = false }
        )
    }
}

/** Shared chip style used by the unified status/type/date bottom sheet. */
@Composable
private fun HistoryChoiceChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.height(44.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) Palette.blue else ThemeTokens.elevated,
        border = BorderStroke(1.dp, if (selected) Color(0xFF55AEFF)
            else ThemeTokens.outline)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 4.dp)) {
            Text(label, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Black
                else FontWeight.Medium, color = if (selected) Color.White
                else ThemeTokens.ink, maxLines = 1,
                overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * One dark sheet for all server-side history filters.
 * Choices are drafts: dismissing keeps applied filters unchanged.
 * Apply submits a single coherent query and Reset only edits the draft.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PremiumHistoryFilterSheet(
    filter: BetHistoryQuery,
    lang: Lang,
    onApply: (BetHistoryQuery) -> Unit,
    onClose: () -> Unit
) {
    var draftStatus by remember(filter) { mutableStateOf(filter.status) }
    var draftType by remember(filter) { mutableStateOf(filter.type) }
    var draftDays by remember(filter) { mutableIntStateOf(filter.days) }
    val dirty = draftStatus != filter.status || draftType != filter.type ||
        draftDays != filter.days
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = ThemeTokens.canvas,
        scrimColor = Color.Black.copy(alpha = .70f),
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
        dragHandle = {
            Box(
                Modifier.padding(top = 11.dp, bottom = 15.dp)
                    .width(37.dp).height(4.dp)
                    .background(Color(0xFF626267), RoundedCornerShape(99.dp))
            )
        }
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 18.dp, end = 18.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Filters", "فیلترها"),
                        color = ThemeTokens.ink, fontSize = 21.sp,
                        fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(3.dp))
                    Text(tr(lang, "Customize your bet history",
                        "تاریخچه شرط‌ها را مطابق نیازتان تنظیم کنید"),
                        color = ThemeTokens.muted, fontSize = 11.sp)
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, tr(lang, "Close", "بستن"),
                        tint = ThemeTokens.muted)
                }
            }
            HorizontalDivider(color = ThemeTokens.outline, thickness = 1.dp)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(tr(lang, "Bet status", "وضعیت شرط"),
                    color = ThemeTokens.ink, fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HistoryChoiceChip(tr(lang, "All", "همه"),
                        draftStatus == "all", Modifier.weight(1f)) {
                        draftStatus = "all"
                    }
                    HistoryChoiceChip(tr(lang, "Open", "باز"),
                        draftStatus == "open", Modifier.weight(1f)) {
                        draftStatus = "open"
                    }
                    HistoryChoiceChip(tr(lang, "Finished", "نهایی"),
                        draftStatus == "settled", Modifier.weight(1f)) {
                        draftStatus = "settled"
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(tr(lang, "Bet type", "نوع شرط"),
                    color = ThemeTokens.ink, fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HistoryChoiceChip(tr(lang, "All", "همه"),
                        draftType == "all", Modifier.weight(1f)) {
                        draftType = "all"
                    }
                    HistoryChoiceChip(tr(lang, "Single", "تکی"),
                        draftType == "single", Modifier.weight(1f)) {
                        draftType = "single"
                    }
                    HistoryChoiceChip(tr(lang, "Multiple", "میکس"),
                        draftType == "multiple", Modifier.weight(1f)) {
                        draftType = "multiple"
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(tr(lang, "Time period", "بازه زمانی"),
                    color = ThemeTokens.ink, fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HistoryChoiceChip(tr(lang, "All dates", "همه تاریخ‌ها"),
                        draftDays == 0, Modifier.weight(1f)) { draftDays = 0 }
                    HistoryChoiceChip(tr(lang, "Last 7 days", "۷ روز گذشته"),
                        draftDays == 7, Modifier.weight(1f)) { draftDays = 7 }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HistoryChoiceChip(tr(lang, "Last 30 days", "۳۰ روز گذشته"),
                        draftDays == 30, Modifier.weight(1f)) { draftDays = 30 }
                    HistoryChoiceChip(tr(lang, "Last 90 days", "۹۰ روز گذشته"),
                        draftDays == 90, Modifier.weight(1f)) { draftDays = 90 }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        draftStatus = "all"
                        draftType = "all"
                        draftDays = 0
                    },
                    modifier = Modifier.weight(1f).height(47.dp),
                    shape = RoundedCornerShape(13.dp),
                    border = BorderStroke(1.dp, ThemeTokens.outline),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = ThemeTokens.elevated,
                        contentColor = ThemeTokens.ink)
                ) {
                    Text(tr(lang, "Reset", "بازنشانی"),
                        fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = {
                        onApply(filter.copy(
                            status = draftStatus, type = draftType, days = draftDays))
                    },
                    modifier = Modifier.weight(2f).height(47.dp),
                    shape = RoundedCornerShape(13.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Palette.blue)
                ) {
                    Icon(Icons.Default.Check, null, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(tr(lang, "Apply filters", "اعمال فیلترها"),
                        fontSize = 13.sp, color = Color.White,
                        fontWeight = FontWeight.Black)
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
    var winReplay by rememberSaveable(bet.id) { mutableIntStateOf(0) }
    val accent = ticketResultColor(bet)
    val confirmedWin = bet.isSettled && accent == Palette.green
    val confirmedLoss = bet.isSettled && accent == Palette.red
    val isMix = bet.type.equals("MULTIPLE", ignoreCase = true) || bet.legs > 1
    val title = if (isMix)
        tr(lang, "Mix bet", "شرط میکس") + " (" + bet.legs + " " +
            tr(lang, "picks", "انتخاب") + ")"
        else tr(lang, "Single bet", "شرط تکی")
    // Only server-settled losing tickets get red presentation.
    // Winning tickets keep their original green style exactly.
    val green = Color(0xFF00BB81)
    val lostRed = Color(0xFFD94C68)
    val expandedFrame = if (confirmedLoss) lostRed else green
    val ink = Color(0xFF14243A)
    val muted = Color(0xFF77889A)
    Box(Modifier.fillMaxWidth()) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 3.dp),
        shape = RoundedCornerShape(18.dp),
        color = if (expanded) Color.White else myBetsClosedPanel,
        border = BorderStroke(1.dp,
            if (expanded) expandedFrame else myBetsClosedOutline),
        shadowElevation = if (expanded) 6.dp else 0.dp
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            if (expanded && confirmedLoss)
                                listOf(Color(0xFF86203C), Color(0xFFD33959))
                            else if (expanded)
                                listOf(Color(0xFF006B53), Color(0xFF00A77B))
                            else listOf(myBetsClosedPanel, myBetsClosedPanel)
                        )
                    ).clickable {
                        if (!expanded && confirmedWin) winReplay++
                        onToggle()
                    }
                    .padding(horizontal = 11.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = if (expanded && confirmedLoss) Color(0xFFFFEBF0)
                    else if (expanded) Color(0xFFE9FFF4) else Color(0xFFE5F2FF),
                    shape = RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.ConfirmationNumber, null,
                        tint = if (expanded && confirmedLoss) Color(0xFFCC3456)
                        else if (expanded) Color(0xFF029A71) else Palette.blue,
                        modifier = Modifier.padding(8.dp).size(19.dp))
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Black,
                        fontSize = 14.sp, color = if (expanded) Color.White else ThemeTokens.ink,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("ID " + bet.id.take(8).uppercase() +
                            " · " + bet.placedAt.take(16).replace("T", " "),
                        fontSize = 10.sp, color = if (expanded) Color.White.copy(alpha = .72f) else ThemeTokens.muted,
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
                                    Modifier.fillMaxWidth(), state.matchForLeg(leg), compact = true,
                                    lossTheme = confirmedLoss)
                                Text(
                                    "BETVIMA",
                                    modifier = Modifier.align(Alignment.Center).alpha(.055f),
                                    fontSize = 30.sp, fontWeight = FontWeight.Black,
                                    color = if (confirmedLoss) Color(0xFFC84060)
                                        else Color(0xFF008965), maxLines = 1
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
        color = myBetsCanvas, shape = CircleShape
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.CenterEnd).offset(x = 5.dp).size(17.dp),
        color = myBetsCanvas, shape = CircleShape
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.TopCenter).offset(y = (-5).dp)
            .width(29.dp).height(11.dp),
        color = myBetsCanvas,
        shape = RoundedCornerShape(bottomStart = 9.dp, bottomEnd = 9.dp)
    ) {}
    Surface(
        modifier = Modifier.align(Alignment.BottomCenter).offset(y = 5.dp)
            .width(29.dp).height(11.dp),
        color = myBetsCanvas,
        shape = RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp)
    ) {}
    // Overlay does not intercept taps; it only paints above the ticket for ~1s.
    if (expanded && confirmedWin) {
        WinTicketSparklers(
            replay = winReplay,
            modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().height(115.dp)
        )
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
