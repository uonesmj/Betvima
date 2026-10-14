package com.betvima.app.ui

import androidx.compose.animation.togetherWith
import androidx.compose.animation.animateContentSize
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

/**
 * Stable reference-style bet slip:
 * - header and mode selector are NOT scrollable;
 * - only selections scroll, preserving the current item on additions;
 * - stake presets, payout and primary CTA are PINNED at the bottom.
 * No text/button can be pushed below the screen by added selections.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SlipSheet(state: AppState, model: AppViewModel) {
    var stake by rememberSaveable { mutableStateOf("5.00") }
    var mode by rememberSaveable { mutableStateOf("single") }
    val selectionScroll = androidx.compose.foundation.lazy.rememberLazyListState()
    LaunchedEffect(state.picks.size) {
        val recommendedMode = if (state.picks.size > 1) "multiple" else "single"
        if (mode != recommendedMode) {
            mode = recommendedMode
            model.clearQuote()
        }
    }
    val canQuote = state.picks.isNotEmpty() &&
        ((mode == "single" && state.picks.size == 1) ||
            (mode == "multiple" && state.picks.size >= 2))
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = { model.showSlip(false) },
        sheetState = sheet,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 23.dp, topEnd = 23.dp),
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.85f).imePadding()) {
            // Fixed header, visually distinct from selections.
            Surface(color = Color(0xFFE7E9EF),
                modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().heightIn(min = 57.dp)
                    .padding(horizontal = 12.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { model.showSlip(false) }) {
                        Icon(Icons.Default.KeyboardArrowDown,
                            tr(state.lang, "Close slip", "بستن برگه شرط"),
                            tint = Palette.muted)
                    }
                    Text(tr(state.lang, "Betslip", "برگه شرط"),
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Black,
                        fontSize = 19.sp, color = Palette.text)
                    Text(state.wallet?.let { money(it.availableMinor, it.currency) }
                        ?: tr(state.lang, "USD", "دلار"),
                        fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = Palette.text, maxLines = 1)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 9.dp),
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFEDEFF3), modifier = Modifier.weight(1f)) {
                    Row(Modifier.padding(3.dp)) {
                        listOf(
                            "single" to tr(state.lang, "Single", "تکی"),
                            "multiple" to tr(state.lang, "Multiple", "میکس"),
                            "series" to tr(state.lang, "Series", "سیستمی")
                        ).forEach { (type, text) ->
                            val selected by androidx.compose.animation.animateColorAsState(
                                if (mode == type) Palette.blue else Color.Transparent,
                                label = "slipMode")
                            Surface(color = selected, shape = RoundedCornerShape(9.dp),
                                modifier = Modifier.weight(1f).heightIn(min = 41.dp)
                                    .clickable(enabled = type != "series") {
                                        mode = type; model.clearQuote()
                                    }) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(text, fontSize = 12.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (type == "series") Palette.muted
                                            else if (mode == type) Color.White else Palette.text)
                                }
                            }
                        }
                    }
                }
                Surface(color = Color(0xFFEDEFF3),
                    shape = RoundedCornerShape(11.dp),
                    modifier = Modifier.size(47.dp).clickable { model.clearPicks() }) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.DeleteOutline,
                            tr(state.lang, "Clear", "پاک کردن"), tint = Palette.muted)
                    }
                }
            }
            HorizontalDivider(color = Palette.border, thickness = 1.dp)

            // Only this middle pane can scroll. It cannot move or occlude the CTA.
            LazyColumn(
                state = selectionScroll,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 11.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                if (state.picks.isEmpty()) item(key = "empty") {
                    EmptyPanel(
                        tr(state.lang, "No selections", "انتخابی ندارید"),
                        tr(state.lang,
                            "Choose an available price to add a match.",
                            "برای افزودن مسابقه یکی از ضرایب باز را انتخاب کنید."))
                }
                items(state.picks, key = { it.selectionId }) { pick ->
                    Surface(
                        color = Color(0xFFF0F1F5),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, Palette.border)
                    ) {
                        Column(Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(pick.match, color = Palette.muted,
                                    modifier = Modifier.weight(1f),
                                    fontSize = 11.sp, maxLines = 2)
                                IconButton(
                                    onClick = { model.removePick(pick.selectionId) },
                                    modifier = Modifier.size(34.dp)) {
                                    Icon(Icons.Default.Close,
                                        tr(state.lang, "Remove match", "حذف مسابقه"),
                                        tint = Palette.muted, modifier = Modifier.size(19.dp))
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(pick.market, fontSize = 11.sp,
                                        color = Palette.muted, maxLines = 1)
                                    Text(pick.selection, fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Palette.text, maxLines = 2)
                                }
                                Surface(color = Palette.blue,
                                    shape = RoundedCornerShape(9.dp)) {
                                    Text(odds(pick.oddsScaled),
                                        color = Color.White,
                                        modifier = Modifier.padding(
                                            horizontal = 12.dp, vertical = 8.dp),
                                        fontWeight = FontWeight.Black, fontSize = 15.sp)
                                }
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = Palette.border, thickness = 1.dp)

            // Pinned action dock: stake, presets, possible win and CTA never scroll.
            Column(Modifier.fillMaxWidth().background(Color.White)
                .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.picks.isNotEmpty()) {
                    val invalidMode = !canQuote
                    if (invalidMode) Text(
                        tr(state.lang,
                            "Single: 1 selection · Multiple: 2+ selections · Series unavailable",
                            "تکی: ۱ انتخاب · میکس: حداقل ۲ انتخاب · سیستمی غیرفعال"),
                        fontSize = 10.sp, color = Palette.red,
                        maxLines = 2)
                    OutlinedTextField(
                        value = stake,
                        onValueChange = { value ->
                            if (value.matches(Regex("[0-9]{0,10}(\\.[0-9]{0,2})?"))) {
                                stake = value; model.clearQuote()
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(tr(state.lang, "Stake (USD)", "مبلغ شرط (دلار)")) },
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        listOf("1.00", "5.00", "10.00", "20.00").forEach { preset ->
                            Surface(
                                shape = RoundedCornerShape(9.dp),
                                color = if (stake == preset) Palette.blue
                                    else Color(0xFFEDEFF3),
                                modifier = Modifier.weight(1f).heightIn(min = 35.dp)
                                    .clickable { stake = preset; model.clearQuote() }) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("$" + preset.removeSuffix(".00"),
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 11.sp,
                                        color = if (stake == preset) Color.White
                                            else Palette.text)
                                }
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(tr(state.lang, "Possible win", "برد احتمالی"),
                            color = Palette.muted, fontSize = 11.sp,
                            modifier = Modifier.weight(1f))
                        androidx.compose.animation.AnimatedContent(
                            targetState = if (canQuote) state.quote ?: "—" else "—",
                            label = "officialQuote") { payout ->
                            Text(payout, color = Palette.green,
                                fontWeight = FontWeight.Black, fontSize = 15.sp)
                        }
                    }
                }
                BvPrimaryButton(
                    label = when {
                        state.picks.isEmpty() ->
                            tr(state.lang, "Select a match", "انتخاب مسابقه")
                        !state.signedIn ->
                            tr(state.lang, "Log in for official quote", "ورود برای استعلام")
                        else ->
                            tr(state.lang, "Request official quote", "استعلام رسمی ضریب")
                    },
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
                    "Preview only · Wager placement is disabled.",
                    "نسخه آزمایشی · ثبت شرط واقعی غیرفعال است."),
                    color = Palette.muted, fontSize = 9.sp,
                    maxLines = 2, lineHeight = 13.sp)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginSheet(state: AppState, model: AppViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var visible by rememberSaveable { mutableStateOf(false) }
    var registrationBrowserOpened by rememberSaveable { mutableStateOf(false) }
    androidx.lifecycle.compose.LifecycleEventEffect(androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
        if (registrationBrowserOpened) {
            registrationBrowserOpened = false
            // After returning from Cloudflare-protected registration, show native login.
            model.setRegisterScreen(false)
        }
    }
    val uri = LocalUriHandler.current
    val context = androidx.compose.ui.platform.LocalContext.current
    val browserRegistration: () -> Unit = {
        registrationBrowserOpened = true
        // Account creation MUST pass the server's Cloudflare Turnstile, age and
        // terms checks. Do not bypass them through a direct Supabase sign-up.
        val target = android.net.Uri.parse("https://betvima.com/auth/register")
        runCatching {
            androidx.browser.customtabs.CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build().launchUrl(context, target)
        }.onFailure { uri.openUri(target.toString()) }
        Unit
    }
    ModalBottomSheet(
        onDismissRequest = { model.showLogin(false) },
        containerColor = Color.White,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
            .padding(horizontal = 19.dp).padding(bottom = 34.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("BET", color = Palette.text, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("VIMA", color = Palette.green, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { model.showLogin(false) }) {
                    Icon(Icons.Default.Close, tr(state.lang, "Close", "بستن"),
                        tint = Palette.muted)
                }
            }
            Surface(shape = RoundedCornerShape(14.dp), color = Color(0xFFEDEFF3)) {
                Row(Modifier.fillMaxWidth().padding(4.dp)) {
                    listOf(
                        false to tr(state.lang, "Log in", "ورود"),
                        true to tr(state.lang, "Sign up", "ثبت‌نام")
                    ).forEach { (register, title) ->
                        val selected = state.registerScreen == register
                        val background by androidx.compose.animation.animateColorAsState(
                            if (selected) Palette.blue else Color.Transparent,
                            label = "authTabColor")
                        Surface(
                            color = background,
                            shape = RoundedCornerShape(11.dp),
                            modifier = Modifier.weight(1f).height(46.dp)
                                .clickable { model.setRegisterScreen(register) }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(title, color = if (selected) Color.White else Palette.text,
                                    fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
            androidx.compose.animation.AnimatedContent(
                targetState = state.registerScreen,
                label = "authModeTransition",
                transitionSpec = {
                    (androidx.compose.animation.fadeIn() +
                        androidx.compose.animation.slideInHorizontally { it / 5 })
                        .togetherWith(androidx.compose.animation.fadeOut() +
                            androidx.compose.animation.slideOutHorizontally { -it / 5 })
                }
            ) { registering ->
                Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    if (!registering) {
                        Text(tr(state.lang, "Welcome back", "خوش آمدید"),
                            fontSize = 24.sp, fontWeight = FontWeight.Black,
                            color = Palette.text)
                        Text(tr(state.lang,
                            "Use your BetVima account credentials to access your wallet and tickets.",
                            "با مشخصات حساب بت‌ویما وارد شوید و به کیف‌پول و شرط‌ها دسترسی داشته باشید."),
                            fontSize = 12.sp, color = Palette.muted, lineHeight = 19.sp)
                        OutlinedTextField(
                            value = email, onValueChange = { email = it.trim().take(254) },
                            label = { Text(tr(state.lang, "Email", "ایمیل")) },
                            leadingIcon = { Icon(Icons.Default.Email, null) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true, shape = RoundedCornerShape(13.dp),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                        )
                        OutlinedTextField(
                            value = password, onValueChange = { password = it.take(128) },
                            label = { Text(tr(state.lang, "Password", "رمز عبور")) },
                            leadingIcon = { Icon(Icons.Default.Lock, null) },
                            trailingIcon = {
                                IconButton(onClick = { visible = !visible }) {
                                    Icon(if (visible) Icons.Default.VisibilityOff
                                        else Icons.Default.Visibility,
                                        tr(state.lang, "Show or hide password",
                                            "نمایش یا پنهان‌کردن رمز"))
                                }
                            },
                            modifier = Modifier.fillMaxWidth(), singleLine = true,
                            shape = RoundedCornerShape(13.dp),
                            visualTransformation = if (visible)
                                androidx.compose.ui.text.input.VisualTransformation.None
                            else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                        )
                        Button(onClick = { model.signIn(email, password) },
                            enabled = !state.busy && email.contains("@") &&
                                password.length >= 8,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Palette.green, contentColor = Palette.ink),
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier.fillMaxWidth().height(53.dp)) {
                            if (state.busy) CircularProgressIndicator(Modifier.size(20.dp),
                                color = Palette.ink, strokeWidth = 2.dp)
                            else Text(tr(state.lang, "Log in securely", "ورود امن به حساب"),
                                fontWeight = FontWeight.Black)
                        }
                        TextButton(
                            onClick = {
                                uri.openUri("https://betvima.com/auth/reset-password")
                            },
                            modifier = Modifier.align(Alignment.End)) {
                            Text(tr(state.lang, "Forgot password?", "رمز را فراموش کرده‌اید؟"),
                                color = Palette.blue, fontSize = 12.sp)
                        }
                    } else {
                        Text(tr(state.lang, "Create your account", "ساخت حساب کاربری"),
                            fontSize = 24.sp, fontWeight = FontWeight.Black,
                            color = Palette.text)
                        Text(tr(state.lang,
                            "For your security, registration uses the verified BetVima form with age, terms and Cloudflare bot verification. Return here to log in after registration.",
                            "برای امنیت حساب، ثبت‌نام در فرم رسمی بت‌ویما با تأیید سن، قوانین و بررسی ضدربات انجام می‌شود. پس از ثبت‌نام به اپ برگردید و وارد شوید."),
                            fontSize = 12.sp, lineHeight = 20.sp, color = Palette.muted)
                        BvInformationStrip(
                            tr(state.lang,
                                "Official BetVima registration: email, password, optional referral code, age and terms confirmation, followed by real Cloudflare Turnstile verification.",
                                "ثبت‌نام رسمی بت‌ویما شامل ایمیل، رمز عبور، کد معرف اختیاری، تأیید سن و قوانین و سپس بررسی واقعی کلودفلر است."),
                            icon = Icons.Default.VerifiedUser, accent = Palette.blue)
                        Surface(color = Palette.paper, shape = RoundedCornerShape(15.dp)) {
                            Column(Modifier.fillMaxWidth().padding(13.dp),
                                verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Text(tr(state.lang, "Security checks", "کنترل‌های امنیتی"),
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Palette.text, fontSize = 13.sp)
                                listOf(
                                    tr(state.lang, "Account email and strong password",
                                        "ایمیل و رمز عبور امن"),
                                    tr(state.lang, "18+ and terms confirmation",
                                        "تأیید سن بالای ۱۸ سال و قوانین"),
                                    tr(state.lang, "Cloudflare I'm not a robot verification",
                                        "تأیید واقعی «من ربات نیستم» کلودفلر")
                                ).forEach { item ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        // A requirement, not an already-verified Cloudflare check.
                                        Icon(Icons.Default.RadioButtonUnchecked, null,
                                            tint = Palette.muted, modifier = Modifier.size(17.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(item, color = Palette.text, fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                        Button(onClick = browserRegistration,
                            shape = RoundedCornerShape(13.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Palette.green, contentColor = Palette.ink),
                            modifier = Modifier.fillMaxWidth().height(53.dp)) {
                            Icon(Icons.Default.OpenInBrowser, null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(tr(state.lang, "Open verified registration", "ثبت‌نام امن بت‌ویما"),
                                fontWeight = FontWeight.Black)
                        }
                        OutlinedButton(onClick = { model.setRegisterScreen(false) },
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier.fillMaxWidth().height(49.dp)) {
                            Text(tr(state.lang, "I registered — log in", "ثبت‌نام کردم؛ ورود به اپ"),
                                color = Palette.blue, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            ResponsibleNote(state.lang)
        }
    }
}
