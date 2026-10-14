package com.betvima.app.ui

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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import coil.compose.AsyncImage
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip

private val sports = listOf("football", "basketball", "tennis", "volleyball",
    "hockey", "table-tennis", "baseball", "esports")
private fun sportName(s: String) = s.replace("-", " ").replaceFirstChar { it.uppercase() }

private fun sportIcon(sport: String): androidx.compose.ui.graphics.vector.ImageVector = when (sport) {
    "football" -> Icons.Default.SportsSoccer
    "basketball" -> Icons.Default.SportsBasketball
    "tennis", "table-tennis" -> Icons.Default.SportsTennis
    "volleyball" -> Icons.Default.SportsVolleyball
    "hockey" -> Icons.Default.SportsHockey
    "baseball" -> Icons.Default.SportsBaseball
    "esports" -> Icons.Default.VideogameAsset
    else -> Icons.Default.EmojiEvents
}

@Composable
fun SportsRibbon(selected: String, lang: Lang, showEsports: Boolean = true,
    onChange: (String) -> Unit) {
    val visibleSports = if (showEsports) sports else sports.filterNot { it == "esports" }
    LazyRow(contentPadding = PaddingValues(vertical = 5.dp, horizontal = 1.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        items(visibleSports, key = { it }) { sport ->
            val active = selected == sport
            val label = if (lang == Lang.FA) when (sport) {
                "football" -> "فوتبال"; "basketball" -> "بسکتبال"; "tennis" -> "تنیس"
                "volleyball" -> "والیبال"; "hockey" -> "هاکی روی یخ"
                "table-tennis" -> "پینگ‌پنگ"; "baseball" -> "بیسبال"
                "esports" -> "ورزش الکترونیک"; else -> sportName(sport)
            } else sportName(sport)
            Column(Modifier.width(71.dp).clickable { onChange(sport) }
                .padding(vertical = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(shape = CircleShape,
                    color = if (active) Palette.green else Color.White,
                    border = BorderStroke(1.dp, if (active) Palette.green else Palette.border),
                    shadowElevation = if (active) 3.dp else 0.dp) {
                    Box(Modifier.size(53.dp), contentAlignment = Alignment.Center) {
                        Icon(sportIcon(sport), contentDescription = label,
                            modifier = Modifier.size(25.dp),
                            tint = if (active) Palette.ink else Palette.blue)
                    }
                }
                Text(label, fontSize = 10.sp, fontWeight =
                    if (active) FontWeight.ExtraBold else FontWeight.Medium,
                    color = if (active) Palette.ink else Palette.muted,
                    modifier = Modifier.padding(top = 7.dp),
                    maxLines = 1)
            }
        }
    }
}

@Composable
fun HomePage(state: AppState, model: AppViewModel) {
    LazyColumn(contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item {
            BrandHero(state.lang, state.live.size,
                onLive = { model.tab(Tab.LIVE) }, onSports = { model.tab(Tab.SPORTS) })
        }
        item {
            SportsRibbon(state.sport, state.lang, showEsports = false) {
                model.sport(it); model.tab(Tab.SPORTS)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                BvStatCard(tr(state.lang, "LIVE", "زنده"), state.live.size.toString(),
                    Icons.Default.Sensors, Palette.red, Modifier.weight(1f))
                BvStatCard(tr(state.lang, "UPCOMING", "آینده"), state.upcoming.size.toString(),
                    Icons.Default.Event, Palette.blue, Modifier.weight(1f))
                BvStatCard(tr(state.lang, "MY PICKS", "انتخاب‌ها"), state.picks.size.toString(),
                    Icons.Default.ConfirmationNumber, Palette.green, Modifier.weight(1f))
            }
        }
        item { SectionHeading(tr(state.lang, "Live now", "هم‌اکنون زنده"),
            tr(state.lang, "Scores and live markets", "نتایج و بازارهای زنده"),
            tr(state.lang, "View all", "مشاهده همه")) { model.tab(Tab.LIVE) } }
        if (state.live.isEmpty()) {
            item { EmptyPanel(tr(state.lang, "No live fixtures", "مسابقه زنده موجود نیست"),
                tr(state.lang, "When matches become available they will appear here.",
                    "با شروع مسابقات، فهرست اینجا نمایش داده می‌شود.")) { model.refreshLive() } }
        } else {
            items(state.live.take(4), key = { "home-live-" + it.id }) { match ->
                MatchTile(match, state.lang, state.liveEnabled, state.picks,
                    { model.openMatch(match.id) }) { m, s -> model.togglePick(match, m, s) }
            }
        }
        val featured = state.upcoming.filter { match ->
            match.bettingAvailable && match.featured?.available == true &&
                match.featured?.selections?.any { it.available } == true
        }.sortedByDescending { it.marketsCount }.take(4)
        item {
            SectionHeading(tr(state.lang, "Top bets", "شرط‌های برتر"),
                tr(state.lang, "Upcoming games with the widest available markets",
                    "مسابقات آینده با بیشترین بازار قابل انتخاب"),
                tr(state.lang, "View all", "مشاهده همه")) { model.tab(Tab.SPORTS) }
        }
        if (featured.isEmpty()) item {
            EmptyPanel(tr(state.lang, "No featured markets now", "بازار برتری در دسترس نیست"),
                tr(state.lang, "Live data is refreshed from the official provider.",
                    "فهرست بازارها مستقیماً از منبع رسمی دریافت می‌شود.")) {
                model.refreshUpcoming()
            }
        } else items(featured, key = { "featured-" + it.id }) { match ->
            MatchTile(match, state.lang, state.liveEnabled, state.picks,
                { model.openMatch(match.id) }) { market, selection ->
                model.togglePick(match, market, selection)
            }
        }
        item { SectionHeading(tr(state.lang, "Upcoming matches", "مسابقات آینده"),
            tr(state.lang, "Popular pre-match selections", "بازارهای پیش از شروع"),
            tr(state.lang, "View all", "مشاهده همه")) { model.tab(Tab.SPORTS) } }
        if (state.upcoming.isEmpty()) {
            item { EmptyPanel(tr(state.lang, "No scheduled matches", "مسابقه آینده‌ای یافت نشد"),
                tr(state.lang, "Try another sport or refresh the catalogue.",
                    "رشته دیگری انتخاب کنید یا فهرست را تازه‌سازی کنید.")) { model.refreshUpcoming() } }
        } else {
            items(state.upcoming.take(8), key = { "home-upcoming-" + it.id }) { match ->
                MatchTile(match, state.lang, state.liveEnabled, state.picks,
                    { model.openMatch(match.id) }) { m, s -> model.togglePick(match, m, s) }
            }
        }
        item { FeatureShortcuts(state.lang, model) }
        item { ResponsibleNote(state.lang) }
    }
}



@Composable
fun CatalogPage(state: AppState, model: AppViewModel, live: Boolean) {
    val matches = if (live) state.live else state.upcoming
    val title = if (live) tr(state.lang, "Live center", "مرکز زنده")
        else tr(state.lang, "Sports & fixtures", "ورزش‌ها و مسابقات")
    val groups = matches.groupBy { it.league + "|" + it.country }
    LazyColumn(contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            BvPageBanner(
                eyebrow = if (live) tr(state.lang, "LIVE CENTER", "مرکز زنده")
                    else tr(state.lang, "ALL SPORTS", "تمام ورزش‌ها"),
                title = title,
                subtitle = tr(state.lang,
                    "Browse leagues, match scores and server-sourced prices.",
                    "لیگ‌ها، نتایج و ضرایب تأییدشده را دنبال کنید."),
                icon = if (live) Icons.Default.Sensors else Icons.Default.SportsSoccer,
                accent = if (live) Palette.red else Palette.green
            ) {
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SmallPill(matches.size.toString() + tr(state.lang, " events", " رویداد"),
                        Color.White.copy(alpha = .12f), Color.White)
                    Spacer(Modifier.width(9.dp))
                    if (live) SmallPill(tr(state.lang, "AUTO REFRESH", "به‌روزرسانی خودکار"),
                        Palette.green.copy(alpha = .16f), Palette.green)
                }
            }
        }
        item {
            SectionHeading(tr(state.lang, "Competitions", "رقابت‌ها"),
                tr(state.lang, "Tap a league to expand its fixtures.",
                    "برای مشاهده مسابقات، لیگ را باز کنید."),
                tr(state.lang, "Refresh", "تازه‌سازی")) {
                    if (live) model.refreshLive() else model.refreshUpcoming()
                }
            if (live && !state.liveEnabled) {
                Surface(color = Color(0xFFFFF3E2), shape = RoundedCornerShape(13.dp),
                    modifier = Modifier.fillMaxWidth()) {
                    Text(tr(state.lang,
                        "Live wagering currently paused. Prices are view-only.",
                        "ثبت شرط زنده موقتاً متوقف است و ضرایب فقط نمایشی هستند."),
                        modifier = Modifier.padding(12.dp), fontSize = 12.sp, color = Color(0xFF865A19))
                }
            }
        }
        if (!live) item { SportsRibbon(state.sport, state.lang) { model.sport(it) } }
        if ((if (live) state.liveLoading else state.upcomingLoading) && matches.isEmpty()) item {
            Box(Modifier.fillMaxWidth().height(90.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Palette.green)
            }
        }
        if (!(if (live) state.liveLoading else state.upcomingLoading) && matches.isEmpty()) item {
            EmptyPanel(tr(state.lang, "No events available", "رویدادی موجود نیست"),
                tr(state.lang, "The live feed may be between match windows.",
                    "ممکن است در حال حاضر مسابقه‌ای از منبع داده منتشر نشده باشد.")) {
                if (live) model.refreshLive() else model.refreshUpcoming()
            }
        }
        groups.entries.forEachIndexed { index, group ->
            item(key = "league-" + group.key) {
                LeagueSection(group.key, group.value, index == 0, state, model)
            }
        }
        item { ResponsibleNote(state.lang) }
    }
}

