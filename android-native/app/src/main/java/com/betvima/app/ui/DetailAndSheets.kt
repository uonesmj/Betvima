package com.betvima.app.ui

import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

import androidx.compose.animation.togetherWith
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInWindow
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
    var tvOpen by rememberSaveable(match.id) { mutableStateOf(false) }
    var marketSearch by rememberSaveable(match.id) { mutableStateOf("") }
    LaunchedEffect(match.id) {
        if (match.live && match.id.startsWith("betsapi:live:")) {
            model.refreshMatchFacts(match.id)
            while (true) {
                delay(14_000)
                model.refreshMatchFacts(match.id)
            }
        }
    }
    val facts = state.liveFacts?.takeIf {
        match.id.startsWith("betsapi:live:") &&
        match.id.substringAfterLast(':') == it.fi
    }
    val clockLabel = rememberVerifiedMatchClock(match, facts)

    val marketListState = rememberLazyListState()
    val focusMarketId = state.focusedMarketId
    LaunchedEffect(match.id, focusMarketId) {
        if (focusMarketId != null) {
            selectedMarketGroup = "all"
            marketSearch = ""
        }
    }
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
    // Filter and lookup indexes only when market data or filter changes; live
    // price updates and selection toggles no longer rebuild the full search.
    val marketIndexById = remember(match.markets) {
        match.markets.withIndex().associate { it.value.id to it.index }
    }
    val filteredMarkets = remember(match.markets, selectedMarketGroup, marketSearch) {
        match.markets.filterIndexed { index, market ->
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
    }
    LaunchedEffect(match.id, focusMarketId, filteredMarkets) {
        if (focusMarketId != null) {
            val target = filteredMarkets.indexOfFirst { it.id == focusMarketId }
            if (target >= 0) {
                // Three fixed header items precede the market cards.
                marketListState.animateScrollToItem(target + 3)
            }
        }
    }
    if (tvOpen) PremiumMatchTvModal126(
        match = match, facts = facts, fa = state.lang == Lang.FA,
        clockLabel = clockLabel, onClose = { tvOpen = false },
        onRefresh = { model.refreshMatchFacts(match.id) }
    )
    LazyColumn(state = marketListState, contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = model::closeMatch) {
                    Icon(Icons.Default.ArrowBack, "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(match.league, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                    Text(match.country, color = Palette.muted, fontSize = 11.sp)
                }
                if (match.live) SmallPill("LIVE " + clockLabel,
                    Color(0xFFFFEEF0), Palette.red)
            }
            if (state.detailLoading && !state.detailError) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().padding(top = 5.dp),
                    color = Palette.green
                )
            }
            if (state.detailError) {
                Spacer(Modifier.height(8.dp))
                Surface(shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFFFF7E7),
                    border = BorderStroke(1.dp, Color(0xFFEBCB82))) {
                    Row(Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, null, tint = Color(0xFF9B6B16))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(state.lang,
                            "Fixture loaded. Current markets are unavailable; retry here.",
                            "مسابقه باز شد اما ضرایب فعلی در دسترس نیست؛ همین‌جا دوباره تلاش کنید."),
                            modifier = Modifier.weight(1f), fontSize = 11.sp,
                            color = Color(0xFF745113))
                        TextButton(onClick = { model.openMatch(match.id) }) {
                            Text(tr(state.lang,"Retry","تلاش مجدد"),
                                color = Color(0xFF116C43))
                        }
                    }
                }
            }
        }
        item {
            PremiumMatchScoreHeader126(
                match = match, facts = facts, fa = state.lang == Lang.FA,
                clockLabel = clockLabel, onOpenStudio = { tvOpen = true }
            )
            Spacer(Modifier.height(12.dp))
            Surface(
                color = Palette.ink, shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, Color(0xFF2C4653)),
                shadowElevation = 4.dp
            ) {
                Row(Modifier.fillMaxWidth().padding(5.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    listOf(
                        Triple("score", tr(state.lang, "Score", "نتیجه"), Icons.Default.Scoreboard),
                        Triple("tv", "TV", Icons.Default.Tv),
                        Triple("live", tr(state.lang, "Live tracker", "نمایش زنده"), Icons.Default.Sensors)
                    ).forEach { (mode, text, icon) ->
                        val enabled = mode == "score" || match.live
                        val selected = mode == "score"
                        Surface(
                            modifier = Modifier.weight(1f).heightIn(min = 48.dp)
                                .clickable(enabled = enabled) { if (mode != "score") tvOpen = true },
                            shape = RoundedCornerShape(14.dp),
                            color = if (selected) Color(0xFF255746) else Color(0xFF152831),
                            border = BorderStroke(1.dp,
                                if (selected) Color(0xFF3BCA8D) else Color(0xFF35515C))
                        ) {
                            Row(Modifier.fillMaxSize(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(icon, contentDescription = null,
                                    tint = if (enabled) Color(0xFF4FE5A8) else Color(0xFF66828B),
                                    modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(text, fontSize = 10.sp, fontWeight = FontWeight.Black,
                                    color = if (enabled) Color.White else Color(0xFF66828B),
                                    maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
        item {
            SectionHeading(tr(state.lang, "All markets", "تمام بازارها"),
                tr(state.lang, "Server-sourced selections", "بازارهای دریافت‌شده از سرور"))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 5.dp), flingBehavior = rememberPremiumFlingBehavior()) {
                items(marketGroups, key = { it.first }) { (key, label) ->
                    val selected = selectedMarketGroup == key
                    Surface(shape = RoundedCornerShape(13.dp),
                        color = if (selected) Palette.ink else Color.White,
                        border = BorderStroke(1.dp,
                            if (selected) Palette.green else Palette.border),
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
        items(filteredMarkets, key = { it.id }, contentType = { "market" }) { market ->
            val index = marketIndexById[market.id] ?: 0
            var expanded by rememberSaveable(market.id) {
                mutableStateOf(index < 3 || market.id == focusMarketId)
            }
            LaunchedEffect(market.id, focusMarketId) {
                if (market.id == focusMarketId) expanded = true
            }
            Surface(color = Color.White, shape = RoundedCornerShape(21.dp),
                border = BorderStroke(if (market.id == focusMarketId) 2.dp else 1.dp,
                    if (market.id == focusMarketId) Palette.green else Palette.border),
                shadowElevation = 4.dp) {
                Column {
                    Row(Modifier.fillMaxWidth().clickable { expanded = !expanded }
                        .padding(horizontal = 14.dp, vertical = 15.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(market.label(state.lang == Lang.FA), modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.Bold, color = Palette.text, fontSize = 13.sp)
                        SmallPill(market.selections.size.toString(),
                            Palette.paper, Palette.muted)
                        SmoothExpandChevron(expanded, tint = Palette.muted)
                    }
                    SmoothExpandedContent(expanded) {
                        Column {
                            HorizontalDivider(color = Palette.border)
                            market.selections.chunked(3).forEach { row ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 5.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEach { selection ->
                                    var oddCenter by remember(selection.id) {
                                        mutableStateOf(Offset.Unspecified)
                                    }
                                    Box(Modifier.weight(1f)
                                        .onGloballyPositioned {
                                            oddCenter = it.boundsInWindow().center
                                        }) {
                                        OddsChoice(match, market, selection, state.liveEnabled,
                                            state.picks.any { it.selectionId == selection.id }) {
                                            model.togglePick(match, market, selection,
                                                oddCenter.x, oddCenter.y)
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
@Composable
fun SlipSheet(state: AppState, model: AppViewModel) {
    PremiumSlipSheet(state, model)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginSheet(state: AppState, model: AppViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    // Login credentials are memory-only and must not enter Android saved state.
    var password by remember { mutableStateOf("") }
    var authenticatorCode by remember { mutableStateOf("") }
    var visible by rememberSaveable { mutableStateOf(false) }
    var recovering by rememberSaveable { mutableStateOf(false) }
    val recoveryApi = remember { ApiClient() }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val closeScope = rememberCoroutineScope()
    val smoothClose: () -> Unit = {
        closeScope.launch {
            sheet.hide()
            model.showLogin(false)
        }
    }
    ModalBottomSheet(
        onDismissRequest = smoothClose,
        containerColor = Color.White,
        sheetState = sheet,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
            .padding(horizontal = 14.dp).padding(bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)) {
            // Premium, compact masthead. Branding and trust signal share one row
            // instead of the old two stacked, oversized panels.
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Palette.ink,
                border = BorderStroke(1.dp, Color(0xFF2A4550)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier.background(
                        brush = androidx.compose.ui.graphics.Brush.linearGradient(
                            listOf(
                                Color(0xFF111D2A),
                                Color(0xFF0B302B),
                                Color(0xFF102337)
                            )
                        )
                    )
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(
                            start = 15.dp, end = 7.dp, top = 10.dp, bottom = 10.dp
                        ),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = Color.White.copy(alpha = .09f),
                            border = BorderStroke(1.dp, Palette.green.copy(alpha = .35f)),
                            shape = RoundedCornerShape(13.dp)
                        ) {
                            Icon(
                                Icons.Default.Shield,
                                null,
                                tint = Palette.green,
                                modifier = Modifier.padding(10.dp).size(21.dp)
                            )
                        }
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("BET", color = Color.White,
                                    fontWeight = FontWeight.Black, fontSize = 21.sp)
                                Text("VIMA", color = Palette.green,
                                    fontWeight = FontWeight.Black, fontSize = 21.sp)
                            }
                            Text(tr(state.lang, "Secure access · Official account",
                                "ورود امن · حساب رسمی بت‌ویما"),
                                color = Color(0xFFB8CCD1),
                                fontWeight = FontWeight.Medium, fontSize = 10.sp)
                        }
                        IconButton(onClick = { model.showLogin(false) }) {
                            Icon(
                                Icons.Default.Close,
                                tr(state.lang, "Close", "بستن"),
                                tint = Color(0xFFD8E6ED),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
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
            androidx.compose.animation.AnimatedVisibility(
                visible = !state.authError.isNullOrBlank(),
                enter = androidx.compose.animation.fadeIn() +
                    androidx.compose.animation.expandVertically(),
                exit = androidx.compose.animation.fadeOut() +
                    androidx.compose.animation.shrinkVertically()
            ) {
                Surface(color = Color(0xFFFFEAEB),
                    border = BorderStroke(1.dp, Palette.red.copy(alpha = .2f)),
                    shape = RoundedCornerShape(13.dp)) {
                    Row(Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ErrorOutline, null,
                            tint = Palette.red, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(9.dp))
                        Text(state.authError.orEmpty(), color = Palette.red,
                            modifier = Modifier.weight(1f), fontSize = 12.sp,
                            lineHeight = 18.sp)
                    }
                }
            }
            Surface(
                color = Color(0xFFF0FAF6),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0xFFD4EDE2)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Color(0xFFDDF5E7),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.VerifiedUser, null, tint = Color(0xFF087B50),
                            modifier = Modifier.padding(7.dp).size(18.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "Protected BetVima account", "حساب حفاظت‌شده بت‌ویما"),
                            color = Palette.text, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text(tr(state.lang, "Verified sign-in · Private account",
                            "ورود تأییدشده · حساب خصوصی"),
                            color = Palette.muted, fontSize = 10.sp)
                    }
                    Icon(Icons.Default.Lock, null, tint = Color(0xFF087B50),
                        modifier = Modifier.size(17.dp))
                }
            }
            // Keep the live Cloudflare WebView in a stable subtree.
            // AnimatedContent previously kept outgoing content mounted while
            // transitioning and could recreate the challenge mid-load.
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (recovering && !state.registerScreen) {
                        PasswordRecoveryPanel(
                            lang = state.lang,
                            account = RecoveryAccount.SPORTSBOOK,
                            api = recoveryApi,
                            initialEmail = email,
                            onBack = { recovering = false }
                        )
                    } else if (state.mfaRequired) {
                        Text(tr(state.lang, "Authenticator verification", "تأیید دومرحله‌ای"),
                            color = Palette.text, fontWeight = FontWeight.Black, fontSize = 23.sp)
                        Text(tr(state.lang,
                            "Open Google Authenticator and enter the six-digit code to finish signing in.",
                            "Google Authenticator را باز کنید و کد شش‌رقمی را برای تکمیل ورود وارد کنید."),
                            color = Palette.muted, fontSize = 12.sp)
                        if (state.mfaChoices.size > 1) {
                            Text(tr(state.lang, "Choose an authenticator",
                                "برنامه امنیتی را انتخاب کنید"),
                                color = Palette.text, fontSize = 12.sp,
                                fontWeight = FontWeight.Bold)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                state.mfaChoices.forEach { factor ->
                                    FilterChip(
                                        selected = state.selectedMfaFactor == factor.id,
                                        onClick = {
                                            model.chooseMfaFactor(factor.id)
                                            authenticatorCode = ""
                                        },
                                        label = { Text(if (factor.name.contains("Backup", ignoreCase = true))
                                            tr(state.lang, "Backup authenticator", "برنامه پشتیبان")
                                            else tr(state.lang, "Primary authenticator", "برنامه اصلی")) },
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = authenticatorCode,
                            onValueChange = { authenticatorCode = it.filter(Char::isDigit).take(6) },
                            label = { Text(tr(state.lang, "6-digit security code", "کد امنیتی ۶ رقمی")) },
                            leadingIcon = { Icon(Icons.Default.Security, null) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp))
                        Button(
                            onClick = {
                                model.verifyMfa(authenticatorCode)
                                authenticatorCode = ""
                                password = ""
                            },
                            enabled = !state.busy && authenticatorCode.length == 6,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Palette.green, contentColor = Palette.ink)) {
                            if (state.busy) CircularProgressIndicator(
                                Modifier.size(19.dp), color = Palette.ink, strokeWidth = 2.dp)
                            else Text(tr(state.lang, "Verify and sign in", "تأیید و ورود"),
                                fontWeight = FontWeight.Black)
                        }
                        TextButton(onClick = {
                            authenticatorCode = ""
                            model.showLogin(false)
                            model.showLogin(true)
                        }) {
                            Text(tr(state.lang, "Back to sign in", "بازگشت به ورود"), color = Palette.blue)
                        }
                    } else if (!state.registerScreen) {
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
                            onClick = { recovering = true; password = "" },
                            modifier = Modifier.align(Alignment.End)) {
                            Text(tr(state.lang, "Forgot password?", "رمز را فراموش کرده‌اید؟"),
                                color = Palette.blue, fontSize = 12.sp)
                        }
                    } else {
                        NativeRegistrationForm(
                            lang = state.lang,
                            loginBusy = state.busy,
                            onSignIn = { createdEmail, createdPassword ->
                                model.signIn(createdEmail, createdPassword, navigateHome = true)
                            },
                            onLogin = { model.setRegisterScreen(false) }
                        )
                    }
            }
            ResponsibleNote(state.lang)
        }
    }
}
