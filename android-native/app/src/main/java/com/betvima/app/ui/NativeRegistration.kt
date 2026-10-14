package com.betvima.app.ui

import android.annotation.SuppressLint
import android.net.Uri
import android.webkit.*
import androidx.compose.foundation.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.betvima.app.data.ApiClient
import com.betvima.app.data.ApiFailure
import com.betvima.app.data.str
import kotlinx.coroutines.launch
import org.json.JSONObject

/** UI validation only; all rules are enforced again by the first-party server. */
internal fun signupValidation(
    email: String, password: String, confirmation: String,
    adult: Boolean, terms: Boolean
): String? = when {
    !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email.trim()) -> "email"
    password.length !in 8..128 -> "password"
    confirmation != password -> "confirmation"
    !adult -> "age"
    !terms -> "terms"
    else -> null
}
internal fun signupPayload(
    email: String, password: String, currency: String, referral: String,
    locale: String, token: String
): JSONObject = JSONObject().apply {
    put("email", email.trim())
    put("password", password)
    put("currency", currency)
    // API zod schema accepts an optional string, not an explicit JSON null.
    referral.trim().uppercase().takeIf { it.isNotBlank() }
        ?.let { put("referralCode", it) }
    put("ageConfirmed", true)
    put("acceptTerms", true)
    put("locale", locale)
    put("turnstileToken", token)
}

/** The mobile client unwraps server responses; tolerate a wrapped test response too. */
internal fun publicTurnstileKey(config: JSONObject): String? {
    val fields = config.optJSONObject("data") ?: config
    return fields.optString("turnstileSiteKey").trim()
        .takeIf { it.matches(Regex("[0-9A-Za-z_-]{10,160}")) }
}

/** No password or access token ever crosses the JavaScript bridge. */
private class TurnstileCallbacks(
    private val notify: (String?) -> Unit,
    private val failure: () -> Unit
) {
    @JavascriptInterface fun verified(token: String) {
        if (token.length in 10..2048) notify(token) else failure()
    }
    @JavascriptInterface fun invalid() = notify(null)
    @JavascriptInterface fun unavailable() = failure()
}

private fun allowedAuthUrl(url: Uri?): Boolean {
    if (url?.scheme == "about" && url.schemeSpecificPart in setOf("blank", "srcdoc"))
        return true
    if (url?.scheme != "https") return false
    val host = url.host?.lowercase() ?: return false
    return host == "betvima.com" || host == "www.betvima.com" ||
        host == "challenges.cloudflare.com" || host.endsWith(".challenges.cloudflare.com")
}

/** Widget is confined to the BetVima HTTPS origin, using the same public site key as web. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun RealTurnstileWidget(
    siteKey: String, revision: Int, callback: (String?) -> Unit, onFailure: () -> Unit
) {
    val context = LocalContext.current
    val currentCallback by rememberUpdatedState(callback)
    val currentFailure by rememberUpdatedState(onFailure)
    key(siteKey, revision) {
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(166.dp),
            factory = {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    settings.cacheMode = WebSettings.LOAD_NO_CACHE
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    setBackgroundColor(android.graphics.Color.WHITE)
                    addJavascriptInterface(TurnstileCallbacks(
                        notify = { received -> post { currentCallback(received) } },
                        failure = { post { currentFailure() } }
                    ), "NativeTurnstile")
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?, request: WebResourceRequest?
                        ): Boolean = !allowedAuthUrl(request?.url)
                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            if (request?.isForMainFrame == true) {
                                view?.post { currentFailure() }
                            }
                        }
                    }
                    val html = """
                     <!doctype html><html><head>
                     <meta name="viewport" content="width=device-width,initial-scale=1">
                     <style>body{background:#fff;margin:0;font:12px system-ui}
                       #widget{min-height:70px;display:flex;justify-content:center;padding:10px 0}</style>
                     </head><body><div id="widget"></div>
                     <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                         async defer></script>
                     <script>(function(){
                       var tries=0;
                       function mount(){
                         if(!window.turnstile || !window.turnstile.render){
                           if(++tries<80){setTimeout(mount,250);}else{NativeTurnstile.unavailable();}
                           return;
                         }
                         window.turnstile.render('#widget',{
                           sitekey:'SITE_KEY_PLACEHOLDER',action:'register',
                           size:'flexible',theme:'light',
                           callback:function(t){NativeTurnstile.verified(t)},
                           'expired-callback':function(){NativeTurnstile.invalid()},
                           'error-callback':function(){NativeTurnstile.unavailable()}
                         });
                       } mount();
                     })();</script></body></html>
                    """.trimIndent().replace("SITE_KEY_PLACEHOLDER", siteKey)
                    loadDataWithBaseURL("https://betvima.com/auth/register",
                        html, "text/html", "UTF-8", null)
                }
            },
            onRelease = {
                it.stopLoading()
                it.removeJavascriptInterface("NativeTurnstile")
                it.destroy()
            }
        )
    }
}

/**
 * Native Android sign-up. The only WebView in this flow displays Cloudflare's
 * verification widget; no BetVima website or registration page is ever embedded.
 * The user enters credentials exclusively into Compose components.
 */
