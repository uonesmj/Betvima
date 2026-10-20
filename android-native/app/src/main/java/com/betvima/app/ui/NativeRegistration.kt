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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.betvima.app.BuildConfig
import com.betvima.app.data.ApiClient
import com.betvima.app.data.ApiFailure
import com.betvima.app.data.str
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
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
internal val registrationCurrencies = listOf("USD", "IRR")
/** Accept an affiliate code or a BetVima invite URL without trusting link text. */
internal fun normalizeSignupReferral(raw: String): String {
    val input=raw.trim()
    val code=Regex("(?:[?&](?:ref|referral|referralCode|gift|code)=)([A-Za-z0-9_-]{3,64})",
        RegexOption.IGNORE_CASE).find(input)?.groupValues?.get(1) ?: input
    return code.trim().uppercase().filter { it in 'A'..'Z' || it in '0'..'9' || it=='-' || it=='_' }
        .take(64)
}
internal fun referralCodeWellFormed(value:String):Boolean =
    value.isEmpty() || Regex("^[A-Z0-9_-]{3,64}$").matches(value)


internal fun signupPayload(
    email: String, password: String, currency: String, referral: String,
    locale: String, token: String
): JSONObject = JSONObject().apply {
    require(currency in registrationCurrencies) { "Unsupported signup currency" }
    require(referralCodeWellFormed(normalizeSignupReferral(referral))) { "Invalid referral code" }
    put("email", email.trim())
    put("password", password)
    put("currency", currency)
    // API zod schema accepts an optional string, not an explicit JSON null.
    normalizeSignupReferral(referral).takeIf { it.isNotBlank() }
        ?.let { put("referralCode", it) }
    put("ageConfirmed", true)
    put("acceptTerms", true)
    put("locale", locale)
    put("turnstileToken", token)
}

/** The mobile client unwraps server responses; tolerate a wrapped test response too. */
internal fun postSignupLoginEnabled(completed: Boolean, password: String, busy: Boolean): Boolean =
    completed && password.isNotBlank() && !busy

internal fun publicTurnstileKey(config: JSONObject): String? {
    val fields = config.optJSONObject("data") ?: config
    return fields.optString("turnstileSiteKey").trim()
        .takeIf { it.matches(Regex("[0-9A-Za-z_-]{10,160}")) }
}

/** No password or access token ever crosses the JavaScript bridge. */
private class TurnstileCallbacks(
    private val notify: (String?) -> Unit,
    private val failure: () -> Unit,
    private val ready: () -> Unit,
    private val resize: (Int) -> Unit
) {
    @JavascriptInterface fun verified(token: String) {
        if (token.length in 10..2048) notify(token) else failure()
    }
    @JavascriptInterface fun invalid() = notify(null)
    @JavascriptInterface fun unavailable() = failure()
    @JavascriptInterface fun mounted() = ready()
    @JavascriptInterface fun measured(height: Int) = resize(height)
}

private fun allowedAuthUrl(url: Uri?): Boolean {
    if (url?.scheme == "about" && url.schemeSpecificPart in setOf("blank", "srcdoc"))
        return true
    if (url?.scheme != "https") return false
    val host = url.host?.lowercase() ?: return false
    return host == "betvima.com" || host == "www.betvima.com" ||
        host == "challenges.cloudflare.com" || host.endsWith(".challenges.cloudflare.com")
}

