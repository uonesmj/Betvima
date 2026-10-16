package com.betvima.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** The existing verified bonus ledger, history, timers and rules inside a native popup. */
@Composable
fun BonusPopup83(state: AppState, model: AppViewModel, onDismiss: () -> Unit) {
    PremiumMotionDialog(onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)) { motion, closeWith ->
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(.97f)
                .then(motion)
                .padding(horizontal = 6.dp)
                .clip(RoundedCornerShape(27.dp))
                .background(Color(0xFF0E0F13))
        ) {
            Column(Modifier.fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(
                    Color(0xFF1C1D23), Color(0xFF0D0E12))))
                .padding(horizontal = 16.dp, vertical = 12.dp)) {
                Box(Modifier.align(Alignment.CenterHorizontally)
                    .width(36.dp).height(4.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = .26f)))
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CardGiftcard, null,
                        tint = Color(0xFF8AB8FF), modifier = Modifier.size(26.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("BETVIMA", color = Color(0xFF8AB8FF),
                            fontWeight = FontWeight.Black, fontSize = 10.sp,
                            letterSpacing = 1.sp)
                        Text(tr(state.lang, "My Bonuses", "بونوس‌های من"),
                            color = Color.White, fontWeight = FontWeight.Black,
                            fontSize = 20.sp)
                    }
                    IconButton(onClick = { closeWith({}) }) {
                        Icon(Icons.Default.Close,
                            tr(state.lang, "Close bonuses", "بستن بونوس‌ها"),
                            tint = Color.White)
                    }
                }
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                PremiumBonusesPage(state, model)
            }
        }
    }
}
