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
import androidx.compose.ui.text.style.TextOverflow
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
fun HomePage(state: AppState, model: AppViewModel, onSearch: () -> Unit) {
    // Featured games are real, bettable upcoming markets, never fabricated promotions.
    val featured = state.upcoming.filter { match ->
        match.bettingAvailable && match.featured?.available == true &&
            match.featured?.selections?.any { it.available } == true
    }.sortedWith(compareByDescending<Match> { it.marketsCount }.thenBy { it.starts })
    LazyColumn(contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { SportsbookTopTabs(state, model, onSearch) }
        item { ReferenceTournamentRibbon(state, model) }
        if (state.homeMode == HomeMode.TOP_BETS) {
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Top Bets", "شرط‌های برتر",
                        Icons.Default.Whatshot, Palette.blue) { model.tab(Tab.SPORTS) }
                }
            }
            if (featured.isEmpty() && state.upcomingLoading) {
                items(2) { FixtureSkeleton(Modifier.padding(horizontal = 15.dp)) }
            } else if (featured.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 15.dp)) {
                        EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                            tr(state.lang, "Only verified upcoming odds are displayed.",
                                "فقط ضرایب تأییدشده بازی‌های آینده نمایش داده می‌شوند.")) {
                            model.refreshUpcoming()
                        }
                    }
                }
            } else items(featured.take(25), key = { "top-" + it.id }) { match ->
                Box(Modifier.padding(horizontal = 15.dp, vertical = 3.dp)) {
                    ReferenceTopBetCard(match, state, model)
                }
            }
        } else {
            // Exactly three editorial home sections, aligned with the reference site.
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Live", "زنده",
                        Icons.Default.Sensors, Color(0xFFE82465)) { model.tab(Tab.LIVE) }
                    if (state.live.isNotEmpty()) ReferenceMatchCarousel(state.live, state, model)
                    else if (state.liveLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang, "No live matches", "مسابقه زنده‌ای موجود نیست"),
                        tr(state.lang, "Check again as events begin.",
                            "با شروع مسابقات دوباره بررسی کنید.")) { model.refreshLive() }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Top Bets", "شرط‌های برتر",
                        Icons.Default.Whatshot, Palette.blue) {
                        model.homeMode(HomeMode.TOP_BETS)
                    }
                    if (featured.isNotEmpty()) ReferenceMatchCarousel(featured, state, model)
                    else if (state.upcomingLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang, "Top markets are unavailable", "بازار برتری موجود نیست"),
                        tr(state.lang, "Markets appear when confirmed by the provider.",
                            "بازارها پس از تأیید منبع داده نمایش داده می‌شوند.")) {
                        model.refreshUpcoming()
                    }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 15.dp)) {
                    ReferenceSectionHeader(state.lang, "Upcoming", "آینده",
                        Icons.Default.Event, Palette.green) { model.tab(Tab.SPORTS) }
                    if (state.upcoming.isNotEmpty())
                        ReferenceMatchCarousel(state.upcoming, state, model)
                    else if (state.upcomingLoading) FixtureSkeleton(Modifier.fillMaxWidth())
                    else EmptyPanel(tr(state.lang, "No upcoming fixtures", "مسابقه آینده‌ای موجود نیست"),
                        tr(state.lang, "Upcoming fixtures load from the live catalogue.",
                            "مسابقات آینده از فهرست واقعی دریافت می‌شوند.")) {
                        model.refreshUpcoming()
                    }
                }
            }
        }
        item { ResponsibleNote(state.lang) }
    }
}

