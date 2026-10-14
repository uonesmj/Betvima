package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalUriHandler
import com.betvima.app.BuildConfig
import com.betvima.app.data.*

@Composable
fun MatchDetailPage(state: AppState, model: AppViewModel) {
    val match = state.detail
    if (match == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (state.detailLoading) CircularProgressIndicator(color = Palette.green)
            else EmptyPanel("Match unavailable", "Return to the live or sports catalogue.") { model.closeMatch() }
        }
        return
    }
    var selectedMarketGroup by rememberSaveable(match.id) { mutableStateOf("all") }
    var scoreMode by rememberSaveable(match.id) { mutableStateOf("score") }
    var marketSearch by rememberSaveable(match.id) { mutableStateOf("") }
    val marketGroups = listOf(
        "all" to tr(state.lang, "All", "همه"),
        "main" to tr(state.lang, "Main", "اصلی"),
        "quick" to tr(state.lang, "Quick", "سریع"),
        "total" to tr(state.lang, "Total", "مجموع"),
        "handicap" to tr(state.lang, "Handicap", "هندیکپ"),
        "team" to tr(state.lang, "Home team", "تیم میزبان"),
        "combo" to tr(state.lang, "Combo", "ترکیبی"),
        "correct" to tr(state.lang, "Correct score", "نتیجه دقیق"),
        "corners" to tr(state.lang, "Corners", "کرنرها"),
        "cards" to tr(state.lang, "Cards", "کارت‌ها")
    )
    val filteredMarkets = match.markets.filterIndexed { index, market ->
        val term = (market.key + " " + market.name + " " + market.nameFa).lowercase()
        val groupMatch = when (selectedMarketGroup) {
            "all" -> true
            "main" -> index < 6 || listOf("result", "h2h", "chance").any { term.contains(it) }
            "quick" -> index < 8 && market.available
            "total" -> listOf("total", "over", "under", "goal").any { term.contains(it) } ||
                term.contains("گل")
            "handicap" -> term.contains("handicap") || term.contains("هندیکپ")
            "team" -> term.contains("home") || term.contains("team 1") ||
                term.contains("میزبان")
            "combo" -> term.contains("combo") || term.contains("both") ||
                term.contains("combined") || term.contains("ترکیبی")
            "correct" -> term.contains("correct score") || term.contains("نتیجه دقیق")
            "corners" -> term.contains("corner") || term.contains("کرنر")
            "cards" -> term.contains("card") || term.contains("کارت")
            else -> true
        }
        groupMatch && (marketSearch.isBlank() ||
            term.contains(marketSearch.trim().lowercase()))
    }
    LazyColumn(contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = model::closeMatch) {
                    Icon(Icons.Default.ArrowBack, "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(match.league, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Text(match.country, color = Palette.muted, fontSize = 11.sp)
                }
                if (match.live) SmallPill("LIVE " + (match.minute ?: 0) + "′",
                    Color(0xFFFFEEF0), Palette.red)
            }
        }
        item {
            Surface(color = Color(0xFFE1E4EB), shape = RoundedCornerShape(17.dp)) {
                Row(Modifier.fillMaxWidth().padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(
                        Triple("score", tr(state.lang, "Score", "نتیجه"), Icons.Default.Scoreboard),
                        Triple("tv", tr(state.lang, "TV", "پخش"), Icons.Default.Tv),
                        Triple("live", tr(state.lang, "Live", "زنده"), Icons.Default.Sensors)
                    ).forEach { (mode, text, icon) ->
                        val enabled = mode == "score" || (mode == "live" && match.live)
                        Surface(Modifier.weight(1f).heightIn(min = 47.dp)
                            .clickable(enabled = enabled) { scoreMode = mode },
                            color = if (scoreMode == mode) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(13.dp)) {
                            Row(Modifier.fillMaxSize(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(icon, null, tint = if (enabled) Palette.text else Palette.muted,
                                    modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(text, fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (enabled) Palette.text else Palette.muted)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(11.dp))
            Row(Modifier.fillMaxWidth().padding(vertical = 15.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    TeamBadge(match.home, 54)
                    Spacer(Modifier.height(7.dp))
                    Text(match.home.name, textAlign = TextAlign.Center,
                        fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                        color = Palette.text, maxLines = 2)
                }
                Surface(color = Color(0xFF858B9A),
                    shape = RoundedCornerShape(12.dp)) {
                    Text(if (match.homeScore != null && match.awayScore != null)
                        "${match.homeScore}:${match.awayScore}" else "VS",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        color = Color.White, fontWeight = FontWeight.Black, fontSize = 26.sp)
                }
                Column(Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    TeamBadge(match.away, 54)
                    Spacer(Modifier.height(7.dp))
                    Text(match.away.name, textAlign = TextAlign.Center,
                        fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                        color = Palette.text, maxLines = 2)
                }
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically) {
                if (match.live) Icon(Icons.Default.Sensors, null,
                    tint = Color(0xFFF50078), modifier = Modifier.size(17.dp))
                Text(if (match.live)
                    tr(state.lang, "LIVE", "زنده") + " · " +
                        (match.minute?.toString()?.plus("′") ?: "—")
                    else match.starts.take(16).replace("T", " · "),
                    color = Palette.muted, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                Text(tr(state.lang, "Server-confirmed score", "نتیجه تأییدشده سرور"),
                    color = Palette.muted, fontSize = 10.sp)
            }
        }
        item {
            SectionHeading(tr(state.lang, "All markets", "تمام بازارها"),
                tr(state.lang, "Server-sourced selections", "بازارهای دریافت‌شده از سرور"))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 5.dp)) {
                items(marketGroups, key = { it.first }) { (key, label) ->
                    val selected = selectedMarketGroup == key
                    Surface(shape = RoundedCornerShape(13.dp),
                        color = if (selected) Palette.blue else Color(0xFFE0E3E9),
                        border = BorderStroke(1.dp,
                            if (selected) Palette.blue else Palette.border),
                        modifier = Modifier.clickable { selectedMarketGroup = key }) {
                        Text(label, fontWeight = FontWeight.Bold, fontSize = 11.sp,
                            color = if (selected) Color.White else Palette.text,
                            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp))
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            OutlinedTextField(marketSearch, { marketSearch = it.take(60) },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(13.dp),
                placeholder = { Text(tr(state.lang,
                    "Find a market", "جست‌وجوی بازار"), fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = Palette.muted) },
                trailingIcon = {
                    if (marketSearch.isNotBlank()) IconButton(onClick = { marketSearch = "" }) {
                        Icon(Icons.Default.Close, tr(state.lang, "Clear", "پاک کردن"))
                    }
                })
            Text(filteredMarkets.size.toString() + tr(state.lang,
                " markets", " بازار"), color = Palette.muted,
                fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp))
        }
        if (filteredMarkets.isEmpty()) item {
            EmptyPanel(tr(state.lang, "No markets match your filters", "بازاری مطابق فیلتر یافت نشد"),
                tr(state.lang, "Select another category or clear the search.",
                    "دسته دیگری را انتخاب یا جست‌وجو را پاک کنید.")) {
                selectedMarketGroup = "all"; marketSearch = ""
            }
        }
        items(filteredMarkets, key = { it.id }) { market ->
            val index = match.markets.indexOfFirst { it.id == market.id }
            var expanded by rememberSaveable(market.id) { mutableStateOf(index < 3) }
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
                Column {
                    Row(Modifier.fillMaxWidth().clickable { expanded = !expanded }
                        .padding(horizontal = 14.dp, vertical = 15.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(market.label(state.lang == Lang.FA), modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.Bold, color = Palette.text, fontSize = 13.sp)
                        SmallPill(market.selections.size.toString(),
                            Palette.paper, Palette.muted)
                        Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            null, tint = Palette.muted)
                    }
                    if (expanded) {
                        HorizontalDivider(color = Palette.border)
                        market.selections.chunked(3).forEach { row ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 5.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEach { selection ->
                                    Box(Modifier.weight(1f)) {
                                        OddsChoice(match, market, selection, state.liveEnabled,
                                            state.picks.any { it.selectionId == selection.id }) {
                                            model.togglePick(match, market, selection)
                                        }
                                    }
                                }
                                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                        Spacer(Modifier.height(5.dp))
                    }
                }
            }
        }
        item { ResponsibleNote(state.lang) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SlipSheet(state: AppState, model: AppViewModel) {
    var stake by rememberSaveable { mutableStateOf("5.00") }
    var mode by rememberSaveable { mutableStateOf("single") }
    LaunchedEffect(state.picks.size) {
        mode = if (state.picks.size > 1) "multiple" else "single"
        model.clearQuote()
    }
    val canQuote = state.picks.isNotEmpty() &&
        ((mode == "single" && state.picks.size == 1) ||
         (mode == "multiple" && state.picks.size >= 2))
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = { model.showSlip(false) },
        sheetState = sheet, containerColor = Color.White,
        dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
            .padding(horizontal = 17.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 5.dp),
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { model.showSlip(false) }) {
                    Icon(Icons.Default.KeyboardArrowDown,
                        tr(state.lang, "Close slip", "بستن برگه شرط"),
                        tint = Palette.muted)
                }
                Text(tr(state.lang, "Betslip", "برگه شرط"),
                    modifier = Modifier.weight(1f),
                    fontWeight = FontWeight.Black, fontSize = 20.sp, color = Palette.text)
                Icon(Icons.Default.AccountBalanceWallet, null,
                    tint = Palette.muted, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(if (state.wallet != null)
                    money(state.wallet.availableMinor, state.wallet.currency)
                    else tr(state.lang, "Balance unavailable", "موجودی نامشخص"),
                    fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                    color = Palette.text)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Color(0xFFEDEFF3), shape = RoundedCornerShape(13.dp),
                    modifier = Modifier.weight(1f)) {
                    Row(Modifier.padding(3.dp)) {
                        listOf(
                            "single" to tr(state.lang, "Single", "تکی"),
                            "multiple" to tr(state.lang, "Multiple", "میکس"),
                            "series" to tr(state.lang, "Series", "سیستمی")
                        ).forEach { (type, title) ->
                            val enabled = type != "series"
                            Surface(
                                color = if (mode == type) Palette.blue else Color.Transparent,
                                shape = RoundedCornerShape(11.dp),
                                modifier = Modifier.weight(1f).heightIn(min = 45.dp)
                                    .clickable(enabled = enabled) {
                                        mode = type
                                        model.clearQuote()
                                    }
                            ) {
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text(title, fontWeight = FontWeight.ExtraBold,
                                        fontSize = 12.sp,
                                        color = if (!enabled) Palette.muted
                                            else if (mode == type) Color.White else Palette.text)
                                }
                            }
                        }
                    }
                }
                Surface(color = Color(0xFFEDEFF3), shape = RoundedCornerShape(13.dp),
                    modifier = Modifier.size(51.dp).clickable {
                        model.clearPicks()
                    }) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.DeleteOutline,
                            tr(state.lang, "Clear slip", "پاک‌کردن برگه"),
                            tint = Palette.muted)
                    }
                }
            }

            if (state.picks.isEmpty()) {
                EmptyPanel(tr(state.lang, "No selections", "انتخابی ندارید"),
                    tr(state.lang,
                        "Tap an available price on the sports page to add a selection.",
                        "برای افزودن انتخاب، یکی از ضرایب باز را لمس کنید."))
            } else state.picks.forEach { pick ->
                Surface(color = Color(0xFFEDEFF3), shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(13.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(pick.match, color = Palette.muted, fontSize = 12.sp,
                                modifier = Modifier.weight(1f))
                            IconButton(onClick = { model.removePick(pick.selectionId) },
                                modifier = Modifier.size(29.dp)) {
                                Icon(Icons.Default.Close,
                                    tr(state.lang, "Remove", "حذف"),
                                    tint = Palette.muted, modifier = Modifier.size(19.dp))
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(pick.market, fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp, color = Palette.muted)
                                Text(pick.selection, fontWeight = FontWeight.ExtraBold,
                                    fontSize = 13.sp, color = Palette.text, maxLines = 2)
                            }
                            Surface(color = Palette.blue, shape = RoundedCornerShape(9.dp)) {
                                Text(odds(pick.oddsScaled), color = Color.White,
                                    fontWeight = FontWeight.Black, fontSize = 16.sp,
                                    modifier = Modifier.padding(horizontal = 13.dp, vertical = 7.dp))
                            }
                        }
                    }
                }
            }
            if (state.picks.isNotEmpty()) {
                if (!canQuote) BvInformationStrip(tr(state.lang,
                    "Single requires exactly one selection; Multiple requires two or more. Series is not yet supported.",
                    "برای تکی فقط یک انتخاب و برای میکس حداقل دو انتخاب لازم است. شرط سیستمی هنوز پشتیبانی نمی‌شود."),
                    Icons.Default.Info, accent = Palette.blue)

                OutlinedTextField(value = stake, onValueChange = { value ->
                    if (value.matches(Regex("[0-9]{0,10}(\\.[0-9]{0,2})?"))) {
                        stake = value; model.clearQuote()
                    }
                }, label = { Text(tr(state.lang, "Bet amount (USD)", "مبلغ شرط (دلار)")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("1.00", "5.00", "10.00", "20.00").forEach { preset ->
                        Surface(shape = RoundedCornerShape(11.dp),
                            color = if (stake == preset) Palette.blue else Color(0xFFEDEFF3),
                            modifier = Modifier.weight(1f).clickable {
                                stake = preset; model.clearQuote()
                            }) {
                            Box(Modifier.heightIn(min = 39.dp),
                                contentAlignment = Alignment.Center) {
                                Text("$" + preset.removeSuffix(".00"),
                                    color = if (stake == preset) Color.White else Palette.text,
                                    fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(state.lang, "Possible win", "برد احتمالی"),
                        fontSize = 12.sp, color = Palette.muted,
                        modifier = Modifier.weight(1f))
                    Text(if (canQuote && !state.quote.isNullOrBlank()) state.quote.orEmpty() else "—",
                        fontWeight = FontWeight.Black, fontSize = 14.sp,
                        color = Palette.green)
                }
                if (canQuote && !state.quote.isNullOrBlank())
                    BvInformationStrip(tr(state.lang,
                        "Official quote received. No real-money bet was placed.",
                        "استعلام رسمی دریافت شد؛ هیچ شرط واقعی ثبت نشده است."),
                        Icons.Default.Verified, accent = Palette.green)
                BvPrimaryButton(
                    label = if (!state.signedIn)
                        tr(state.lang, "Sign in to get a quote", "برای استعلام وارد شوید")
                    else tr(state.lang, "Request official quote", "استعلام رسمی ضریب"),
                    onClick = {
                        if (!state.signedIn) {
                            model.showSlip(false); model.showLogin(true)
                        } else model.quote(stake)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = canQuote && !state.busy,
                    icon = Icons.Default.CheckCircle
                )
                Text(tr(state.lang,
                    "Wager placement is disabled in this test build until age, licensing and location checks are verified.",
                    "ثبت شرط در این نسخه آزمایشی تا تأیید مجوز، سن و منطقه جغرافیایی غیرفعال است."),
                    fontSize = 10.sp, color = Palette.muted, lineHeight = 16.sp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginSheet(state: AppState, model: AppViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    val uri = LocalUriHandler.current
    ModalBottomSheet(onDismissRequest = { model.showLogin(false) },
        containerColor = Color.White) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
            .padding(horizontal = 23.dp).padding(bottom = 35.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)) {
            Text(tr(state.lang, "Welcome back", "خوش آمدید"),
                fontSize = 25.sp, fontWeight = FontWeight.Black, color = Palette.text)
            Text(tr(state.lang, "Secure BetVima account", "حساب امن بت‌ویما"),
                fontSize = 12.sp, color = Palette.muted)
            OutlinedTextField(email, { email = it }, label = { Text(tr(state.lang, "Email", "ایمیل")) },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(password, { password = it },
                label = { Text(tr(state.lang, "Password", "رمز عبور")) },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            Button(onClick = { model.signIn(email, password) },
                enabled = !state.busy && email.contains("@") && password.length >= 8,
                colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
                modifier = Modifier.fillMaxWidth().height(52.dp)) {
                if (state.busy) CircularProgressIndicator(Modifier.size(19.dp),
                    color = Palette.ink, strokeWidth = 2.dp)
                else Text(tr(state.lang, "Sign in securely", "ورود امن"),
                    fontWeight = FontWeight.Black, color = Palette.ink)
            }
            TextButton(onClick = { uri.openUri("https://betvima.com/auth/register") },
                modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(state.lang, "New here? Create account", "حساب ندارید؟ ثبت‌نام کنید"),
                    color = Palette.blue)
            }
            ResponsibleNote(state.lang)
        }
    }
}
