package com.betvima.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay

/** PIN/pattern gate. Attempt throttling is stored outside Compose and survives restarts. */
@Composable
internal fun LocalPinGate87(locked: Boolean, onUnlock: () -> Unit) {
    if (!locked) return
    val lang = LocalNativeLanguage176.current
    val context = LocalContext.current
    val settings = remember(context) { SettingsDevice87(context) }
    var pin by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var remaining by remember { mutableLongStateOf(settings.blockedRemainingMs88()) }
    val mode = settings.lockMode88()
    LaunchedEffect(locked) {
        while (true) {
            remaining = settings.blockedRemainingMs88()
            delay(400)
        }
    }
    fun attempt(candidate: String) {
        if (remaining > 0L) return
        when (settings.unlock88(candidate)) {
            1 -> { pin = ""; message = ""; onUnlock() }
            -1 -> {
                pin = ""; remaining = settings.blockedRemainingMs88()
                message = tr(lang, "Too many attempts. Please wait.", "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً صبر کنید.")
            }
            else -> { pin = ""; message = if (mode == "pattern") tr(lang, "Incorrect pattern", "الگوی اشتباه")
                    else tr(lang, "Incorrect PIN", "پین اشتباه") }
        }
    }
    Dialog(onDismissRequest = {}, properties = DialogProperties(
        usePlatformDefaultWidth = false, dismissOnBackPress = false,
        dismissOnClickOutside = false)) {
        Column(Modifier.fillMaxWidth(.98f).heightIn(max = 720.dp)
            .background(Color(0xFF17181E), RoundedCornerShape(27.dp))
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 17.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Icon(Icons.Default.Shield, null, tint = Color(0xFF168CFF),
                modifier = Modifier.size(37.dp))
            Text(tr(lang, "Unlock BetVima", "بازکردن قفل بت‌ویما"), color = Color.White,
                fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(if (mode == "pattern") tr(lang, "Draw your secure unlock pattern", "الگوی امن خود را رسم کنید")
                    else tr(lang, "Enter your 6-digit PIN", "پین شش‌رقمی خود را وارد کنید"),
                color = Color(0xFFB2B7C6), fontSize = 12.sp)
            if (mode == "pattern") {
                PatternPad88(onComplete = ::attempt)
            } else {
                OutlinedTextField(pin, { pin = it.filter(Char::isDigit).take(6); message = "" },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    singleLine = true, label = { Text("PIN") },
                    modifier = Modifier.fillMaxWidth(), isError = message.isNotBlank())
                Button(onClick = { attempt(pin) },
                    enabled = pin.length == 6 && remaining == 0L,
                    modifier = Modifier.fillMaxWidth().height(49.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF168CFF)),
                    shape = RoundedCornerShape(14.dp)) { Text(tr(lang, "Unlock", "بازکردن قفل")) }
            }
            if (message.isNotBlank()) Text(message, color = Color(0xFFFFABAE), fontSize = 12.sp)
            if (remaining > 0L) Text(tr(lang, "Locked for ", "زمان قفل باقی‌مانده: ") + (remaining / 1000 + 1) + tr(lang, " seconds", " ثانیه"),
                color = Color(0xFFE9BE7D), fontSize = 12.sp)
        }
    }
}