@Composable
private fun LeagueSection(key: String, matches: List<Match>, first: Boolean,
    state: AppState, model: AppViewModel) {
    var expanded by rememberSaveable(key) { mutableStateOf(first) }
    Column {
        Surface(Modifier.fillMaxWidth().clickable { expanded = !expanded },
            color = if (expanded) Palette.ink else Color.White,
            border = BorderStroke(1.dp,
                if (expanded) Palette.dark else Palette.border),
            shape = RoundedCornerShape(16.dp), shadowElevation = 1.dp) {
            Row(Modifier.heightIn(min = 67.dp)
                .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                val logo = matches.first().leagueLogo
                Surface(shape = RoundedCornerShape(12.dp),
                    color = if (expanded) Color.White.copy(alpha = .13f) else Palette.paper) {
                    Box(Modifier.size(42.dp), contentAlignment = Alignment.Center) {
                        if (logo?.startsWith("https://") == true) AsyncImage(
                            model = logo, contentDescription = matches.first().league,
                            modifier = Modifier.size(30.dp))
                        else Icon(Icons.Default.EmojiEvents, null,
                            tint = if (expanded) Palette.green else Palette.blue,
                            modifier = Modifier.size(22.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(matches.first().league,
                        color = if (expanded) Color.White else Palette.text,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, maxLines = 2)
                    Text(matches.first().country.ifBlank {
                        tr(state.lang, "International", "بین‌المللی") },
                        color = if (expanded) Color(0xFFA5BAC6) else Palette.muted,
                        fontSize = 10.sp)
                }
                SmallPill(matches.size.toString(),
                    if (expanded) Palette.green.copy(alpha = .16f) else Palette.greenLight,
                    if (expanded) Palette.green else Palette.ink)
                Spacer(Modifier.width(7.dp))
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    tr(state.lang, "Expand league", "باز کردن لیگ"),
                    tint = if (expanded) Color.White else Palette.muted)
            }
        }
        if (expanded) {
            Spacer(Modifier.height(6.dp))
            matches.forEach { match ->
                MatchTile(match, state.lang, state.liveEnabled, state.picks,
                    { model.openMatch(match.id) }) { market, selection ->
                    model.togglePick(match, market, selection)
                }
            }
        }
    }
}

fun betStatus(status: String, lang: Lang): String = when (status.lowercase()) {
    "pending" -> tr(lang, "Pending", "در انتظار ثبت")
    "accepted" -> tr(lang, "Open", "باز")
    "partially_settled" -> tr(lang, "Partially settled", "تسویه جزئی")
    "settled" -> tr(lang, "Settled", "تسویه‌شده")
    "void" -> tr(lang, "Void", "باطل")
    "refunded" -> tr(lang, "Refunded", "برگشت‌خورده")
    "cancelled" -> tr(lang, "Cancelled", "لغوشده")
    "rejected" -> tr(lang, "Rejected", "ردشده")
    "manual_review" -> tr(lang, "Under review", "در حال بررسی")
    "cashed_out" -> tr(lang, "Cashed out", "تسویه زودهنگام")
    else -> status.replace("_", " ")
}

@Composable
fun BetsPage(state: AppState, model: AppViewModel) {
    var selectedFilter by rememberSaveable { mutableIntStateOf(0) }
    val labels = listOf(
        tr(state.lang, "All", "همه"),
        tr(state.lang, "Open", "باز"),
        tr(state.lang, "Settled", "تسویه‌شده")
    )
    val filtered = state.bets.filter { selectedFilter == 0 ||
        if (selectedFilter == 1) !it.isSettled else it.isSettled }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "MY BETS", "شرط‌های من"),
                title = tr(state.lang, "Your bet history", "همه شرط‌ها، یک‌جا"),
                subtitle = tr(state.lang,
                    "Track your tickets and view their server-confirmed settlement.",
                    "وضعیت بلیت‌ها و تسویه‌های قطعی را مستقیم از سرور پیگیری کنید."),
                icon = Icons.Default.ReceiptLong
            ) {
                Spacer(Modifier.height(3.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SmallPill(state.bets.count { !it.isSettled }.toString() +
                        tr(state.lang, " Open", " باز"),
                        Color.White.copy(alpha = .12f), Color.White)
                    SmallPill(state.bets.count { it.isSettled }.toString() +
                        tr(state.lang, " Settled", " تسویه‌شده"),
                        Palette.green.copy(alpha = .16f), Palette.green)
                }
            }
        }
        item {
            SectionHeading(tr(state.lang, "My bets", "شرط‌های من"),
                tr(state.lang, "Ticket history verified by the server", "سابقه شرط‌ها طبق اطلاعات سرور"),
                tr(state.lang, "Refresh", "تازه‌سازی")) { model.refreshAccount() }
        }
        if (!state.signedIn) item {
            LockedFeature(state.lang, tr(state.lang, "Sign in to see your tickets",
                "برای مشاهده شرط‌های خود وارد شوید")) { model.showLogin(true) }
        } else {
            if (state.accountLoading) item {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(labels.size) { index ->
                        FilterChip(
                            selected = selectedFilter == index,
                            onClick = { selectedFilter = index },
                            label = { Text(labels[index], fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Palette.greenLight,
                                selectedLabelColor = Palette.ink
                            )
                        )
                    }
                }
            }
            if (filtered.isEmpty() && !state.accountLoading) item {
                EmptyPanel(tr(state.lang, "No matching bet tickets", "شرطی با این وضعیت موجود نیست"),
                    tr(state.lang, "Only confirmed records are displayed.",
                        "فقط سوابق تأییدشده سرور نمایش داده می‌شود.")) {
                    model.refreshAccount()
                }
            }
            items(filtered, key = { it.id }) { bet ->
                Surface(modifier = Modifier.fillMaxWidth().clickable { model.openBet(bet.id) },
                    shape = RoundedCornerShape(19.dp), color = Color.White,
                    shadowElevation = 1.dp,
                    border = BorderStroke(1.dp, Palette.border)) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = if (bet.isSettled) Palette.greenLight else Palette.paper,
                                shape = RoundedCornerShape(11.dp)) {
                                Icon(Icons.Default.ReceiptLong, null,
                                    tint = if (bet.isSettled) Palette.ink else Palette.blue,
                                    modifier = Modifier.padding(10.dp).size(19.dp))
                            }
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(if (bet.legs > 1)
                                    tr(state.lang, "Multiple · ", "میکس · ") + bet.legs
                                    else tr(state.lang, "Single", "تکی"),
                                    fontSize = 12.sp, fontWeight = FontWeight.Black, color = Palette.text)
                                if (bet.placedAt.isNotBlank()) {
                                    Text(bet.placedAt.take(16).replace("T", " · "),
                                        fontSize = 10.sp, color = Palette.muted)
                                }
                            }
                            SmallPill(betStatus(bet.status, state.lang), Palette.paper,
                                if (bet.isSettled) Palette.green else Palette.muted)
                        }
                        Spacer(Modifier.height(13.dp))
                        HorizontalDivider(color = Palette.border)
                        Spacer(Modifier.height(12.dp))
                        Row {
                            Column(Modifier.weight(1f)) {
                                Text(tr(state.lang, "Stake", "مبلغ شرط"), fontSize = 11.sp, color = Palette.muted)
                                Text(money(bet.stakeMinor, bet.currency), fontWeight = FontWeight.Bold)
                            }
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                                Text(if (bet.settledPayoutMinor != null)
                                    tr(state.lang, "Paid", "مبلغ پرداخت‌شده")
                                    else tr(state.lang, "Potential payout", "پرداخت احتمالی"),
                                    fontSize = 11.sp, color = Palette.muted)
                                Text(money(bet.settledPayoutMinor ?: bet.payoutMinor, bet.currency),
                                    fontWeight = FontWeight.Black, color = Palette.text)
                            }
                        }
                        Row(Modifier.fillMaxWidth().padding(top = 12.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.VerifiedUser, null, tint = Palette.blue,
                                modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(tr(state.lang, "View verified receipt", "مشاهده رسید تأییدشده"),
                                color = Palette.blue, fontWeight = FontWeight.Bold,
                                fontSize = 11.sp, modifier = Modifier.weight(1f))
                            Icon(Icons.Default.ChevronRight, null, tint = Palette.blue,
                                modifier = Modifier.size(18.dp))
                        }
                        if (bet.netResultMinor != null || bet.combinedOddsScaled != "0") {
                            Spacer(Modifier.height(9.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (bet.combinedOddsScaled != "0") Text(
                                    tr(state.lang, "Total odds ", "ضریب کل ") + odds(bet.combinedOddsScaled),
                                    color = Palette.blue, fontSize = 11.sp,
                                    modifier = Modifier.weight(1f))
                                else Spacer(Modifier.weight(1f))
                                if (bet.netResultMinor != null) Text(
                                    tr(state.lang, "Net ", "خالص ") + money(bet.netResultMinor, bet.currency),
                                    color = if (bet.netResultMinor.startsWith("-")) Palette.red else Palette.green,
                                    fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
            if (state.betsHasMore) item {
                OutlinedButton(onClick = model::loadMoreBets, enabled = !state.moreBetsLoading,
                    modifier = Modifier.fillMaxWidth()) {
                    if (state.moreBetsLoading) CircularProgressIndicator(
                        Modifier.size(17.dp), color = Palette.green, strokeWidth = 2.dp)
                    else Text(tr(state.lang, "Load older bets", "نمایش شرط‌های قدیمی‌تر"))
                }
            }
        }
    }
}

private fun walletTransactionLabel(type: String, lang: Lang): String =
    if (lang == Lang.EN) type.replace("_", " ").replaceFirstChar { it.uppercase() }
    else when (type) {
        "deposit" -> "واریز"
        "withdrawal" -> "برداشت"
        "withdrawal_hold" -> "مسدودسازی برداشت"
        "withdrawal_release" -> "آزادسازی برداشت"
        "bet_debit" -> "ثبت شرط"
        "bet_refund" -> "برگشت شرط"
        "win_credit" -> "واریز برد"
        "void_refund" -> "برگشت شرط باطل"
        "bonus" -> "بونوس"
        "adjustment" -> "اصلاح حساب"
        "reversal" -> "بازگشت تراکنش"
        "affiliate_payout" -> "پرداخت افیلیت"
        "cashout" -> "تسویه زودهنگام"
        else -> type.replace("_", " ")
    }

@Composable
fun WalletPage(state: AppState, model: AppViewModel) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "MY WALLET", "کیف‌پول من"),
                title = tr(state.lang, "Your USD account", "مدیریت موجودی دلاری"),
                subtitle = tr(state.lang,
                    "Balances and transactions shown here are supplied by the secure ledger.",
                    "موجودی و تراکنش‌ها از دفترکل امن سرور دریافت می‌شوند."),
                icon = Icons.Default.AccountBalanceWallet, accent = Palette.green
            )
        }
        item { SectionHeading(tr(state.lang, "My wallet", "کیف‌پول من"),
            tr(state.lang, "USD account and transaction ledger", "حساب دلاری و گردش موجودی"),
            tr(state.lang, "Refresh", "تازه‌سازی")) { model.refreshAccount() } }
        if (state.accountLoading) item {
            LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
        }
        if (!state.signedIn) item {
            LockedFeature(state.lang, tr(state.lang, "Sign in to view balances",
                "برای مشاهده موجودی وارد شوید")) { model.showLogin(true) }
        } else {
            val wallet = state.wallet
            if (wallet == null) item {
                EmptyPanel(tr(state.lang, "Wallet unavailable", "کیف‌پول در دسترس نیست"),
                    tr(state.lang, "A balance cannot be shown until the server confirms it.",
                        "تا زمان تأیید سرور موجودی نمایش داده نمی‌شود.")) { model.refreshAccount() }
            } else {
                item {
                    Surface(color = Palette.ink, shape = RoundedCornerShape(23.dp),
                        modifier = Modifier.fillMaxWidth(), shadowElevation = 3.dp) {
                        Column(Modifier.fillMaxWidth().padding(23.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AccountBalanceWallet, null, tint = Palette.green,
                                    modifier = Modifier.size(21.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(tr(state.lang, "BETVIMA USD WALLET", "کیف‌پول دلاری بت‌ویما"),
                                    color = Color.White, fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold)
                            }
                            Spacer(Modifier.height(16.dp))
                            Text(tr(state.lang, "AVAILABLE BALANCE", "موجودی قابل برداشت"),
                                color = Color(0xFFB0C2C7), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(money(wallet.availableMinor, wallet.currency),
                                color = Palette.green, fontSize = 31.sp, fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(vertical = 12.dp))
                            HorizontalDivider(color = Color.White.copy(alpha = .15f))
                            Spacer(Modifier.height(14.dp))
                            Text(tr(state.lang, "Total: ", "کل موجودی: ") +
                                money(wallet.balanceMinor, wallet.currency),
                                color = Color.White, fontSize = 12.sp)
                            Text(tr(state.lang, "On hold: ", "موجودی مسدود: ") +
                                money(wallet.heldMinor, wallet.currency),
                                color = Color(0xFFA2B6C0), fontSize = 12.sp)
                        }
                    }
                }
                if (wallet.integrity != "ok") item {
                    BvInformationStrip(
                        tr(state.lang,
                            "Wallet integrity is under review. Transfers are unavailable in the app.",
                            "یکپارچگی کیف‌پول نیازمند بررسی است؛ انتقال وجه در اپ غیرفعال است."),
                        icon = Icons.Default.WarningAmber, accent = Palette.red)
                }
                item { SectionHeading(tr(state.lang, "Recent activity", "تراکنش‌های اخیر")) }
                if (wallet.transactions.isEmpty()) item {
                    EmptyPanel(tr(state.lang, "No transactions", "تراکنشی ثبت نشده"),
                        tr(state.lang, "Your ledger is empty.", "گردش حساب شما خالی است."))
                }
                items(wallet.transactions, key = { it.id }) { tx ->
                    Surface(shape = RoundedCornerShape(13.dp), color = Color.White,
                        border = BorderStroke(1.dp, Palette.border)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.ReceiptLong, null, tint = Palette.blue)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(walletTransactionLabel(tx.type, state.lang),
                                    fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Text(tx.time.take(16).replace("T", " "), color = Palette.muted, fontSize = 10.sp)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(money(tx.amountMinor, wallet.currency),
                                    fontWeight = FontWeight.Black, fontSize = 12.sp,
                                    color = if (tx.direction == "credit") Palette.green
                                        else if (tx.direction == "debit") Palette.red else Palette.text)
                                if (tx.status.isNotBlank()) Text(
                                    if (tx.status == "posted") tr(state.lang, "Posted", "ثبت‌شده")
                                    else tx.status.replace("_", " "),
                                    fontSize = 10.sp, color = Palette.muted)
                            }
                        }
                    }
                }
                if (wallet.hasMore) item {
                    OutlinedButton(onClick = model::loadMoreWallet,
                        enabled = !state.moreWalletLoading,
                        modifier = Modifier.fillMaxWidth()) {
                        if (state.moreWalletLoading) CircularProgressIndicator(
                            Modifier.size(17.dp), color = Palette.green, strokeWidth = 2.dp)
                        else Text(tr(state.lang, "Load more transactions", "تراکنش‌های بیشتر"))
                    }
                }
            }
        }
    }
}

