package com.betvima.app.ui

import android.graphics.Bitmap
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ClipDescription
import android.os.Build
import android.os.PersistableBundle
import androidx.compose.ui.platform.LocalContext
import com.betvima.app.data.AuthenticatorFactor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.ApiClient
import com.betvima.app.data.SessionVault
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Device-local view of Supabase-authenticated TOTP. QR secrets are memory-only.
 * No Android-generated secrets, no OTP validation in the app, no bypass of the server.
 */
@Composable
internal fun GoogleAuthenticatorDialog(
    lang: Lang,
    api: ApiClient,
    vault: SessionVault,
    adminRequired: Boolean,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var factorId by remember { mutableStateOf<String?>(null) }
    var verifiedFactors by remember { mutableStateOf<List<AuthenticatorFactor>>(emptyList()) }
    var enrollingBackup by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf<JSONObject?>(null) }
    var code by remember { mutableStateOf("") }
    var disableRequested by remember { mutableStateOf(false) }
    var confirmDisableOpen by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    fun l(en: String, fa: String) = tr(lang, en, fa)
    LaunchedEffect(Unit) {
        try {
            val jwt = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            verifiedFactors = api.mfaAllTotpFactors(jwt).filter { it.verified }
            factorId = verifiedFactors.firstOrNull()?.id
        } catch (ex: Exception) { error = ex.message ?: "Authenticator unavailable" }
        finally { loading = false }
    }
    fun action(block: suspend () -> Unit) {
        scope.launch {
            busy = true
            error = ""
            message = ""
            try { block() }
            catch (ex: Exception) {
                error = ex.message ?: l("Unable to verify authenticator", "خطا در بررسی کد")
            } finally { busy = false }
        }
    }
    val otpUri = pending?.optJSONObject("totp")?.optString("uri").orEmpty()
    val qr = remember(otpUri) {
        if (!otpUri.startsWith("otpauth://totp/")) null else runCatching {
            val bits = QRCodeWriter().encode(otpUri, BarcodeFormat.QR_CODE, 280, 280)
            val bmp = Bitmap.createBitmap(280, 280, Bitmap.Config.ARGB_8888)
            for (y in 0 until 280) for (x in 0 until 280)
                bmp.setPixel(x, y, if (bits[x,y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            bmp.asImageBitmap()
        }.getOrNull()
    }
    if (confirmDisableOpen) {
        AlertDialog(
            onDismissRequest = { confirmDisableOpen = false },
            containerColor = Color(0xFF202127),
            shape = RoundedCornerShape(20.dp),
            title = {
                Text(l("Confirm authenticator removal", "تأیید حذف Authenticator"),
                    color = Color.White, fontWeight = FontWeight.Bold)
            },
            text = {
                Text(
                    if (adminRequired && verifiedFactors.size == 1)
                        l("Removing your last authenticator will immediately suspend all administrative access until you set up and verify a new authenticator. Your account and funds will remain intact. You must enter a fresh six-digit code to continue.",
                          "با حذف آخرین Authenticator، دسترسی مدیریتی تا فعال‌سازی و تأیید دوباره عامل دوم متوقف می‌شود. حساب و موجودی شما تغییری نمی‌کند. برای ادامه کد شش‌رقمی جدید لازم است.")
                    else l("Removing this authenticator requires a new six-digit code from the selected device.",
                        "برای حذف این Authenticator باید کد شش‌رقمی جدید دستگاه انتخاب‌شده را وارد کنید."),
                    color = Color(0xFFE1E4ED), fontSize = 13.sp, lineHeight = 20.sp
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDisableOpen = false
                    code = ""
                    disableRequested = true
                }) {
                    Text(l("Continue to verification", "ادامه و تأیید کد"),
                        color = Color(0xFFFFAFAF))
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDisableOpen = false }) {
                    Text(l("Cancel", "انصراف"), color = Color.White)
                }
            }
        )
    }
    AlertDialog(
        onDismissRequest = { if (!busy && !confirmDisableOpen) onDismiss() },
        containerColor = Color(0xFF202127),
        shape = RoundedCornerShape(23.dp),
        title = { Text("Google Authenticator", color = Color.White, fontWeight = FontWeight.Black) },
        text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 530.dp)
                .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                else if (pending != null) {
                    Text(l("Scan the QR code or enter the secret manually. Then confirm a six-digit code.",
                        "کد QR را اسکن کنید یا کلید را دستی وارد کنید؛ سپس کد شش‌رقمی را تأیید کنید."),
                        fontSize = 12.sp, color = Color(0xFFCFD3DD))
                    qr?.let {
                        Image(it, "Authenticator setup QR",
                            modifier = Modifier.align(Alignment.CenterHorizontally).size(200.dp)
                                .background(Color.White).padding(7.dp))
                    }
                    val secret = pending?.optJSONObject("totp")?.optString("secret").orEmpty()
                    if (secret.isNotBlank()) {
                        Surface(
                            color = Color(0xFF151B28),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Text(secret, fontSize = 13.sp,
                                    color = Color(0xFFB8D7FF),
                                    fontWeight = FontWeight.Bold)
                                TextButton(onClick = {
                                    val clipboard = context.getSystemService(
                                        Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    val clip = ClipData.newPlainText(
                                        "BetVima Authenticator setup key", secret)
                                    if (Build.VERSION.SDK_INT >= 33) {
                                        clip.description.extras = PersistableBundle().apply {
                                            putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                                        }
                                    }
                                    clipboard.setPrimaryClip(clip)
                                    message = l("Setup key copied. Keep it private.",
                                        "کلید کپی شد؛ آن را محرمانه نگه دارید.")
                                }, modifier = Modifier.align(Alignment.End)) {
                                    Text(l("Copy setup key", "کپی کلید راه‌اندازی"))
                                }
                            }
                        }
                    }
                } else if (factorId == null) {
                    Text(l("Optional for members, mandatory for administrators.",
                        "برای کاربران اختیاری و برای مدیران اجباری است."),
                        color = Color(0xFFC5CBDA), fontSize = 12.sp)
                    Button(onClick = {
                        action {
                            val jwt = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
                            pending = api.mfaEnroll(jwt)
                        }
                    }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Text(l("Set up authenticator", "فعال‌سازی Authenticator"))
                    }
                } else {
                    Text(l(
                        "Recovery codes are not issued by Supabase. Set up a backup authenticator on another device so you can still sign in if this phone is lost.",
                        "Supabase کد بازیابی صادر نمی‌کند. برای زمانی که گوشی را از دست می‌دهید، Authenticator پشتیبان را روی دستگاه دیگری فعال کنید."
                    ), color = Color(0xFFC5CBDA), fontSize = 12.sp)
                    if (verifiedFactors.size > 1) {
                        Text(l("Backup authenticator is active (" + verifiedFactors.size + " devices).",
                            "برنامه امنیتی پشتیبان فعال است (" + verifiedFactors.size + " دستگاه)."),
                            color = Color(0xFF86E9BF), fontSize = 12.sp)
                    } else {
                        Button(
                            onClick = {
                                action {
                                    val jwt = vault.accessToken(api)
                                        ?: throw IllegalStateException("Sign in required")
                                    // Preserve verified factors; only abandon an incomplete
                                    // factor with this exact friendly name.
                                    pending = api.mfaEnroll(jwt, backup = true)
                                    enrollingBackup = true
                                    code = ""
                                }
                            },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(l("Add backup authenticator",
                                "افزودن Authenticator پشتیبان"))
                        }
                    }
                    if (!disableRequested) {
                        if (verifiedFactors.size > 1) {
                            Text(l("Select which authenticator to remove:",
                                "برنامه موردنظر برای حذف را انتخاب کنید:"),
                                color = Color.White, fontSize = 12.sp)
                            verifiedFactors.forEach { factor ->
                                FilterChip(
                                    selected = factorId == factor.id,
                                    onClick = { factorId = factor.id },
                                    label = { Text(if (factor.name.contains("Backup", true))
                                        l("Backup authenticator", "برنامه پشتیبان")
                                        else l("Primary authenticator", "برنامه اصلی")) }
                                )
                            }
                        }
                        OutlinedButton(onClick = { confirmDisableOpen = true },
                            modifier = Modifier.fillMaxWidth()) {
                            Text(if (verifiedFactors.size > 1)
                                l("Remove selected authenticator (code required)",
                                    "حذف برنامه انتخاب‌شده (نیازمند کد)")
                                else l("Disable 2FA (code required)",
                                    "غیرفعال‌سازی دومرحله‌ای (نیازمند کد)"))
                        }
                    }
                }
                if (pending != null || disableRequested) {
                    OutlinedTextField(value = code,
                        onValueChange = { code = it.filter(Char::isDigit).take(6) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        label = { Text(l("6-digit authenticator code", "کد شش‌رقمی"), color = Color(0xFFDEE4F1)) })
                    Button(
                        enabled = !busy && code.length == 6,
                        onClick = {
                            action {
                                val jwt = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
                                val id = pending?.optString("id").orEmpty().ifBlank { factorId.orEmpty() }
                                val upgraded = api.mfaChallengeVerify(jwt, id, code)
                                vault.commitVerifiedMfaSession(upgraded, api)
                                if (disableRequested) {
                                    // A fresh TOTP challenge is required even for an admin.
                                    // With the last factor removed, server-side requireAdmin()
                                    // blocks all administrative APIs until AAL2 is restored.
                                    api.mfaUnenroll(upgraded.optString("access_token"), id)
                                    verifiedFactors = api.mfaAllTotpFactors(
                                        upgraded.optString("access_token")).filter { it.verified }
                                    factorId = verifiedFactors.firstOrNull()?.id
                                    disableRequested = false
                                    message = if (verifiedFactors.isEmpty() && adminRequired)
                                        l("Two-factor authentication disabled. Administrator access is suspended until you enroll and verify a new authenticator.",
                                            "تأیید دومرحله‌ای غیرفعال شد. دسترسی مدیریتی تا ثبت و تأیید Authenticator جدید مسدود است.")
                                    else if (verifiedFactors.isEmpty())
                                        l("Two-factor authentication disabled",
                                            "تأیید دومرحله‌ای غیرفعال شد")
                                    else l("Authenticator removed. Other factors remain active.",
                                        "برنامه حذف شد؛ سایر عوامل امنیتی همچنان فعال‌اند.")
                                } else {
                                    verifiedFactors = api.mfaAllTotpFactors(
                                        upgraded.optString("access_token")).filter { it.verified }
                                    factorId = id
                                    pending = null
                                    message = if (enrollingBackup)
                                        l("Backup authenticator enabled successfully",
                                            "Authenticator پشتیبان با موفقیت فعال شد")
                                    else l("Authenticator enabled successfully",
                                        "تأیید دومرحله‌ای با موفقیت فعال شد")
                                    enrollingBackup = false
                                }
                                code = ""
                            }
                        }, modifier = Modifier.fillMaxWidth()) {
                        Text(if (disableRequested) l("Verify and disable", "تأیید و غیرفعال‌سازی")
                            else l("Verify and activate", "تأیید و فعال‌سازی"))
                    }
                }
                if (adminRequired) Text(l(
                    "Admins may remove an authenticator with a fresh code. If no verified factor remains, administrative permissions pause until a new one is verified.",
                    "ادمین می‌تواند با کد جدید عامل دوم را حذف کند. اگر هیچ عامل تأییدشده‌ای باقی نماند، دسترسی مدیریت تا فعال‌سازی عامل جدید متوقف می‌شود."),
                    color = Color(0xFFCFD3DD), fontSize = 11.sp)
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (error.isNotBlank()) Text(error, color = Color(0xFFFFA9AA), fontSize = 12.sp)
                if (message.isNotBlank()) Text(message, color = Color(0xFF86E9BF), fontSize = 12.sp)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss, enabled = !busy) {
            Text(l("Close", "بستن"), color = Color.White)
        } }
    )
}
