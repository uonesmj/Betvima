package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.Match

private val deep126 = Color(0xFF07131C)
private val middle126 = Color(0xFF102B34)
private val green126 = Color(0xFF32E6A0)
private val pale126 = Color(0xFFEAF7F3)
private val quiet126 = Color(0xFFA8C1C9)

@Composable
internal fun PremiumMatchTvModal126(
    match: Match, facts: LiveMatchFacts?, fa: Boolean,
    clockLabel: String, onClose: () -> Unit, onRefresh: () -> Unit
) {
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            dismissOnBackPress = true, dismissOnClickOutside = true,
            usePlatformDefaultWidth = false, decorFitsSystemWindows = false
        )
    ) {
        Box(Modifier.fillMaxSize().background(Color(0xEF030A10)), contentAlignment = Alignment.Center) {
            Column(
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)
                    .widthIn(max = 780.dp).padding(horizontal = 5.dp, vertical = 6.dp)
                    .clip(RoundedCornerShape(24.dp)).background(deep126)
            ) {
                // Swipe-to-dismiss only on the handle, not the scrollable stats.
                var dragged by remember { mutableFloatStateOf(0f) }
                Box(
                    Modifier.fillMaxWidth()
                        .pointerInput(Unit) {
                            detectVerticalDragGestures(
                                onDragStart = { dragged = 0f },
                                onVerticalDrag = { change, amount -> dragged += amount; change.consume() },
                                onDragEnd = {
                                    if (dragged > 105f) onClose()
                                    dragged = 0f
                                },
                                onDragCancel = { dragged = 0f }
                            )
                        }.padding(top = 9.dp, bottom = 5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(Modifier.width(46.dp).height(5.dp).clip(RoundedCornerShape(9.dp))
                        .background(Color.White.copy(alpha = .26f)))
                }
                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, bottom = 11.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Color(0xFF1B463C), shape = RoundedCornerShape(13.dp),
                        border = BorderStroke(1.dp, Color(0xFF397E66))) {
                        Icon(Icons.Default.Tv, contentDescription = null, tint = green126,
                            modifier = Modifier.padding(10.dp).size(20.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(if (fa) "BETVIMA · مرکز مسابقه" else "BETVIMA · MATCH STUDIO",
                            color = pale126, fontSize = 13.sp, fontWeight = FontWeight.Black)
                        Text(if (fa) "آمار و جریان زنده از Best API" else "Live match data · Best API",
                            color = quiet126, fontSize = 10.sp)
                    }
                    IconButton(onClick = onRefresh, modifier = Modifier.size(43.dp)) {
                        Icon(Icons.Default.Refresh,
                            contentDescription = if (fa) "به‌روزرسانی آمار" else "Refresh statistics",
                            tint = quiet126)
                    }
                    Surface(shape = CircleShape, color = Color(0xFF263E48),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = .18f))) {
                        IconButton(onClick = onClose, modifier = Modifier.size(40.dp)) {
                            Icon(Icons.Default.Close,
                                contentDescription = if (fa) "بستن" else "Close",
                                tint = Color.White)
                        }
                    }
                }
                HorizontalDivider(color = Color.White.copy(alpha = .08f))
                Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(
                        Modifier.fillMaxWidth().background(
                            Brush.verticalGradient(listOf(Color(0xFF163D40),
                                Color(0xFF102B34), deep126))
                        ).padding(horizontal = 15.dp, vertical = 16.dp)
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Color(0xFF174F40), shape = RoundedCornerShape(20.dp),
                                border = BorderStroke(1.dp, Color(0xFF399D72))) {
                                Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Sensors, null,
                                        tint = green126, modifier = Modifier.size(13.dp))
                                    Spacer(Modifier.width(5.dp))
                                    Text(if (match.live) "LIVE" else if (fa) "آینده" else "UPCOMING",
                                        color = green126, fontSize = 10.sp,
                                        fontWeight = FontWeight.Black)
                                }
                            }
                            Spacer(Modifier.weight(1f))
                            Text(clockLabel, color = pale126, fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold)
                        }
                        Spacer(Modifier.height(15.dp))
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                TeamBadge(match.home, 56)
                                Spacer(Modifier.height(7.dp))
                                Text(match.home.name, color = Color.White,
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2,
                                    textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
                                Text(if (fa) "میزبان" else "HOME", color = quiet126, fontSize = 9.sp)
                            }
                            Column(Modifier.width(108.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                val official = facts?.score?.split("-")?.takeIf { it.size == 2 }
                                val score = official?.joinToString(" : ")
                                    ?: ((match.homeScore?.toString() ?: "–") + " : " +
                                        (match.awayScore?.toString() ?: "–"))
                                AnimatedContent(targetState = score,
                                    transitionSpec = { (fadeIn(tween(200)) togetherWith fadeOut(tween(200))) },
                                    label = "officialScore") { value ->
                                    Text(value, color = pale126, fontSize = 26.sp,
                                        fontWeight = FontWeight.Black, maxLines = 1)
                                }
                                Text(if (fa) "نتیجه بازی" else "MATCH SCORE", fontSize = 9.sp, color = quiet126)
                            }
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                TeamBadge(match.away, 56)
                                Spacer(Modifier.height(7.dp))
                                Text(match.away.name, color = Color.White,
                                    fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 2,
                                    textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
                                Text(if (fa) "مهمان" else "AWAY", color = quiet126, fontSize = 9.sp)
                            }
                        }
                        Spacer(Modifier.height(13.dp))
                        Text(match.league, color = Color(0xFFC2D9D6),
                            modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    if (match.live && match.sport == "football") {
                        PremiumNativeLiveTracker(match = match, facts = facts, fa = fa,
                            clockLabel = clockLabel)
                    } else {
                        Surface(color = middle126, shape = RoundedCornerShape(18.dp),
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                            Text(
                                if (fa) "این نما برای مسابقات زنده فوتبال ارائه می‌شود."
                                else "Live Match Studio is available for live football fixtures.",
                                color = quiet126, modifier = Modifier.padding(20.dp),
                                textAlign = TextAlign.Center, fontSize = 12.sp
                            )
                        }
                    }
                    if (facts?.error != null) {
                        Text(if (fa) "اطلاعات لحظه‌ای موقتاً در دسترس نیست؛ از به‌روزرسانی استفاده کنید."
                            else "Live provider updates are temporarily unavailable; tap refresh.",
                            color = Color(0xFFFFD58F), fontSize = 11.sp,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                            textAlign = TextAlign.Center)
                    }
                    Spacer(Modifier.height(14.dp))
                }
                HorizontalDivider(color = Color.White.copy(alpha = .1f))
                Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(if (fa) "نمای زنده آماری · بدون پخش ویدیویی"
                        else "Live match graphics · no video stream",
                        color = quiet126, fontSize = 10.sp,
                        modifier = Modifier.weight(1f))
                    Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF1C5B48),
                        modifier = Modifier.clickable { onClose() }) {
                        Row(Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.ExpandMore, null, tint = pale126,
                                modifier = Modifier.size(15.dp))
                            Text(if (fa) "بازگشت به ضرایب" else "Back to markets",
                                color = pale126, fontSize = 10.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