@Composable
fun NativeRegistrationForm(lang: Lang, onSuccess: (Boolean) -> Unit, onLogin: () -> Unit) {
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }
    val uri = LocalUriHandler.current
    var configRevision by remember { mutableIntStateOf(0) }
    var siteKey by remember { mutableStateOf<String?>(null) }
    var configError by remember { mutableStateOf<String?>(null) }
    var email by rememberSaveable { mutableStateOf("") }
    // Credentials deliberately stay in memory, not SavedState or SharedPreferences.
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var currency by rememberSaveable { mutableStateOf("IRR") }
    var referral by rememberSaveable { mutableStateOf("") }
    var adult by rememberSaveable { mutableStateOf(false) }
    var terms by rememberSaveable { mutableStateOf(false) }
    var token by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var submitAttempted by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var challengeError by remember { mutableStateOf(false) }

    LaunchedEffect(configRevision) {
        configError = null
        siteKey = null
        token = null
        challengeError = false
        siteKey = try {
            publicTurnstileKey(api.get("/api/v1/mobile/config"))
                .also {
                    if (it == null) {
                        configError = tr(lang,
                            "Cloudflare verification is not configured on the server yet. Retry shortly.",
                            "کلید تأیید کلودفلر هنوز روی سرور فعال نشده است. کمی بعد دوباره تلاش کنید.")
                    }
                }
        } catch (_: Exception) {
            configError = tr(lang,
                "Unable to reach the security service. Check your internet connection.",
                "ارتباط با سرویس امنیتی برقرار نشد. اینترنت را بررسی کنید.")
            null
        }
    }

    val issue = signupValidation(email, password, confirmation, adult, terms)
    val dark = Color.White
    val edge = Palette.border
    val hint = Palette.muted
    val pale = Palette.muted
    val bright = Palette.text
    val green = Palette.green
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = bright,
        unfocusedTextColor = bright,
        cursorColor = Palette.blue,
        focusedContainerColor = dark,
        unfocusedContainerColor = dark,
        focusedBorderColor = Palette.blue,
        unfocusedBorderColor = edge,
        focusedLabelColor = Palette.blue,
        unfocusedLabelColor = hint,
        focusedLeadingIconColor = Palette.blue,
        unfocusedLeadingIconColor = hint,
        focusedTrailingIconColor = hint,
        unfocusedTrailingIconColor = hint
    )

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 1.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {

            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Color(0xFFEAF7F1),
                    border = BorderStroke(1.dp, green.copy(alpha = .22f)),
                    shape = RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.PersonAdd, null, tint = Palette.blue,
                        modifier = Modifier.padding(11.dp).size(21.dp))
                }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Create your account", "ساخت حساب کاربری"),
                        color = bright, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text(tr(lang, "One account for BetVima web and Android",
                        "یک حساب برای سایت و اپلیکیشن بت‌ویما"),
                        color = pale, fontSize = 11.sp)
                }
                Surface(color = Color(0xFFEAF7F1),
                    shape = RoundedCornerShape(9.dp)) {
                    Text("18+", color = green, fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp))
                }
            }
            HorizontalDivider(color = edge)

            Text(tr(lang, "ACCOUNT DETAILS", "مشخصات حساب"),
                color = Palette.muted, fontSize = 10.sp, letterSpacing = 1.sp,
                fontWeight = FontWeight.Black)
            OutlinedTextField(
                value = email,
                onValueChange = { email = it.trim().take(254); error = null },
                label = { Text(tr(lang, "Email address", "آدرس ایمیل")) },
                placeholder = { Text("name@example.com", color = hint) },
                leadingIcon = { Icon(Icons.Default.Email, null) },
                colors = fieldColors, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it.take(128); error = null },
                label = { Text(tr(lang, "Password", "رمز عبور")) },
                placeholder = { Text(tr(lang, "At least 8 characters", "حداقل ۸ کاراکتر"),
                    color = hint) },
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(if (showPassword) Icons.Default.VisibilityOff
                        else Icons.Default.Visibility, tr(lang, "Show password", "نمایش رمز"))
                    }
                },
                colors = fieldColors, singleLine = true,
                visualTransformation = if (showPassword)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = confirmation,
                onValueChange = { confirmation = it.take(128); error = null },
                label = { Text(tr(lang, "Confirm password", "تکرار رمز عبور")) },
                leadingIcon = { Icon(Icons.Default.LockReset, null) },
                colors = fieldColors, singleLine = true,
                visualTransformation = if (showPassword)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()
            )
            if (submitAttempted && issue in setOf("email", "password", "confirmation")) {
                Text(when (issue) {
                    "email" -> tr(lang, "Enter a valid email address.", "یک ایمیل معتبر وارد کنید.")
                    "password" -> tr(lang, "Password must contain 8–128 characters.",
                        "رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.")
                    else -> tr(lang, "Passwords do not match.", "رمز عبور و تکرار آن یکسان نیستند.")
                }, color = Palette.red, fontSize = 11.sp)
            }

            Text(tr(lang, "ACCOUNT CURRENCY", "ارز حساب"),
                color = pale, fontSize = 10.sp,
                fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("IRR", "USD", "EUR", "GBP").forEach { value ->
                    val selected = currency == value
                    Surface(
                        color = if (selected) Color(0xFFE6F8F0) else Color(0xFFF3F5F7),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(
                            if (selected) 1.5.dp else 1.dp,
                            if (selected) Palette.green else edge),
                        modifier = Modifier.weight(1f).heightIn(min = 45.dp)
                            .clickable { currency = value }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(value, color = if (selected) Palette.text else Palette.muted,
                                fontSize = 12.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
            OutlinedTextField(
                value = referral,
                onValueChange = {
                    referral = it.uppercase().filter { ch ->
                        ch in 'A'..'Z' || ch in '0'..'9' || ch == '_' || ch == '-'
                    }.take(64)
                },
                label = { Text(tr(lang, "Referral / gift code (optional)",
                    "کد معرف یا هدیه (اختیاری)")) },
                leadingIcon = { Icon(Icons.Default.CardGiftcard, null) },
                colors = fieldColors, singleLine = true,
                shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()
            )

            Surface(color = Color(0xFFF4F6F9), shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, edge)) {
                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = adult, onCheckedChange = { adult = it },
                            colors = CheckboxDefaults.colors(checkedColor = green))
                        Text(tr(lang, "I confirm that I am at least 18 years old.",
                            "تأیید می‌کنم حداقل ۱۸ سال سن دارم."),
                            color = pale, fontSize = 12.sp,
                            modifier = Modifier.weight(1f).clickable { adult = !adult })
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = terms, onCheckedChange = { terms = it },
                            colors = CheckboxDefaults.colors(checkedColor = green))
                        Text(tr(lang, "I accept the Terms and Privacy Policy.",
                            "شرایط و قوانین و سیاست حریم خصوصی را می‌پذیرم."),
                            color = pale, fontSize = 12.sp,
                            modifier = Modifier.weight(1f).clickable { terms = !terms })
                    }
                    Row {
                        TextButton(onClick = { uri.openUri("https://betvima.com/legal/terms") }) {
                            Text(tr(lang, "Terms", "شرایط استفاده"), color = Palette.blue, fontSize = 11.sp)
                        }
                        TextButton(onClick = { uri.openUri("https://betvima.com/legal/privacy") }) {
                            Text(tr(lang, "Privacy", "حریم خصوصی"), color = Palette.blue, fontSize = 11.sp)
                        }
                    }
                    if (submitAttempted && issue in setOf("age", "terms")) {
                        Text(tr(lang, "Confirm your age and accept the terms to continue.",
                            "برای ادامه سن و قوانین را تأیید کنید."),
                            color = Palette.red, fontSize = 11.sp)
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.VerifiedUser, null, tint = Palette.blue,
                    modifier = Modifier.size(19.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang, "CLOUDFLARE SECURITY", "تأیید امنیتی کلودفلر"),
                    color = bright, fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
            // The ONLY WebView in this screen is the Cloudflare challenge itself.
            // The rest of registration is native Compose and never loads site HTML.
            Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, edge),
                modifier = Modifier.fillMaxWidth()) {
                when {
                    siteKey == null && configError == null -> {
                        Column(Modifier.fillMaxWidth().padding(14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(Modifier.size(20.dp),
                                color = Palette.blue, strokeWidth = 2.dp)
                            Spacer(Modifier.height(8.dp))
                            Text(tr(lang, "Loading security challenge…",
                                "در حال دریافت تأیید امنیتی…"),
                                color = Color(0xFF61758A), fontSize = 11.sp)
                        }
                    }
                    siteKey.isNullOrBlank() -> {
                        Column(Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.WarningAmber, null, tint = Palette.red)
                                Spacer(Modifier.width(7.dp))
                                Text(configError ?: tr(lang, "Verification unavailable",
                                    "تأیید امنیتی در دسترس نیست"),
                                    fontSize = 11.sp, color = Palette.text,
                                    modifier = Modifier.weight(1f))
                            }
                            OutlinedButton(onClick = { configRevision++ }) {
                                Icon(Icons.Default.Refresh, null,
                                    modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(tr(lang, "Retry connection", "تلاش مجدد"))
                            }
                        }
                    }
                    else -> RealTurnstileWidget(
                        siteKey = siteKey!!,
                        revision = revision,
                        callback = { token = it; if (it != null) challengeError = false },
                        onFailure = { token = null; challengeError = true }
                    )
                }
            }
            if (challengeError) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ErrorOutline, null, tint = Palette.red,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(tr(lang, "Security challenge could not load. Refresh and try again.",
                        "چالش امنیتی بارگذاری نشد. تازه‌سازی کرده و دوباره تلاش کنید."),
                        color = Palette.red, fontSize = 11.sp, modifier = Modifier.weight(1f))
                }
            }
            if (token != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, tint = green,
                        modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(tr(lang, "Security verified", "تأیید امنیتی انجام شد"),
                        color = green, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }

            if (error != null) {
                Surface(color = Color(0xFFFFECEF), shape = RoundedCornerShape(12.dp)) {
                    Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ErrorOutline, null,
                            tint = Palette.red, modifier = Modifier.size(19.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(error.orEmpty(), color = Palette.red,
                            fontSize = 11.sp, modifier = Modifier.weight(1f))
                    }
                }
            }

            Button(onClick = {
                submitAttempted = true
                val currentToken = token ?: return@Button
                if (signupValidation(email, password, confirmation, adult, terms) != null) {
                    return@Button
                }
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val result = api.registerAccount(signupPayload(
                            email, password, currency, referral,
                            if (lang == Lang.FA) "fa" else "en", currentToken))
                        password = ""; confirmation = ""; token = null
                        onSuccess(result.optBoolean("emailConfirmationRequired", false))
                    } catch (ex: Exception) {
                        error = when ((ex as? ApiFailure)?.code) {
                            429 -> tr(lang, "Too many requests. Try again later.",
                                "تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید.")
                            400, 409, 422 -> ex.message ?: tr(lang, "Registration rejected.",
                                "درخواست ثبت‌نام پذیرفته نشد.")
                            503 -> tr(lang, "Registration or verification service unavailable.",
                                "سرویس ثبت‌نام یا تأیید امنیتی در دسترس نیست.")
                            else -> tr(lang, "Registration was not completed. Retry verification.",
                                "ثبت‌نام انجام نشد. تأیید امنیتی را مجدداً انجام دهید.")
                        }
                        token = null
                        revision++
                    } finally { busy = false }
                }
            }, enabled = !busy && token != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = green, contentColor = Color(0xFF03140D)),
                shape = RoundedCornerShape(15.dp),
                modifier = Modifier.fillMaxWidth().height(54.dp)) {
                if (busy) {
                    CircularProgressIndicator(Modifier.size(19.dp),
                        strokeWidth = 2.dp, color = Color(0xFF03140D))
                } else {
                    Icon(Icons.Default.PersonAdd, null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(9.dp))
                    Text(tr(lang, "CREATE MY ACCOUNT", "ساخت حساب کاربری"),
                        fontWeight = FontWeight.Black, fontSize = 14.sp)
                }
            }
            if (siteKey != null && !siteKey.isNullOrBlank()) {
                TextButton(onClick = { token = null; challengeError = false; revision++ },
                    modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text(tr(lang, "Refresh security challenge", "تازه‌سازی تأیید امنیتی"),
                        color = Palette.blue, fontSize = 11.sp)
                }
            }
            HorizontalDivider(color = edge)
            Row(verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(lang, "Already registered?", "قبلاً ثبت‌نام کرده‌اید؟"),
                    color = pale, fontSize = 11.sp)
                Spacer(Modifier.width(4.dp))
                TextButton(onClick = onLogin) {
                    Text(tr(lang, "Log in", "ورود به حساب"), color = Palette.blue,
                        fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}
