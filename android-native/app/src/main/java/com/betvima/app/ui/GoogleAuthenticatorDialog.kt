package com.betvima.app.ui

import android.graphics.Bitmap
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
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var factorId by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf<JSONObject?>(null) }
    var code by remember { mutableStateOf("") }
    var disableRequested by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    fun l(en: String, fa: String) = tr(lang, en, fa)
    LaunchedEffect(Unit) {
        try {
            val jwt = vault.accessToken(api) ?: error("Sign in required")
            factorId = api.mfaFactors(jwt).firstOrNull()
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
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
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
                    if (secret.isNotBlank()) Text(secret, fontSize = 13.sp,
                        color = Color(0xFFB8D7FF), fontWeight = FontWeight.Bold)
                } else if (factorId == null) {
                    Text(l("Optional for members, mandatory for administrators.",
                        "برای کاربران اختیاری و برای مدیران اجباری است."),
                        color = Color(0xFFC5CBDA), fontSize = 12.sp)
                    Button(onClick = {
                        action {
                            val jwt = vault.accessToken(api) ?: error("Sign in required")
                            pending = api.mfaEnroll(jwt)
                        }
                    }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Text(l("Set up authenticator", "فعال‌سازی Authenticator"))
                    }
                } else {
                    Text(l("Your account has an authenticator. Confirm a new code when signing in.",
                        "Authenticator روی حساب شما ثبت شده است. هنگام ورود باید کد جدید وارد کنید."),
                        color = Color(0xFFC5CBDA), fontSize = 12.sp)
                    if (!adminRequired && !disableRequested) {
                        OutlinedButton(onClick = { disableRequested = true },
                            modifier = Modifier.fillMaxWidth()) {
                            Text(l("Disable (requires current code)", "غیرفعال‌سازی (نیازمند کد فعلی)"))
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
                                val jwt = vault.accessToken(api) ?: error("Sign in required")
                                val id = pending?.optString("id").orEmpty().ifBlank { factorId.orEmpty() }
                                val upgraded = api.mfaChallengeVerify(jwt, id, code)
                                vault.commitVerifiedMfaSession(upgraded, api)
                                if (disableRequested) {
                                    if (adminRequired) error("Administrators must keep MFA enabled")
                                    api.mfaUnenroll(upgraded.optString("access_token"), id)
                                    factorId = null
                                    disableRequested = false
                                    message = l("Two-factor authentication disabled", "تأیید دومرحله‌ای غیرفعال شد")
                                } else {
                                    factorId = id
                                    pending = null
                                    message = l("Authenticator enabled successfully", "تأیید دومرحله‌ای با موفقیت فعال شد")
                                }
                                code = ""
                            }
                        }, modifier = Modifier.fillMaxWidth()) {
                        Text(if (disableRequested) l("Verify and disable", "تأیید و غیرفعال‌سازی")
                            else l("Verify and activate", "تأیید و فعال‌سازی"))
                    }
                }
                if (adminRequired) Text(l("Admin security policy requires this factor.",
                    "طبق سیاست امنیتی، این عامل برای مدیران اجباری است."),
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