@Composable
fun CatalogPage(state: AppState, model: AppViewModel, live: Boolean,
    onSearch: () -> Unit) {
    var liveSport by rememberSaveable { mutableStateOf("top") }
    var selectedLeague by rememberSaveable(live, liveSport, state.sport, state.tournamentLeague) {
        mutableStateOf(if (live) "" else state.tournamentLeague)
    }
    var tournamentOpen by remember { mutableStateOf(false) }
    val allMatches = if (live) state.live else state.upcoming
    val matches = if (live && liveSport != "top")
        allMatches.filter { it.sport == liveSport } else allMatches
    val groups = matches.groupBy { it.league + "|" + it.country }
    val visibleGroups = if (selectedLeague.isBlank()) groups else
        groups.filterKeys { it == selectedLeague }

    LazyColumn(contentPadding = PaddingValues(bottom = 22.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp)) {
        item { SportsbookTopTabs(state, model, onSearch) }
        item {
            ReferenceSportRibbon(state, model, live = live,
                selectedKey = if (live) liveSport else state.sport,
                onSelect = { key ->
                    if (live) liveSport = key
                    else model.sport(if (key == "top") "all" else key)
                })
        }
        if (!live) item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(17.dp),
                    border = BorderStroke(1.dp, Palette.border),
                    shadowElevation = 2.dp,
                    modifier = Modifier.weight(1f).clickable { tournamentOpen = true }
                ) {
                    Row(Modifier.heightIn(min = 54.dp)
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Palette.greenLight, shape = RoundedCornerShape(11.dp)) {
                            Icon(Icons.Default.EmojiEvents, null, tint = Palette.blue,
                                modifier = Modifier.padding(9.dp).size(20.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(state.lang, "TOURNAMENTS", "رقابت‌ها"),
                                fontSize = 9.sp, fontWeight = FontWeight.Black,
                                color = Palette.muted)
                            Text(if (selectedLeague.isBlank())
                                tr(state.lang, "Choose a tournament", "انتخاب لیگ")
                                else groups[selectedLeague]?.firstOrNull()?.league.orEmpty(),
                                fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                                color = Palette.text, maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = Palette.blue)
                    }
                }
                Spacer(Modifier.width(8.dp))
                Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, Palette.border),
                    modifier = Modifier.size(54.dp).clickable {
                        if (live) model.refreshLive() else model.refreshUpcoming()
                    }) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Refresh,
                            tr(state.lang, "Refresh", "تازه‌سازی"), tint = Palette.blue)
                    }
                }
            }
        }
        if (live && !state.liveEnabled) item {
            Box(Modifier.padding(horizontal = 15.dp)) {
                BvInformationStrip(tr(state.lang,
                    "Live betting is currently paused. Last confirmed scores remain visible.",
                    "شرط زنده متوقف است؛ آخرین نتایج تأییدشده نمایش داده می‌شوند."),
                    Icons.Default.Info, accent = Palette.blue)
            }
        }
        if ((if (live) state.liveLoading else state.upcomingLoading) &&
            allMatches.isEmpty()) {
            items(2, key = { "skeleton-$it" }) {
                FixtureSkeleton(Modifier.padding(horizontal = 13.dp, vertical = 3.dp))
            }
        }
        if (!(if (live) state.liveLoading else state.upcomingLoading) &&
            visibleGroups.isEmpty()) item {
            Box(Modifier.padding(15.dp)) {
                EmptyPanel(tr(state.lang, "No matches for this filter", "مسابقه‌ای یافت نشد"),
                    tr(state.lang,
                        "Try another sport or competition and refresh.",
                        "رشته یا لیگ دیگری را انتخاب و تازه‌سازی کنید.")) {
                    if (live) { liveSport = "top"; model.refreshLive() }
                    else { selectedLeague = ""; model.refreshUpcoming() }
                }
            }
        }
        visibleGroups.entries.forEachIndexed { index, group ->
            item(key = "league-"+group.key) {
                Box(Modifier.padding(horizontal = 13.dp)) {
                    LeagueSection(group.key, group.value, index == 0, state, model)
                }
            }
        }
        item { ResponsibleNote(state.lang) }
    }
    if (tournamentOpen) PremiumTournamentSheet(
        lang = state.lang, groups = groups, selected = selectedLeague,
        onSelect = { selectedLeague = it },
        onDismiss = { tournamentOpen = false }
    )
}

@Composable
private fun LeagueSection(key: String, matches: List<Match>, first: Boolean,
    state: AppState, model: AppViewModel) {
    var expanded by rememberSaveable(key) { mutableStateOf(first) }
    Surface(shape = RoundedCornerShape(23.dp), color = Color.White,
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 4.dp,
        modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(Modifier.fillMaxWidth().clickable { expanded = !expanded }
                .padding(horizontal = 13.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                val logo = matches.first().leagueLogo
                Surface(color = Palette.paper, shape = RoundedCornerShape(12.dp)) {
                    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                        if (logo?.startsWith("https://") == true)
                            AsyncImage(model = logo, contentDescription = matches.first().league,
                                modifier = Modifier.size(30.dp))
                        else Icon(Icons.Default.EmojiEvents, null, tint = Palette.blue,
                            modifier = Modifier.size(22.dp))
                    }
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(matches.first().league, color = Palette.text,
                        fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        maxLines = 2)
                    Text(matches.first().country.ifBlank {
                        tr(state.lang, "Competition", "رقابت") },
                        color = Palette.muted, fontSize = 10.sp)
                }
                SmallPill(matches.size.toString(), Palette.paper, Palette.text)
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    tr(state.lang, "Toggle league", "نمایش یا بستن لیگ"),
                    tint = Palette.muted)
            }
            if (expanded) {
                HorizontalDivider(color = Palette.border)
                matches.forEachIndexed { index, match ->
                    ReferenceLeagueFixture(match, state, model)
                    if (index != matches.lastIndex)
                        HorizontalDivider(Modifier.padding(horizontal = 12.dp),
                            color = Palette.border.copy(alpha = .7f))
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
    PremiumMyBetsPage(state, model)
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