@Composable
fun LockedFeature(lang: Lang, message: String, onLogin: () -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(22.dp),
        modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Palette.border)) {
        Column(Modifier.padding(25.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Lock, null, tint = Palette.blue, modifier = Modifier.size(34.dp))
            Spacer(Modifier.height(12.dp))
            Text(message, fontSize = 14.sp, color = Palette.text,
                textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(15.dp))
            Button(onClick = onLogin, colors = ButtonDefaults.buttonColors(containerColor = Palette.green)) {
                Text(tr(lang, "Sign in", "ورود"), color = Palette.ink, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun FeatureShortcuts(lang: Lang, model: AppViewModel) {
    Column {
        SectionHeading(tr(lang, "Explore BetVima", "امکانات بت‌ویما"))
        listOf(
            Triple(Feature.BONUSES, tr(lang, "My Bonuses", "بونوس‌های من"), Icons.Default.CardGiftcard),
            Triple(Feature.VIP, tr(lang, "VIP Club", "باشگاه VIP"), Icons.Default.Stars),
            Triple(Feature.SUPPORT, tr(lang, "24/7 Support", "پشتیبانی ۲۴ ساعته"), Icons.Default.SupportAgent),
            Triple(Feature.AFFILIATE, tr(lang, "Affiliate", "همکاری در فروش"), Icons.Default.Groups)
        ).chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp)) {
                row.forEach { (feature, title, icon) ->
                    val spotlight = feature == Feature.VIP
                    Surface(Modifier.weight(1f).clickable { model.feature(feature) },
                        color = if (spotlight) Palette.ink else Color.White,
                        shape = RoundedCornerShape(19.dp),
                        border = BorderStroke(1.dp, if (spotlight) Palette.ink else Palette.border),
                        shadowElevation = 1.dp) {
                        Column(Modifier.fillMaxWidth().heightIn(min = 94.dp)
                            .padding(14.dp),
                            verticalArrangement = Arrangement.SpaceBetween) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(color = if (spotlight)
                                        Palette.green.copy(alpha = .15f) else Palette.greenLight,
                                    shape = RoundedCornerShape(10.dp)) {
                                    Icon(icon, null, tint = if (spotlight) Palette.green else Palette.ink,
                                        modifier = Modifier.padding(8.dp).size(21.dp))
                                }
                                Spacer(Modifier.weight(1f))
                                Icon(Icons.Default.NorthEast, null,
                                    tint = if (spotlight) Palette.green else Palette.blue,
                                    modifier = Modifier.size(16.dp))
                            }
                            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                                maxLines = 2, color = if (spotlight) Color.White else Palette.text)
                        }
                    }
                }
            }
        }
    }
}
@Composable
fun ResponsibleNote(lang: Lang) {
    Text(tr(lang,
        "18+ · Please play responsibly. Only wager where permitted by law. All balances and quotes are validated by the server.",
        "۱۸+ · مسئولانه بازی کنید. فقط در مناطق مجاز قانونی فعالیت کنید. همه موجودی‌ها و قیمت‌ها توسط سرور تأیید می‌شوند."),
        color = Palette.muted, fontSize = 10.sp, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp, horizontal = 9.dp))
}
