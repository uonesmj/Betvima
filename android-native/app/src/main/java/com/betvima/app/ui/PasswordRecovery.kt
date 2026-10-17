package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.ApiClient
import kotlinx.coroutines.launch

/** Both portals use Supabase recovery, but always return to their own login. */
internal enum class RecoveryAccount { SPORTSBOOK, AFFILIATE }

internal fun validRecoveryEmail(value: String): Boolean {
    val email = value.trim()
    return email.length in 5..254 &&
        Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email)
}

internal fun recoveryRedirect(account: RecoveryAccount): String =
    "https://betvima.com/auth/reset-password" +
        if (account == RecoveryAccount.AFFILIATE) "?from=affiliate" else ""

internal fun recoveryLoginUrl(account: RecoveryAccount): String =
    if (account == RecoveryAccount.AFFILIATE) "https://betvima.com/affiliate/login"
    else "https://betvima.com/auth/login"

@Composable
internal fun PasswordRecoveryPanel(
    lang: Lang,
    account: RecoveryAccount,
    api: ApiClient,
    initialEmail: String = "",
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val uri = LocalUriHandler.current
    var email by rememberSaveable(account) { mutableStateOf(initialEmail.trim()) }
    var configRevision by remember { mutableIntStateOf(0) }
    var widgetRevision by remember { mutableIntStateOf(0) }
    var siteKey by remember { mutableStateOf<String?>(null) }
    var configError by remember { mutableStateOf<String?>(null) }
    var token by remember { mutableStateOf<String?>(null) }
    var challengeReady by remember { mutableStateOf(false) }
    var challengeError by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var sent by rememberSaveable(account) { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val accent = if (account == RecoveryAccount.AFFILIATE) affiliateBlue else Palette.blue
    val accountName = if (account == RecoveryAccount.AFFILIATE)
        tr(lang, "Affiliate account", "حساب افیلیت")
    else tr(lang, "BetVima account", "حساب بت‌ویما")

    LaunchedEffect(configRevision, sent) {
        if (sent) return@LaunchedEffect
        siteKey = null
        token = null
        challengeError = false
        challengeReady = false
        configError = null
        try {
            siteKey = publicTurnstileKey(api.get("/api/v1/mobile/config"))
            if (siteKey == null) {
                configError = tr(lang,
                    "Security verification is currently unavailable. Try again later.",
                    "تأیید امنیتی در دسترس نیست. کمی بعد دوباره تلاش کنید.")
            }
        } catch (_: Exception) {
            configError = tr(lang, "Unable to connect. Check your internet and retry.",
                "ارتباط برقرار نشد. اینترنت را بررسی و دوباره تلاش کنید.")
        }
    }

    Surface(color = Color.White, shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Palette.border),
        modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = accent.copy(alpha = .10f), shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Default.LockReset, null, tint = accent,
                        modifier = Modifier.padding(12.dp).size(27.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Reset your password", "بازیابی رمز عبور"),
                        color = Palette.text, fontWeight = FontWeight.Black, fontSize = 19.sp)
                    Text(accountName, color = accent, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp)
                }
                Icon(Icons.Default.VerifiedUser, null, tint = Color(0xFF188865),
                    modifier = Modifier.size(22.dp))
            }
            if (sent) {
                Surface(color = Color(0xFFEAF8F2), shape = RoundedCornerShape(15.dp)) {
                    Column(Modifier.fillMaxWidth().padding(15.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.MarkEmailRead, null,
                            tint = Color(0xFF12845D), modifier = Modifier.size(34.dp))
                        Text(tr(lang, "Check your email", "ایمیل خود را بررسی کنید"),
                            fontSize = 17.sp, fontWeight = FontWeight.Black, color = Palette.text)
                        Text(tr(lang,
                            "If an account exists for this email, a secure password reset link has been sent. Open the link to choose a new password on BetVima's secure page. Check Spam too.",
                            "اگر حسابی با این ایمیل وجود داشته باشد، لینک امن بازیابی ارسال شده است. لینک را باز کنید و در صفحه امن بت‌ویما رمز جدید بسازید. پوشه اسپم را نیز بررسی کنید."),
                            color = Palette.text, fontSize = 12.sp, lineHeight = 20.sp)
                    }
                }
                Button(onClick = onBack, modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accent)) {
                    Text(tr(lang, "Back to login", "بازگشت به ورود"),
                        fontWeight = FontWeight.Black, color = Color.White)
                }
                TextButton(onClick = {
                    sent = false
                    error = null
                    token = null
                    widgetRevision++
                    configRevision++
                }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text(tr(lang, "Use another email or resend", "استفاده از ایمیل دیگر یا ارسال مجدد"),
                        color = accent, fontSize = 12.sp)
                }
            } else {
                Text(tr(lang,
                    "Enter the email address you used when registering. We will send a secure link to reset your password.",
                    "ایمیلی را که با آن ثبت‌نام کرده‌اید وارد کنید تا لینک امن تغییر رمز برایتان ارسال شود."),
                    color = Palette.muted, fontSize = 12.sp, lineHeight = 19.sp)
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.trim().take(254); error = null },
                    label = { Text(tr(lang, "Registered email", "ایمیل ثبت‌شده")) },
                    placeholder = { Text("name@example.com") },
                    leadingIcon = { Icon(Icons.Default.AlternateEmail, null) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Shield, null, tint = accent,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(tr(lang, "Cloudflare security verification", "تأیید امنیتی کلودفلر"),
                        color = Palette.text, fontSize = 12.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    if (challengeError) TextButton(onClick = {
                        token = null
                        challengeError = false
                        challengeReady = false
                        widgetRevision++
                    }) { Text(tr(lang, "Retry", "تلاش مجدد"), color = accent) }
                }
                Surface(color = Color.White, shape = RoundedCornerShape(13.dp),
                    border = BorderStroke(1.dp, Palette.border),
                    modifier = Modifier.fillMaxWidth()) {
                    when {
                        siteKey == null -> Column(Modifier.padding(15.dp),
                            verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            if (configError == null) {
                                CircularProgressIndicator(Modifier.size(20.dp),
                                    color = accent, strokeWidth = 2.dp)
                                Text(tr(lang, "Loading verification…", "در حال بارگذاری تأیید…"),
                                    color = Palette.muted, fontSize = 11.sp)
                            } else {
                                Text(configError.orEmpty(), color = Palette.red, fontSize = 12.sp)
                                OutlinedButton(onClick = { configRevision++ }) {
                                    Text(tr(lang, "Retry connection", "تلاش دوباره"))
                                }
                                TextButton(onClick = { uri.openUri(recoveryLoginUrl(account)) }) {
                                    Icon(Icons.Default.OpenInNew, null,
                                        modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(5.dp))
                                    Text(tr(lang, "Recover on official website", "بازیابی در سایت رسمی"),
                                        fontSize = 12.sp)
                                }
                            }
                        }
                        else -> Column(Modifier.padding(horizontal = 5.dp, vertical = 5.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            if (!challengeReady && !challengeError)
                                LinearProgressIndicator(Modifier.fillMaxWidth(), color = accent)
                            RealTurnstileWidget(
                                siteKey = siteKey!!,
                                revision = widgetRevision,
                                action = "forgot-password",
                                callback = { token = it; challengeError = it == null },
                                onReady = { challengeReady = true; challengeError = false },
                                onFailure = {
                                    token = null
                                    challengeReady = false
                                    challengeError = true
                                }
                            )
                        }
                    }
                }
                if (!error.isNullOrBlank()) {
                    Surface(color = Color(0xFFFFEDEF), shape = RoundedCornerShape(12.dp)) {
                        Text(error.orEmpty(), color = Palette.red,
                            modifier = Modifier.fillMaxWidth().padding(12.dp), fontSize = 12.sp)
                    }
                }
                Button(
                    onClick = {
                        if (!validRecoveryEmail(email) || token.isNullOrBlank() || busy) return@Button
                        val recoveryEmail = email.trim()
                        val verifiedToken = token ?: return@Button
                        busy = true
                        error = null
                        scope.launch {
                            try {
                                api.sendPasswordResetLink(
                                    email = recoveryEmail, turnstileToken = verifiedToken,
                                    redirectUrl = recoveryRedirect(account)
                                )
                                sent = true
                                token = null
                            } catch (ex: Exception) {
                                error = tr(lang,
                                    "Could not send the link. Check your connection or try again later.",
                                    "ارسال لینک انجام نشد. اتصال اینترنت را بررسی و کمی بعد تلاش کنید.")
                                token = null
                                challengeReady = false
                                widgetRevision++
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = !busy && validRecoveryEmail(email) && !token.isNullOrBlank(),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accent)
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp),
                        color = Color.White, strokeWidth = 2.dp)
                    else {
                        Icon(Icons.Default.MarkEmailUnread, null, modifier = Modifier.size(19.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang, "Send reset link", "ارسال لینک بازیابی"),
                            fontWeight = FontWeight.Black)
                    }
                }
                Text(tr(lang,
                    "For your security, we never disclose whether an email is registered.",
                    "برای حفظ امنیت، وجود یا نبود حساب با این ایمیل نمایش داده نمی‌شود."),
                    color = Palette.muted, fontSize = 10.sp,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = onBack, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Icon(Icons.Default.ArrowBack, null, tint = accent,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(tr(lang, "Back to login", "بازگشت به ورود"),
                        color = accent, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
