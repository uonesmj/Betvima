package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIosNew
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.CasinoGame

/**
 * Presentation only. Neither this page nor its buttons launch provider sessions,
 * determine eligibility, or modify balances; the existing lobby callbacks do.
 */
@Composable
fun CasinoGameDetail188(
    game: CasinoGame,
    lang: Lang,
    allowedRealMoney: Boolean,
    signedIn: Boolean,
    launching: Boolean,
    fullscreen: Boolean,
    onFullscreenChange: (Boolean) -> Unit,
    onBack: () -> Unit,
    onReal: () -> Unit
) {
    val dark = Color(0xFF141414)
    val panel = Color(0xFF212123)
    val border = Color(0xFF353537)
    val muted = Color(0xFFB1B1BA)
    val blue = Color(0xFF0C7EFA)

    BoxWithConstraints(Modifier.fillMaxSize().background(ChromeTokens.black)) {
        val compact = maxHeight < 680.dp
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 19.dp).padding(bottom = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    Modifier.clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onBack).padding(vertical = 10.dp, horizontal = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.ArrowBackIosNew, null, tint = muted,
                        modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(tr(lang, "Back", "بازگشت"), color = Color.White,
                        fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
                Spacer(Modifier.weight(1f))
                Text("BETVIMA", color = muted, fontSize = 11.sp,
                    fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(if (compact) 14.dp else 34.dp))
            Box(
                Modifier.width(if (compact) 144.dp else 165.dp)
                    .height(if (compact) 182.dp else 211.dp)
                    .clip(RoundedCornerShape(17.dp))
                    .background(Brush.verticalGradient(
                        listOf(Color(0xFF283767), Color(0xFF151C36)))),
                contentAlignment = Alignment.Center
            ) {
                if (!game.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = game.imageUrl, contentDescription = game.name,
                        modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(Icons.Default.Casino, null, tint = Color.White,
                        modifier = Modifier.size(65.dp))
                }
            }
            Spacer(Modifier.height(21.dp))
            Text(game.name, color = Color.White,
                fontSize = if (compact) 22.sp else 25.sp, lineHeight = 30.sp,
                fontWeight = FontWeight.Bold, maxLines = 3,
                overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(9.dp))
            Text(game.providerName, color = Color(0xFFE0E0E5),
                fontSize = 16.sp, fontWeight = FontWeight.Medium, maxLines = 1,
                overflow = TextOverflow.Ellipsis)

            Spacer(Modifier.height(if (compact) 21.dp else 32.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = panel, shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, border)
            ) {
                Column(Modifier.padding(17.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().height(47.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(tr(lang, "Game balance currency", "ارز موجودی بازی"),
                            color = Color.White, fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Surface(color = Color(0xFF064BA5), shape = RoundedCornerShape(30.dp)) {
                            Text("$", modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                                color = Color.White, fontSize = 13.sp)
                        }
                        Spacer(Modifier.width(8.dp))
                        Text("USD", color = muted, fontSize = 15.sp)
                    }
                    HorizontalDivider(color = border, thickness = 1.dp)
                    Row(
                        modifier = Modifier.fillMaxWidth().height(71.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(tr(lang, "Fullscreen mode", "حالت تمام‌صفحه"),
                            color = Color.White, fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Switch(checked = fullscreen, onCheckedChange = onFullscreenChange,
                            colors = SwitchDefaults.colors(
                                checkedTrackColor = blue,
                                checkedThumbColor = Color.White))
                    }
                    Button(
                        onClick = onReal,
                        enabled = signedIn && allowedRealMoney && !launching,
                        modifier = Modifier.fillMaxWidth().height(53.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = blue)
                    ) {
                        Text(tr(lang, "Play", "بازی واقعی"),
                            fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                    if (launching) {
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(Modifier.fillMaxWidth(), color = blue)
                    }
                    if (!allowedRealMoney) {
                        Spacer(Modifier.height(11.dp))
                        Text(
                            tr(lang, "Real-money play is unavailable for this account.",
                                "بازی واقعی برای این حساب در دسترس نیست."),
                            color = muted, fontSize = 11.sp, lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}
