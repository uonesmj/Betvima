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

private val sports = listOf("football", "basketball", "tennis", "volleyball",
    "ice-hockey", "table-tennis", "baseball", "esports")
private fun sportName(s: String) = s.replace("-", " ").replaceFirstChar { it.uppercase() }

@Composable
fun SportsRibbon(selected: String, lang: Lang, onChange: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 3.dp)) {
        items(sports, key = { it }) { sport ->
            FilterChip(
                selected = selected == sport, onClick = { onChange(sport) },
                label = { Text(if (lang == Lang.FA) when (sport) {
                    "football" -> "فوتبال"; "basketball" -> "بسکتبال"; "tennis" -> "تنیس"
                    "volleyball" -> "والیبال"; "ice-hockey" -> "هاکی روی یخ"
                    "table-tennis" -> "پینگ‌پنگ"; "baseball" -> "بیسبال"
                    "esports" -> "ورزش الکترونیک"; else -> sportName(sport)
                } else sportName(sport), fontSize = 11.sp,
                    fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Palette.greenLight,
                    selectedLabelColor = Palette.ink
                )
            )
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
        item { SportsRibbon(state.sport, state.lang) { model.sport(it); model.tab(Tab.SPORTS) } }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                HighlightMetric(Modifier.weight(1f), tr(state.lang, "LIVE", "زنده"), state.live.size.toString(), Palette.red)
                HighlightMetric(Modifier.weight(1f), tr(state.lang, "UPCOMING", "آینده"), state.upcoming.size.toString(), Palette.blue)
                HighlightMetric(Modifier.weight(1f), tr(state.lang, "MY PICKS", "انتخاب‌ها"), state.picks.size.toString(), Palette.green)
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
private fun HighlightMetric(modifier: Modifier, title: String, count: String, accent: Color) {
    Surface(modifier, color = Color.White, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Palette.border)) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 14.dp)) {
            Text(title, color = Palette.muted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(5.dp))
            Text(count, color = accent, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }
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
            SectionHeading(title, tr(state.lang,
                "Explore real-time leagues and markets", "لیگ‌ها و بازارهای لحظه‌ای"))
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
        if (state.loading && matches.isEmpty()) item {
            Box(Modifier.fillMaxWidth().height(90.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Palette.green)
            }
        }
        if (!state.loading && matches.isEmpty()) item {
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
            color = Palette.ink, shape = RoundedCornerShape(13.dp)) {
            Row(Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.EmojiEvents, null, tint = Palette.green,
                    modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(matches.first().league, color = Color.White,
                        fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text(matches.first().country + " · " + matches.size + tr(state.lang, " events", " مسابقه"),
                        color = Color(0xFF9BB0BA), fontSize = 10.sp)
                }
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    "Toggle league", tint = Color.White)
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

private fun betStatus(status: String, lang: Lang): String = when (status.lowercase()) {
    "won" -> tr(lang, "Won", "برنده")
    "lost" -> tr(lang, "Lost", "بازنده")
    "pending", "open", "placed", "accepted" -> tr(lang, "Open", "باز")
    "void" -> tr(lang, "Void", "باطل")
    "refunded" -> tr(lang, "Refunded", "برگشت‌خورده")
    "cancelled", "canceled" -> tr(lang, "Cancelled", "لغوشده")
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
                Surface(shape = RoundedCornerShape(17.dp), color = Color.White,
                    border = BorderStroke(1.dp, Palette.border)) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
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
                                if (bet.status.equals("won", true)) Palette.green else Palette.muted)
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
        }
    }
}

@Composable
fun WalletPage(state: AppState, model: AppViewModel) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                    Surface(color = Palette.ink, shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(22.dp)) {
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
                    Text(tr(state.lang, "Wallet integrity is under review; transfers are unavailable here.",
                        "یکپارچگی کیف‌پول نیازمند بررسی است؛ انتقال وجه در اپ غیرفعال است."),
                        color = Palette.red, fontSize = 12.sp)
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
                                Text(tx.type.replace("_", " "), fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp)
                                Text(tx.time.take(16).replace("T", " "), color = Palette.muted, fontSize = 10.sp)
                            }
                            Text(money(tx.amountMinor, wallet.currency), fontWeight = FontWeight.Bold,
                                fontSize = 12.sp)
                        }
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
                    Surface(Modifier.weight(1f).clickable { model.feature(feature) },
                        color = Color.White, shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, null, tint = Palette.blue, modifier = Modifier.size(19.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(title, fontWeight = FontWeight.Bold, fontSize = 11.sp,
                                maxLines = 2, color = Palette.text)
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
