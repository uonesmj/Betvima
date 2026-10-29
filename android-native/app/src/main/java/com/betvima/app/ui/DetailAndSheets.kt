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

/** Production match details: native scroll-pinned reference layout. */
@Composable
fun MatchDetailPage(state: AppState, model: AppViewModel) {
    ReferenceMatchDetail211(state, model)
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
    val loginFieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = DarkHomePalette.ink,
        unfocusedTextColor = DarkHomePalette.ink,
        focusedContainerColor = DarkHomePalette.panel,
        unfocusedContainerColor = DarkHomePalette.panel,
        focusedBorderColor = Palette.blue,
        unfocusedBorderColor = DarkHomePalette.outline,
        focusedLabelColor = Color(0xFF85C5FF),
        unfocusedLabelColor = DarkHomePalette.muted,
        focusedLeadingIconColor = Color(0xFF85C5FF),
        unfocusedLeadingIconColor = DarkHomePalette.muted,
        focusedTrailingIconColor = DarkHomePalette.muted,
        unfocusedTrailingIconColor = DarkHomePalette.muted,
        cursorColor = Palette.blue
    )
    ModalBottomSheet(
        onDismissRequest = smoothClose,
        containerColor = DarkHomePalette.canvas,
        contentColor = DarkHomePalette.ink,
        scrimColor = Color.Black.copy(alpha = .72f),
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
            Surface(shape = RoundedCornerShape(14.dp), color = DarkHomePalette.panel) {
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
                                Text(title, color = if (selected) Color.White else DarkHomePalette.ink,
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
                Surface(color = Color(0xFF3D252B),
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
                color = Color(0xFF1C2F2A),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0xFF34594C)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Color(0xFF214237),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.VerifiedUser, null, tint = Color(0xFF67D8AA),
                            modifier = Modifier.padding(7.dp).size(18.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "Protected BetVima account", "حساب حفاظت‌شده بت‌ویما"),
                            color = DarkHomePalette.ink, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text(tr(state.lang, "Verified sign-in · Private account",
                            "ورود تأییدشده · حساب خصوصی"),
                            color = DarkHomePalette.muted, fontSize = 10.sp)
                    }
                    Icon(Icons.Default.Lock, null, tint = Color(0xFF67D8AA),
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
                            color = DarkHomePalette.ink, fontWeight = FontWeight.Black, fontSize = 23.sp)
                        Text(tr(state.lang,
                            "Open Google Authenticator and enter the six-digit code to finish signing in.",
                            "Google Authenticator را باز کنید و کد شش‌رقمی را برای تکمیل ورود وارد کنید."),
                            color = DarkHomePalette.muted, fontSize = 12.sp)
                        if (state.mfaChoices.size > 1) {
                            Text(tr(state.lang, "Choose an authenticator",
                                "برنامه امنیتی را انتخاب کنید"),
                                color = DarkHomePalette.ink, fontSize = 12.sp,
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
                            shape = RoundedCornerShape(14.dp), colors = loginFieldColors)
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
                            color = DarkHomePalette.ink)
                        Text(tr(state.lang,
                            "Use your BetVima account credentials to access your wallet and tickets.",
                            "با مشخصات حساب بت‌ویما وارد شوید و به کیف‌پول و شرط‌ها دسترسی داشته باشید."),
                            fontSize = 12.sp, color = DarkHomePalette.muted, lineHeight = 19.sp)
                        OutlinedTextField(
                            value = email, onValueChange = { email = it.trim().take(254) },
                            label = { Text(tr(state.lang, "Email", "ایمیل")) },
                            leadingIcon = { Icon(Icons.Default.Email, null) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true, shape = RoundedCornerShape(13.dp),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                             colors = loginFieldColors
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
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                             colors = loginFieldColors
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