/** The only WebView in registration is the real Cloudflare widget, not the website. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
internal fun RealTurnstileWidget(
    siteKey: String,
    revision: Int,
    action: String = "register",
    callback: (String?) -> Unit,
    onReady: () -> Unit,
    onFailure: () -> Unit
) {
    val context = LocalContext.current
    val currentCallback by rememberUpdatedState(callback)
    val currentReady by rememberUpdatedState(onReady)
    val currentFailure by rememberUpdatedState(onFailure)
    // A regular Turnstile widget is ~65 CSS pixels high. Allow the actual
    // Cloudflare challenge to expand dynamically instead of cropping it.
    var challengeHeight by remember(siteKey, revision) { mutableIntStateOf(86) }
    require(action in setOf("register", "forgot-password"))
    key(siteKey, revision, action) {
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(challengeHeight.dp),
            factory = {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    // Respect HTTP caching rather than forcing the Turnstile script
                    // to download again on each security challenge refresh.
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    setBackgroundColor(android.graphics.Color.WHITE)
                    addJavascriptInterface(
                        TurnstileCallbacks(
                            notify = { value -> post { currentCallback(value) } },
                            ready = { post { currentReady() } },
                            failure = { post { currentFailure() } },
                            resize = { cssHeight -> post {
                                challengeHeight = cssHeight.coerceIn(76, 350)
                            } }
                        ), "NativeTurnstile"
                    )
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?, request: WebResourceRequest?
                        ): Boolean = !allowedAuthUrl(request?.url)
                        override fun onReceivedError(
                            view: WebView?, request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            if (request?.isForMainFrame == true)
                                view?.post { currentFailure() }
                        }
                    }
                    // Explicit onload avoids the former 80 x 250ms JS polling
                    // loop. An 12s fallback produces a visible retry rather than
                    // leaving a blank widget indefinitely.
                    val html = """
                        <!doctype html><html><head>
                        <meta name="viewport" content="width=device-width,initial-scale=1">
                        <style>
                          html,body{background:#fff;margin:0;padding:0;width:100%;overflow:hidden;}
                          #widget{width:100%;min-height:65px;display:flex;align-items:flex-start;justify-content:center;}
                          iframe{max-width:100%;}
                        </style></head><body><div id="widget"></div>
                        <script>
                          (function(){
                            var mounted=false;
                            function measure(){
                              var node=document.getElementById('widget');
                              if(node) NativeTurnstile.measured(Math.ceil(node.getBoundingClientRect().height)+8);
                            }
                            window.mountBetvimaChallenge=function(){
                              if(mounted)return;
                              try {
                                if(!window.turnstile || !window.turnstile.render)throw Error('not_ready');
                                window.turnstile.render('#widget',{
                                  sitekey:'SITE_KEY_PLACEHOLDER',
                                  action:'ACTION_PLACEHOLDER',size:'flexible',theme:'light',
                                  appearance:'always',
                                  callback:function(token){NativeTurnstile.verified(token)},
                                  'expired-callback':function(){NativeTurnstile.invalid()},
                                  'error-callback':function(){NativeTurnstile.unavailable()}
                                });
                                mounted=true;
                                NativeTurnstile.mounted();
                                if(window.ResizeObserver){
                                  new ResizeObserver(measure).observe(document.getElementById('widget'));
                                }
                                requestAnimationFrame(measure);
                              } catch(e) { NativeTurnstile.unavailable(); }
                            };
                            window.setTimeout(function(){
                              if(!mounted)NativeTurnstile.unavailable();
                            },12000);
                          })();
                        </script>
                        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&amp;onload=mountBetvimaChallenge"
                                async defer onerror="NativeTurnstile.unavailable()"></script>
                        </body></html>
                    """.trimIndent().replace("SITE_KEY_PLACEHOLDER", siteKey)
                        .replace("ACTION_PLACEHOLDER", action)
                    loadDataWithBaseURL(
                        "https://betvima.com/auth/register", html, "text/html", "UTF-8", null
                    )
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
fun NativeRegistrationForm(
    lang: Lang,
    loginBusy: Boolean,
    onSignIn: (String, String) -> Unit,
    onLogin: () -> Unit
) {
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
    var currencyMenuOpen by rememberSaveable { mutableStateOf(false) }
    // Partner APKs carry referral identity in BuildConfig, never in the gift input.
    val embeddedPartnerCode = remember {
        NativeAffiliateAttribution120.embeddedCode(BuildConfig.AFFILIATE_REFERRAL_CODE)
    }
    val partnerInstall = embeddedPartnerCode.isNotBlank()
    var referral by rememberSaveable { mutableStateOf("") }
    val effectiveReferral = NativeAffiliateAttribution120.registrationCode(
        embeddedPartnerCode, referral)

    var referralCheck by remember { mutableStateOf("empty") }
    var referralApplied by rememberSaveable { mutableStateOf<Boolean?>(null) }
    var adult by rememberSaveable { mutableStateOf(false) }
    var terms by rememberSaveable { mutableStateOf(false) }
    var token by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var submitAttempted by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var challengeError by remember { mutableStateOf(false) }
    var challengeReady by remember { mutableStateOf(false) }
    // A successful registration is remembered across rotation, but never the password.
    // Password is retained in volatile memory only for the explicit "Log in" action.
    var registrationCompleted by rememberSaveable { mutableStateOf(false) }
    var emailConfirmationRequired by rememberSaveable { mutableStateOf(false) }
    var revealNewPassword by remember { mutableStateOf(false) }

    LaunchedEffect(configRevision) {
        configError = null
        siteKey = null
        token = null
        challengeError = false
        challengeReady = false
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

    LaunchedEffect(effectiveReferral,registrationCompleted) {
        referralCheck = if(effectiveReferral.isBlank()) "empty" else "checking"
        if(effectiveReferral.isBlank() || registrationCompleted) return@LaunchedEffect
        delay(550)
        val code=effectiveReferral
        referralCheck = if (!referralCodeWellFormed(code)) "invalid"
        else try {
            if(api.validateReferralCode(code)) "verified" else "invalid"
        } catch (_:Exception) { "unavailable" }
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

    if (registrationCompleted) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = Color.White,
            border = BorderStroke(1.dp, Palette.border),
            shadowElevation = 2.dp
        ) {
            Column(
                Modifier.fillMaxWidth().padding(19.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    color = Color(0xFFE8F8EF),
                    shape = RoundedCornerShape(23.dp),
                    border = BorderStroke(1.dp, Palette.green.copy(alpha = .24f))
                ) {
                    Icon(
                        Icons.Default.CheckCircle, null, tint = Palette.green,
                        modifier = Modifier.padding(17.dp).size(35.dp)
                    )
                }
                Text(
                    tr(lang, "Account created successfully!", "حساب کاربری شما با موفقیت ساخته شد!"),
                    color = Palette.text, fontSize = 19.sp, fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center
                )
                Text(
                    tr(lang,
                        "Your BetVima sign-in information is below. Use the same account on Android and the website.",
                        "مشخصات ورود به حساب بت‌ویما در ادامه نمایش داده شده است. همین حساب در اپلیکیشن و سایت قابل استفاده است."),
                    color = Palette.muted, fontSize = 12.sp,
                    textAlign = TextAlign.Center, lineHeight = 19.sp
                )
                Surface(
                    color = Color(0xFFF5F7FA),
                    border = BorderStroke(1.dp, Palette.border),
                    shape = RoundedCornerShape(17.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(11.dp)
                    ) {
                        Text(
                            tr(lang, "YOUR SIGN-IN DETAILS", "مشخصات ورود شما"),
                            color = Palette.muted, fontSize = 10.sp,
                            letterSpacing = 1.sp, fontWeight = FontWeight.Black
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Email, null, tint = Palette.blue,
                                modifier = Modifier.size(19.dp))
                            Spacer(Modifier.width(9.dp))
                            Column(Modifier.weight(1f)) {
                                Text(tr(lang, "Email", "ایمیل"), color = Palette.muted, fontSize = 11.sp)
                                Text(email.trim(), color = Palette.text,
                                    fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        HorizontalDivider(color = Palette.border)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Lock, null, tint = Palette.blue,
                                modifier = Modifier.size(19.dp))
                            Spacer(Modifier.width(9.dp))
                            Column(Modifier.weight(1f)) {
                                Text(tr(lang, "Password", "رمز عبور"),
                                    color = Palette.muted, fontSize = 11.sp)
                                Text(
                                    if (password.isBlank()) tr(lang, "Re-enter at login", "در صفحه ورود دوباره وارد کنید")
                                    else if (revealNewPassword) password else "••••••••••",
                                    color = Palette.text, fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            if (password.isNotEmpty()) {
                                IconButton(onClick = { revealNewPassword = !revealNewPassword }) {
                                    Icon(
                                        if (revealNewPassword) Icons.Default.VisibilityOff
                                        else Icons.Default.Visibility,
                                        tr(lang, "Show or hide password", "نمایش یا پنهان‌کردن رمز"),
                                        tint = Palette.blue
                                    )
                                }
                            }
                        }
                        HorizontalDivider(color = Palette.border)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AccountBalanceWallet, null,
                                tint = Palette.blue, modifier = Modifier.size(19.dp))
                            Spacer(Modifier.width(9.dp))
                            Text(tr(lang, "Account currency", "ارز حساب"),
                                color = Palette.muted, fontSize = 12.sp)
                            Spacer(Modifier.weight(1f))
                            Text(currency, color = Palette.text, fontSize = 13.sp,
                                fontWeight = FontWeight.Black)
                        }
                    }
                }
                Surface(
                    color = if (emailConfirmationRequired) Color(0xFFFFF8E8)
                        else Color(0xFFEAF8F1),
                    shape = RoundedCornerShape(13.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (emailConfirmationRequired) Icons.Default.MarkEmailUnread
                            else Icons.Default.VerifiedUser,
                            null, tint = if (emailConfirmationRequired) Color(0xFF906000)
                                else Palette.green,
                            modifier = Modifier.size(21.dp)
                        )
                        Spacer(Modifier.width(9.dp))
                        Text(
                            if (emailConfirmationRequired)
                                tr(lang, "Verify your email first. Then tap Log in to enter your account.",
                                    "ابتدا لینک تأیید ارسال‌شده به ایمیل را باز کنید، سپس برای ورود روی دکمه زیر بزنید.")
                            else tr(lang, "Ready! Tap Log in to enter your account and open the home page.",
                                "حساب آماده است! برای ورود و رفتن به صفحه اصلی، دکمه زیر را بزنید."),
                            color = Palette.text, fontSize = 12.sp, lineHeight = 18.sp
                        )
                    }
                }
                Button(
                    onClick = { onSignIn(email.trim(), password) },
                    enabled = postSignupLoginEnabled(registrationCompleted, password, loginBusy),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Palette.green, contentColor = Color(0xFF03140D)),
                    shape = RoundedCornerShape(15.dp),
                    modifier = Modifier.fillMaxWidth().height(54.dp)
                ) {
                    if (loginBusy) {
                        CircularProgressIndicator(Modifier.size(19.dp),
                            strokeWidth = 2.dp, color = Color(0xFF03140D))
                    } else {
                        Icon(Icons.Default.Login, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(9.dp))
                        Text(tr(lang, "LOG IN TO BETVIMA", "ورود به بت‌ویما"),
                            fontWeight = FontWeight.Black, fontSize = 14.sp)
                    }
                }
                OutlinedButton(
                    onClick = onLogin,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(13.dp)
                ) {
                    Text(tr(lang, "Enter credentials manually", "ورود دستی با مشخصات حساب"),
                        fontWeight = FontWeight.Bold, color = Palette.blue)
                }
                Text(
                    tr(lang,
                        "Your password is not saved by this page. Keep it private.",
                        "رمز عبور در این صفحه ذخیره دائمی نمی‌شود؛ آن را محرمانه نگه دارید."),
                    color = Palette.muted, fontSize = 10.sp, textAlign = TextAlign.Center
                )
            }
        }
    } else {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 1.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp)) {

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

            // One compact anchored popup, with the two currencies supported by
            // the native sign-up experience. Never show EUR/GBP here.
            Box(Modifier.fillMaxWidth()) {
                Surface(
                    color = Color(0xFFF7F9FB),
                    shape = RoundedCornerShape(13.dp),
                    border = BorderStroke(1.dp, edge),
                    modifier = Modifier.fillMaxWidth().height(51.dp)
                        .clickable { currencyMenuOpen = true }
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 13.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Payments, null, tint = Palette.blue,
                            modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang, "Account currency", "ارز حساب"),
                                color = Palette.muted, fontSize = 10.sp)
                            Text(
                                if (currency == "USD")
                                    tr(lang, "US Dollar (USD)", "دلار آمریکا (USD)")
                                else tr(lang, "Iranian Rial (IRR)", "ریال ایران (IRR)"),
                                color = Palette.text, fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Icon(Icons.Default.KeyboardArrowDown, null, tint = Palette.blue)
                    }
                }
                DropdownMenu(
                    expanded = currencyMenuOpen,
                    onDismissRequest = { currencyMenuOpen = false },
                    modifier = Modifier.background(Color.White)
                ) {
                    registrationCurrencies.forEach { value ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(
                                        if (value == "USD") tr(lang, "US Dollar", "دلار آمریکا")
                                        else tr(lang, "Iranian Rial", "ریال ایران"),
                                        fontWeight = FontWeight.Bold, color = Palette.text
                                    )
                                    Text(value, fontSize = 11.sp, color = Palette.muted)
                                }
                            },
                            leadingIcon = {
                                Icon(Icons.Default.AccountBalanceWallet, null,
                                    tint = if (currency == value) Palette.green else Palette.blue)
                            },
                            trailingIcon = {
                                if (currency == value)
                                    Icon(Icons.Default.CheckCircle, null, tint = Palette.green)
                            },
                            onClick = { currency = value; currencyMenuOpen = false }
                        )
                    }
                }
            }
            if (partnerInstall) {
                Surface(
                    color = Color(0xFFE8F8EF),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Palette.green.copy(alpha = .30f))
                ) {
                    Row(Modifier.fillMaxWidth().padding(13.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VerifiedUser, null, tint = Palette.green,
                            modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang,"Partner invitation linked automatically",
                                "دعوت همکار به‌صورت خودکار متصل است"),
                                color = Palette.text,fontSize=12.sp,fontWeight=FontWeight.Bold)
                            Text(tr(lang,"No referral code is required in a gift field.",
                                "نیازی به واردکردن کد معرف در قسمت هدیه نیست."),
                                color=Palette.muted,fontSize=10.sp)
                        }
                    }
                }
                if(referralCheck == "invalid" || referralCheck == "unavailable") {
                    Text(tr(lang,
                        "Partner attribution cannot be verified. Check your connection and retry.",
                        "تأیید معرف ممکن نیست؛ اتصال را بررسی و دوباره تلاش کنید."),
                        color=Palette.red,fontSize=11.sp)
                }
            } else {
                OutlinedTextField(
                    value = referral,
                    onValueChange = { referral=normalizeSignupReferral(it) },
                    label = { Text(tr(lang, "Referral / gift code (optional)",
                        "کد معرف یا هدیه (اختیاری)")) },
                    leadingIcon = { Icon(Icons.Default.CardGiftcard, null) },
                    colors = fieldColors, singleLine = true,
                    shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()
                )
    
                if(referral.isNotBlank()) {
                    Row(Modifier.fillMaxWidth().padding(horizontal=5.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Icon(
                            when(referralCheck) {
                                "verified" -> Icons.Default.Verified
                                "invalid" -> Icons.Default.ErrorOutline
                                else -> Icons.Default.Info
                            },null,
                            tint=when(referralCheck) {
                                "verified" -> Palette.green
                                "invalid" -> Palette.red
                                else -> Palette.muted
                            },modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(when(referralCheck) {
                            "verified" -> tr(lang,"Referral code verified. Attribution is completed by the server.",
                                "کد معرف معتبر است؛ ثبت نهایی معرفی توسط سرور انجام می‌شود.")
                            "invalid" -> tr(lang,"Invalid or inactive referral code.",
                                "کد معرف معتبر یا فعال نیست.")
                            "unavailable" -> tr(lang,"Referral verification unavailable. Retry before registering.",
                                "اعتبارسنجی کد در دسترس نیست؛ قبل از ثبت‌نام دوباره تلاش کنید.")
                            else -> tr(lang,"Checking referral code…","در حال بررسی کد معرف…")
                        },fontSize=11.sp,color=when(referralCheck){
                            "verified" -> Palette.green
                            "invalid" -> Palette.red
                            else -> Palette.muted
                        },modifier=Modifier.weight(1f))
                    }
                }
    
            }

            Surface(color = Color(0xFFF4F6F9), shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, edge)) {
                Column(Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(0.dp)) {
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

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Shield, null, tint = Palette.blue,
                    modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang, "I'm not a robot · Cloudflare", "من ربات نیستم · کلودفلر"),
                    color = bright, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f))
                if (challengeError) {
                    TextButton(onClick = {
                        token = null
                        challengeError = false
                        challengeReady = false
                        revision++
                    }) {
                        Icon(Icons.Default.Refresh, null, tint = Palette.blue,
                            modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(2.dp))
                        Text(tr(lang, "Retry", "تلاش مجدد"),
                            color = Palette.blue, fontSize = 11.sp)
                    }
                }
            }
            // The ONLY WebView in this screen is the Cloudflare challenge itself.
            // The rest of registration is native Compose and never loads site HTML.
            Surface(color = Color.White, shape = RoundedCornerShape(12.dp),
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
                    else -> Column(
                        Modifier.fillMaxWidth().padding(horizontal = 5.dp, vertical = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (!challengeReady && !challengeError) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                CircularProgressIndicator(Modifier.size(13.dp),
                                    color = Palette.blue, strokeWidth = 1.5.dp)
                                Spacer(Modifier.width(6.dp))
                                Text(tr(lang, "Connecting securely…", "در حال اتصال امن…"),
                                    color = Palette.muted, fontSize = 10.sp)
                            }
                        }
                        RealTurnstileWidget(
                            siteKey = siteKey!!,
                            revision = revision,
                            callback = {
                                token = it
                                challengeError = it == null
                            },
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
                        val code=effectiveReferral
                        if(code.isNotBlank() &&
                           (!referralCodeWellFormed(code) || !api.validateReferralCode(code))) {
                            referralCheck="invalid"
                            error=tr(lang,"This referral code cannot be used. Correct it or leave it empty.",
                                "این کد معرف قابل استفاده نیست؛ اصلاحش کنید یا خالی بگذارید.")
                            return@launch
                        }
                        val result = api.registerAccount(signupPayload(
                            email, password, currency, effectiveReferral,
                            if (lang == Lang.FA) "fa" else "en", currentToken))
                        // Preserve the user-entered password only in volatile memory,
                        // so the explicit login button can use the same credentials.
                        emailConfirmationRequired = result.optBoolean("emailConfirmationRequired", false)
                        referralApplied = if(effectiveReferral.isBlank()) null
                            else result.optBoolean("attributionFromCookie",false)
                        registrationCompleted = true
                        confirmation = ""
                        showPassword = false
                        revealNewPassword = false
                        token = null
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
                        challengeReady = false
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
}
