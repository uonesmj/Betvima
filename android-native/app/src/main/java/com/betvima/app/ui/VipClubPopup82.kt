package com.betvima.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties

/**
 * The real VIP entry point from BetvimaApp.
 *
 * It must host the video-inspired VIP page, not an independent legacy
 * marketing screen: all drawer/footer/notification VIP links open this modal.
 * The presentation changes only; no VIP eligibility or wallet state is edited.
 */
@Composable
fun VipClubPopup82(
    state: AppState,
    model: AppViewModel,
    onDismiss: () -> Unit,
    onSupport: () -> Unit
) {
    PremiumMotionDialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) { motion, closeWith ->
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(.96f)
                .then(motion)
                .padding(horizontal = 7.dp)
                .clip(RoundedCornerShape(29.dp))
                .background(Color(0xFF121316))
        ) {
            Row(
                Modifier.fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(
                        Color(0xFF25262B), Color(0xFF121316)
                    )))
                    .padding(start = 19.dp, end = 12.dp, top = 12.dp, bottom = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        tr(LocalNativeLanguage176.current,
                            "BETVIMA  /  VIP", "BETVIMA  /  VIP"),
                        fontSize = 11.sp, letterSpacing = 1.3.sp,
                        fontWeight = FontWeight.Black, color = Color(0xFF00D47A)
                    )
                    Text(
                        tr(state.lang, "VIP Club", "باشگاه VIP"),
                        fontSize = 17.sp, fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                IconButton(
                    onClick = { closeWith({}) },
                    modifier = Modifier.clip(CircleShape)
                        .background(Color.White.copy(alpha = .09f))
                ) {
                    Icon(
                        Icons.Default.Close,
                        tr(state.lang, "Close VIP Club", "بستن باشگاه VIP"),
                        tint = Color.White
                    )
                }
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                PremiumVipClubPage(
                    state = state,
                    model = model,
                    onSupport = { closeWith(onSupport) }
                )
            }
        }
    }
}
