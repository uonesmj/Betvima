package com.betvima.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import androidx.compose.ui.platform.LocalContext

/** Local PIN cannot recover a server account. It protects this device's app UI. */
@Composable
internal fun LocalPinGate87(locked: Boolean, onUnlock: () -> Unit) {
    if (!locked) return
    val context = LocalContext.current
    val settings = remember { SettingsDevice87(context) }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }
    var fails by remember { mutableIntStateOf(0) }
    var blockedUntil by remember { mutableLongStateOf(0L) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(blockedUntil) {
        while (blockedUntil > System.currentTimeMillis()) {
            now = System.currentTimeMillis()
            delay(700)
        }
    }
    Dialog(onDismissRequest = {},
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = false, dismissOnClickOutside = false)) {
        Column(Modifier.fillMaxWidth(.87f)
            .background(Color(0xFF14151B), RoundedCornerShape(25.dp))
            .padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(Icons.Default.Shield, null, tint = Color(0xFF73B4FF),
                modifier = Modifier.size(43.dp))
            Text("Unlock BetVima", color = Color.White,
                fontWeight = FontWeight.Black, fontSize = 21.sp)
            Text("Enter the 6-digit PIN set on this device",
                color = Color(0xFFA5ABBA), fontSize = 11.sp)
            OutlinedTextField(value = pin, onValueChange = {
                pin = it.filter(Char::isDigit).take(6); error = false
            }, visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                singleLine = true, label = { Text("Device PIN") },
                isError = error,
                modifier = Modifier.fillMaxWidth())
            if (error) Text("Incorrect PIN", color = Color(0xFFFF8A8A), fontSize = 12.sp)
            if (blockedUntil > now) Text(
                "Too many attempts · try again in " + ((blockedUntil-now)/1000+1) + "s",
                color = Color(0xFFE9BB7E), fontSize = 11.sp)
            Button(onClick = {
                if (settings.checkPin(pin)) { pin = ""; fails = 0; onUnlock() }
                else {
                    pin = ""; error = true
                    fails++
                    if (fails >= 5) {
                        blockedUntil = System.currentTimeMillis() + 30_000
                        fails = 0
                    }
                }
            }, enabled = pin.length == 6 && blockedUntil <= now,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF168CFF)),
                shape = RoundedCornerShape(14.dp)) {
                Text("Unlock", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}
