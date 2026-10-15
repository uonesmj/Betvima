package com.betvima.app.ui

import kotlinx.coroutines.launch

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
                if (match.live) SmallPill("LIVE " + (match.minute ?: 0) + "′",
                    Color(0xFFFFEEF0), Palette.red)
            }
        }
        item {
            Surface(color = Color.White, shape = RoundedCornerShape(21.dp),
                border = BorderStroke(1.dp, Palette.border), shadowElevation = 3.dp) {
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
                Surface(color = Palette.ink,
                    border = BorderStroke(1.dp, Palette.green.copy(alpha = .5f)),
                    shadowElevation = 5.dp,
                    shape = RoundedCornerShape(15.dp)) {
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
        items(filteredMarkets, key = { it.id }) { market ->
            val index = match.markets.indexOfFirst { it.id == market.id }
            var expanded by rememberSaveable(market.id) { mutableStateOf(index < 3) }
            Surface(color = Color.White, shape = RoundedCornerShape(21.dp),
                border = BorderStroke(1.dp, Palette.border), shadowElevation = 4.dp) {
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
    var visible by rememberSaveable { mutableStateOf(false) }
    val uri = LocalUriHandler.current
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val closeScope = rememberCoroutineScope()
    val smoothClose = {
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
                    if (!state.registerScreen) {
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
