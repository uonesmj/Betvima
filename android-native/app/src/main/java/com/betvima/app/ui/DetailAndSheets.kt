package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
    var marketSearch by rememberSaveable(match.id) { mutableStateOf("") }
    val marketGroups = listOf(
        "all" to tr(state.lang, "All", "همه"),
        "popular" to tr(state.lang, "Popular", "پرطرفدار"),
        "goals" to tr(state.lang, "Goals", "گل‌ها"),
        "corners" to tr(state.lang, "Corners", "کرنرها"),
        "cards" to tr(state.lang, "Cards", "کارت‌ها"),
        "handicap" to tr(state.lang, "Handicap", "هندیکپ")
    )
    val filteredMarkets = match.markets.filter { market ->
        val term = (market.key + " " + market.name + " " + market.nameFa).lowercase()
        val groupMatch = when (selectedMarketGroup) {
            "all" -> true
            "popular" -> market.key.contains("h2h") ||
                market.key.contains("result") || market.key.contains("total")
            "goals" -> listOf("goal", "total", "btts", "score").any { term.contains(it) } ||
                term.contains("گل")
            "corners" -> term.contains("corner") || term.contains("کرنر")
            "cards" -> term.contains("card") || term.contains("کارت")
            "handicap" -> term.contains("handicap") || term.contains("هندیکپ")
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
            Surface(color = Palette.ink, shape = RoundedCornerShape(23.dp),
                modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    SmallPill(if (match.live) tr(state.lang, "LIVE MATCH", "مسابقه زنده")
                        else tr(state.lang, "MATCH PREVIEW", "پیش‌نمایش مسابقه"),
                        Palette.green.copy(alpha = .15f), Palette.green)
                    Spacer(Modifier.height(22.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            TeamBadge(match.home, 56)
                            Spacer(Modifier.height(8.dp))
                            Text(match.home.name, color = Color.White, textAlign = TextAlign.Center,
                                fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 2)
                        }
                        Text(if (match.homeScore != null && match.awayScore != null)
                            match.homeScore.toString() + " : " + match.awayScore.toString() else "VS",
                            color = Color.White, fontSize = 29.sp, fontWeight = FontWeight.Black)
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            TeamBadge(match.away, 56)
                            Spacer(Modifier.height(8.dp))
                            Text(match.away.name, color = Color.White, textAlign = TextAlign.Center,
                                fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 2)
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(match.starts.take(16).replace("T", " · "), color = Color(0xFFB1C2C9), fontSize = 12.sp)
                }
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
                        color = if (selected) Palette.ink else Color.White,
                        border = BorderStroke(1.dp,
                            if (selected) Palette.ink else Palette.border),
                        modifier = Modifier.clickable { selectedMarketGroup = key }) {
                        Text(label, fontWeight = FontWeight.Bold, fontSize = 11.sp,
                            color = if (selected) Palette.green else Palette.text,
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
    ModalBottomSheet(onDismissRequest = { model.showSlip(false) },
        containerColor = Palette.paper, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(color = Palette.ink, shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Palette.green.copy(alpha = .14f),
                            shape = RoundedCornerShape(12.dp)) {
                            Icon(Icons.Default.ReceiptLong, null, tint = Palette.green,
                                modifier = Modifier.padding(10.dp).size(24.dp))
                        }
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(state.lang, "Bet slip", "برگه شرط"),
                                fontSize = 21.sp, fontWeight = FontWeight.Black,
                                color = Color.White)
                            Text(if (state.picks.size > 1) tr(state.lang,
                                "Multiple selections", "شرط میکس") else tr(state.lang,
                                "Single selection", "شرط تکی"),
                                color = Color(0xFFAAC3CA), fontSize = 11.sp)
                        }
                        SmallPill(state.picks.size.toString(),
                            Palette.green.copy(alpha = .16f), Palette.green)
                    }
                    Spacer(Modifier.height(11.dp))
                    Text(tr(state.lang,
                        "Prices shown here are indicative until the server confirms your quote.",
                        "ضرایب تا زمان استعلام و تأیید سرور قطعی نیستند."),
                        color = Color(0xFFA7BEC7), fontSize = 11.sp, lineHeight = 17.sp)
                }
            }
            if (state.picks.isEmpty()) {
                EmptyPanel(tr(state.lang, "No selections", "انتخابی ندارید"),
                    tr(state.lang, "Tap an available odd to get started.", "برای شروع روی یک ضریب باز بزنید."))
            }
            state.picks.forEach { pick ->
                Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, Palette.border)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(pick.match, fontWeight = FontWeight.Bold,
                                fontSize = 12.sp, color = Palette.text)
                            Text(pick.market + " · " + pick.selection,
                                color = Palette.muted, fontSize = 11.sp)
                        }
                        Text(odds(pick.oddsScaled), color = Palette.blue,
                            fontWeight = FontWeight.Black, fontSize = 16.sp)
                        IconButton(onClick = { model.removePick(pick.selectionId) }) {
                            Icon(Icons.Default.Close, "Remove", tint = Palette.muted)
                        }
                    }
                }
            }
            if (state.picks.isNotEmpty()) {
                SectionHeading(tr(state.lang, "Your stake", "مبلغ شرط"),
                    tr(state.lang, "USD · Maximum two decimal places", "دلار · حداکثر دو رقم اعشار"))
                OutlinedTextField(value = stake, onValueChange = { value ->
                    if (value.matches(Regex("[0-9]{0,10}(\\.[0-9]{0,2})?"))) {
                        stake = value
                        model.clearQuote()
                    }
                }, label = { Text(tr(state.lang, "Stake (USD)", "مبلغ شرط (دلار)")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("1.00", "5.00", "10.00", "20.00").forEach { preset ->
                        Surface(shape = RoundedCornerShape(12.dp),
                            color = if (stake == preset) Palette.greenLight else Color.White,
                            border = BorderStroke(1.dp,
                                if (stake == preset) Palette.green else Palette.border),
                            modifier = Modifier.weight(1f).clickable {
                                stake = preset
                                model.clearQuote()
                            }) {
                            Box(Modifier.heightIn(min = 41.dp),
                                contentAlignment = Alignment.Center) {
                                Text("$" + preset.removeSuffix(".00"),
                                    color = Palette.text, fontWeight = FontWeight.ExtraBold,
                                    fontSize = 12.sp)
                            }
                        }
                    }
                }
                if (state.quote != null) {
                    Surface(shape = RoundedCornerShape(16.dp), color = Palette.ink) {
                        Column(Modifier.fillMaxWidth().padding(17.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Verified, null, tint = Palette.green,
                                    modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(7.dp))
                                Text(tr(state.lang, "Official server quote", "استعلام رسمی سرور"),
                                    color = Color.White, fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(state.quote.orEmpty(), fontWeight = FontWeight.Black,
                                fontSize = 27.sp, color = Palette.green)
                            Text(tr(state.lang, "Estimated payout at quote time — no bet has been placed.",
                                "پرداخت احتمالی هنگام استعلام؛ هنوز شرطی ثبت نشده است."),
                                color = Color(0xFFA8C0C8), fontSize = 10.sp, lineHeight = 15.sp)
                        }
                    }
                }
                if (!state.signedIn) Button(
                    onClick = { model.showSlip(false); model.showLogin(true) },
                    colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
                    modifier = Modifier.fillMaxWidth()) {
                    Text(tr(state.lang, "Sign in to request a quote", "برای استعلام ضریب وارد شوید"),
                        color = Palette.ink)
                } else Button(onClick = { model.quote(stake) },
                    enabled = !state.busy, modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Palette.green)) {
                    Text(tr(state.lang, "Get official quote", "استعلام ضریب قطعی"),
                        color = Palette.ink, fontWeight = FontWeight.Bold)
                }
                BvInformationStrip(tr(state.lang,
                        "Real-money placement is disabled in this build pending verified regulatory approval, age and jurisdiction checks. Quotes do not place bets.",
                        "ثبت شرط واقعی در این نسخه تا تأیید مجوز قانونی، سن و منطقه کاربر غیرفعال است. استعلام ضریب به معنی ثبت شرط نیست."),
                    icon = Icons.Default.InfoOutline, accent = Color(0xFF986015))
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
