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
): JSONObject = JSONObject()
    .put("email", email.trim()).put("password", password)
    .put("currency", currency)
    .put("referralCode", referral.trim().uppercase().takeIf { it.isNotBlank() } ?: JSONObject.NULL)
    .put("ageConfirmed", true).put("acceptTerms", true)
    .put("locale", locale).put("turnstileToken", token)

/** No password or access token ever crosses the JavaScript bridge. */
private class TurnstileCallbacks(private val notify: (String?) -> Unit) {
    @JavascriptInterface fun verified(token: String) {
        if (token.length in 10..2048) notify(token)
    }
    @JavascriptInterface fun invalid() = notify(null)
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
private fun RealTurnstileWidget(siteKey: String, revision: Int, callback: (String?) -> Unit) {
    val context = LocalContext.current
    val currentCallback by rememberUpdatedState(callback)
    key(siteKey, revision) {
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(200.dp),
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
                    addJavascriptInterface(TurnstileCallbacks { received ->
                        post { currentCallback(received) }
                    }, "NativeTurnstile")
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?, request: WebResourceRequest?
                        ): Boolean = !allowedAuthUrl(request?.url)
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
                           if(++tries<80){setTimeout(mount,250);}else{NativeTurnstile.invalid();}
                           return;
                         }
                         window.turnstile.render('#widget',{
                           sitekey:'SITE_KEY_PLACEHOLDER',action:'register',
                           size:'flexible',theme:'light',
                           callback:function(t){NativeTurnstile.verified(t)},
                           'expired-callback':function(){NativeTurnstile.invalid()},
                           'error-callback':function(){NativeTurnstile.invalid()}
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

/** First-party in-app browser fallback when production mobile config lacks a public site key. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun VerifiedWebFallback() {
    val context = LocalContext.current
    AndroidView(
        modifier = Modifier.fillMaxWidth().height(570.dp),
        factory = {
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                webChromeClient = WebChromeClient()
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?, request: WebResourceRequest?
                    ): Boolean = !allowedAuthUrl(request?.url)
                }
                loadUrl("https://betvima.com/auth/register")
            }
        },
        onRelease = { it.stopLoading(); it.destroy() }
    )
}

@Composable
fun NativeRegistrationForm(lang: Lang, onSuccess: (Boolean) -> Unit, onLogin: () -> Unit) {
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }
    val uri = LocalUriHandler.current
    var siteKey by remember { mutableStateOf<String?>(null) }
    var forceWeb by remember { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
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
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        siteKey = runCatching {
            api.get("/api/v1/mobile/config").str("turnstileSiteKey")
                .takeIf { it.matches(Regex("[0-9A-Za-z_-]{10,160}")) }.orEmpty()
        }.getOrDefault("")
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(tr(lang, "Create your account", "ساخت حساب کاربری"),
            fontWeight = FontWeight.Black, fontSize = 23.sp, color = Palette.text)
        Text(tr(lang, "Register securely without leaving the app.",
            "ثبت‌نام امن بدون خروج از اپلیکیشن."),
            color = Palette.muted, fontSize = 12.sp)
        if (siteKey == null) {
            LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
        } else if (siteKey!!.isBlank() || forceWeb) {
            BvInformationStrip(tr(lang,
                "Official BetVima registration with Cloudflare verification is embedded below.",
                "فرم رسمی ثبت‌نام بت‌ویما با تأیید کلودفلر در همین قسمت باز شده است."),
                Icons.Default.VerifiedUser, accent = Palette.blue)
            VerifiedWebFallback()
            OutlinedButton(onClick = onLogin, modifier = Modifier.fillMaxWidth()) {
                Text(tr(lang, "Registered? Log in here", "ثبت‌نام کردی؟ از اینجا وارد شو"))
            }
        } else {
            OutlinedTextField(email, { email = it.trim().take(254) },
                label = { Text(tr(lang,"Email","ایمیل")) },
                leadingIcon = { Icon(Icons.Default.Email, null) },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                shape = RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(password, { password = it.take(128) },
                label = { Text(tr(lang,"Password (8+ characters)","رمز عبور (حداقل ۸ کاراکتر)")) },
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(if (showPassword) Icons.Default.VisibilityOff
                            else Icons.Default.Visibility, null)
                    }
                }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                shape = RoundedCornerShape(14.dp),
                visualTransformation = if (showPassword)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            OutlinedTextField(confirmation, { confirmation = it.take(128) },
                label = { Text(tr(lang,"Confirm password","تکرار رمز عبور")) },
                leadingIcon = { Icon(Icons.Default.LockReset, null) },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
                shape = RoundedCornerShape(14.dp),
                visualTransformation = if (showPassword)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            Text(tr(lang,"Account currency","ارز حساب"),
                color = Palette.text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("IRR","USD","EUR","GBP").forEach { item ->
                    Surface(color = if (currency == item) Palette.ink else Palette.paper,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, if (currency == item)
                            Palette.green else Palette.border),
                        modifier = Modifier.weight(1f).height(43.dp)
                            .clickable { currency = item }) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(item, color = if (currency == item) Color.White
                                else Palette.text, fontSize = 12.sp,
                                fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
            OutlinedTextField(referral, {
                    referral = it.uppercase().filter { ch ->
                        ch in 'A'..'Z' || ch in '0'..'9' || ch == '-' || ch == '_'
                    }.take(64)
                },
                label = { Text(tr(lang,"Referral or gift code (optional)",
                    "کد معرف یا هدیه (اختیاری)")) },
                leadingIcon = { Icon(Icons.Default.CardGiftcard,null) },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp))
            Surface(color = Palette.paper, shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.fillMaxWidth().padding(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(adult, { adult = it },
                            colors = CheckboxDefaults.colors(checkedColor = Palette.green))
                        Text(tr(lang,"I confirm I am 18 or older.",
                            "تأیید می‌کنم ۱۸ سال یا بیشتر دارم."),
                            modifier = Modifier.weight(1f).clickable { adult = !adult },
                            color = Palette.text, fontSize = 12.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(terms, { terms = it },
                            colors = CheckboxDefaults.colors(checkedColor = Palette.green))
                        Text(tr(lang,"I agree to the Terms and Privacy Policy.",
                            "شرایط و قوانین و حریم خصوصی را می‌پذیرم."),
                            modifier = Modifier.weight(1f).clickable { terms = !terms },
                            color = Palette.text, fontSize = 12.sp)
                    }
                    Row {
                        TextButton(onClick = { uri.openUri("https://betvima.com/legal/terms") }) {
                            Text(tr(lang,"Terms","قوانین"),fontSize=11.sp,color=Palette.blue)
                        }
                        TextButton(onClick = { uri.openUri("https://betvima.com/legal/privacy") }) {
                            Text(tr(lang,"Privacy","حریم خصوصی"),
                                fontSize=11.sp,color=Palette.blue)
                        }
                    }
                }
            }
            Text(tr(lang,"Cloudflare security verification","تأیید امنیتی کلودفلر"),
                color=Palette.text,fontWeight=FontWeight.Bold,fontSize=12.sp)
            Surface(color=Color.White,shape=RoundedCornerShape(15.dp),
                border=BorderStroke(1.dp,Palette.border)) {
                RealTurnstileWidget(siteKey!!,revision) { token = it }
            }
            if(token!=null) Text(tr(lang,"Verified","تأیید انجام شد"),
                color=Palette.green,fontWeight=FontWeight.Bold,fontSize=12.sp)
            if(error!=null) BvInformationStrip(error.orEmpty(),Icons.Default.WarningAmber,
                accent=Palette.red)
            Button(onClick = {
                val t = token ?: return@Button
                scope.launch {
                    busy=true;error=null
                    try {
                        val result=api.registerAccount(signupPayload(email,password,currency,
                            referral,if(lang==Lang.FA)"fa" else "en",t))
                        token=null;password="";confirmation=""
                        onSuccess(result.optBoolean("emailConfirmationRequired",false))
                    } catch(ex:Exception) {
                        error=when((ex as? ApiFailure)?.code) {
                            429 -> tr(lang,"Too many attempts. Try again later.",
                                "تلاش بیش از حد مجاز؛ کمی بعد امتحان کنید.")
                            400,409,422 -> ex.message ?: tr(lang,"Registration rejected","ثبت‌نام رد شد")
                            else -> tr(lang,"Registration failed. Retry the security check.",
                                "ثبت‌نام انجام نشد؛ تأیید امنیتی را تکرار کنید.")
                        }
                        token=null;revision++
                    } finally {busy=false}
                }
            },enabled=!busy && token!=null &&
                signupValidation(email,password,confirmation,adult,terms)==null,
                modifier=Modifier.fillMaxWidth().height(53.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Palette.green,
                    contentColor=Palette.ink),shape=RoundedCornerShape(13.dp)) {
                if(busy) CircularProgressIndicator(Modifier.size(19.dp),
                    color=Palette.ink,strokeWidth=2.dp)
                else {
                    Icon(Icons.Default.PersonAdd,null)
                    Spacer(Modifier.width(7.dp))
                    Text(tr(lang,"Create secure account","ساخت حساب امن"),
                        fontWeight=FontWeight.Black)
                }
            }
            TextButton(onClick={token=null;revision++},
                modifier=Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(lang,"Retry verification","تأیید مجدد"),
                    color=Palette.blue,fontSize=12.sp)
            }
            TextButton(onClick={forceWeb=true},
                modifier=Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(lang,"Use verified website form inside the app",
                    "استفاده از فرم رسمی سایت داخل اپ"),
                    color=Palette.muted,fontSize=11.sp)
            }
        }
    }
}
