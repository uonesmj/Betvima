package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.*

fun tr(lang: Lang, en: String, fa: String) = if (lang == Lang.FA) fa else en

@Composable
fun BrandHeader(lang: Lang, onHome: () -> Unit, onLanguage: () -> Unit, onAccount: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Palette.ink).padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.clickable(onClick = onHome)) {
            Text("BETVIMA", fontSize = 23.sp, fontWeight = FontWeight.Black, letterSpacing = 1.6.sp,
                color = Color.White)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(5.dp).clip(CircleShape).background(Palette.green))
                Spacer(Modifier.width(5.dp))
                Text(tr(lang, "SPORTSBOOK", "پلتفرم ورزشی"), fontSize = 9.sp,
                    color = Color(0xFF99B2BD), letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.weight(1f))
        IconButton(onClick = onLanguage) {
            Icon(Icons.Default.Language, contentDescription = "Change language", tint = Color.White)
        }
        Surface(shape = RoundedCornerShape(14.dp), color = Palette.dark,
            modifier = Modifier.size(42.dp).clickable(onClick = onAccount)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.PersonOutline, contentDescription = "Account", tint = Palette.green)
            }
        }
    }
}

@Composable
fun SectionHeading(title: String, subtitle: String? = null, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(4.dp).height(23.dp).clip(CircleShape).background(Palette.green))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Palette.text)
            if (subtitle != null) Text(subtitle, color = Palette.muted, fontSize = 11.sp)
        }
        if (action != null && onAction != null) {
            TextButton(onClick = onAction) {
                Text(action, color = Palette.blue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Icon(Icons.Default.ChevronRight, null, tint = Palette.blue, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
fun SmallPill(text: String, background: Color, foreground: Color) {
    Surface(color = background, shape = CircleShape) {
        Text(text, color = foreground, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
    }
}

@Composable
fun TeamBadge(team: Team, size: Int = 34) {
    val safe = team.logo?.takeIf { it.startsWith("https://") }
    Surface(shape = CircleShape, color = Palette.paper, modifier = Modifier.size(size.dp),
        border = BorderStroke(1.dp, Palette.border)) {
        Box(contentAlignment = Alignment.Center) {
            if (safe != null) {
                AsyncImage(model = safe, contentDescription = team.name,
                    modifier = Modifier.fillMaxSize().padding(4.dp))
            } else {
                Text(team.name.take(1).uppercase(), fontWeight = FontWeight.Black,
                    fontSize = (size / 2.4).sp, color = Palette.muted)
            }
        }
    }
}

@Composable
fun OddsChoice(match: Match, market: Market, selection: Selection, liveEnabled: Boolean,
    selected: Boolean, onClick: () -> Unit) {
    val enabled = match.bettingAvailable && market.available && selection.available &&
        (!match.live || liveEnabled)
    val bg = if (selected) Palette.greenLight else if (enabled) Color(0xFFF7F8F9) else Color(0xFFEDF0F2)
    val stroke = if (selected) Palette.green else Palette.border
    Surface(
        modifier = Modifier.height(50.dp).clickable(enabled = enabled, onClick = onClick),
        shape = RoundedCornerShape(10.dp), color = bg, border = BorderStroke(1.dp, stroke)
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(selection.name, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = Palette.muted, textAlign = TextAlign.Center)
            Text(if (enabled) odds(selection.oddsScaled) else "—",
                fontSize = 15.sp, fontWeight = FontWeight.Black,
                color = if (enabled) Palette.text else Palette.muted)
        }
    }
}

@Composable
fun MatchTile(match: Match, lang: Lang, liveEnabled: Boolean, picks: List<Pick>,
    onOpen: () -> Unit, onPick: (Market, Selection) -> Unit) {
    val market = match.featured
    Surface(Modifier.fillMaxWidth().padding(vertical = 4.dp),
        color = Color.White, shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 2.dp) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(match.league, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, color = Palette.text)
                    if (match.country.isNotBlank()) Text(match.country, color = Palette.muted, fontSize = 10.sp)
                }
                if (match.live) SmallPill("LIVE " + (match.minute?.toString() ?: "") + "′",
                    Color(0xFFFFECF0), Palette.red)
                else SmallPill(match.starts.take(16).replace("T", " · "),
                    Color(0xFFEEF3F7), Palette.muted)
            }
            HorizontalDivider(color = Palette.border, thickness = 0.5.dp)
            Row(Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TeamBadge(match.home, 30)
                        Spacer(Modifier.width(9.dp))
                        Text(match.home.name, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                            color = Palette.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f))
                        if (match.homeScore != null)
                            Text(match.homeScore.toString(), fontWeight = FontWeight.Black, fontSize = 16.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TeamBadge(match.away, 30)
                        Spacer(Modifier.width(9.dp))
                        Text(match.away.name, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                            color = Palette.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f))
                        if (match.awayScore != null)
                            Text(match.awayScore.toString(), fontWeight = FontWeight.Black, fontSize = 16.sp)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Surface(color = Palette.paper, shape = RoundedCornerShape(10.dp)) {
                    Column(Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (match.live) tr(lang, "IN PLAY", "در جریان") else tr(lang, "PRE-MATCH", "پیش از شروع"),
                            fontWeight = FontWeight.Bold, fontSize = 9.sp, color = Palette.muted)
                        Icon(Icons.Default.ChevronRight, null, tint = Palette.blue)
                    }
                }
            }
            if (market != null) {
                Row(Modifier.fillMaxWidth().background(Color(0xFFFBFCFD))
                    .padding(horizontal = 12.dp, vertical = 9.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    market.selections.take(3).forEach { s ->
                        Box(Modifier.weight(1f)) {
                            OddsChoice(match, market, s, liveEnabled,
                                picks.any { it.selectionId == s.id }) { onPick(market, s) }
                        }
                    }
                    Surface(Modifier.size(width = 39.dp, height = 50.dp).clickable(onClick = onOpen),
                        color = Color(0xFFEEF1F4), shape = RoundedCornerShape(10.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("+" + (match.marketsCount - 1).coerceAtLeast(1),
                                fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Palette.muted)
                        }
                    }
                }
            } else {
                Text(tr(lang, "Odds currently unavailable", "ضرایب در دسترس نیستند"), modifier = Modifier.padding(14.dp),
                    color = Palette.muted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun EmptyPanel(title: String, detail: String, onRetry: (() -> Unit)? = null) {
    Surface(color = Color.White, shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Palette.border), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.SignalWifiStatusbarConnectedNoInternet4, null, tint = Palette.muted,
                modifier = Modifier.size(29.dp))
            Spacer(Modifier.height(10.dp))
            Text(title, fontWeight = FontWeight.Bold, color = Palette.text)
            Text(detail, textAlign = TextAlign.Center, color = Palette.muted,
                fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
            if (onRetry != null) TextButton(onClick = onRetry) {
                Text("Refresh", color = Palette.blue, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun BrandHero(lang: Lang, count: Int, onLive: () -> Unit, onSports: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(194.dp).clip(RoundedCornerShape(23.dp))
        .background(Brush.linearGradient(listOf(Palette.ink, Color(0xFF173C3C), Color(0xFF082C33))))) {
        Box(Modifier.size(180.dp).offset(x = 210.dp, y = (-55).dp)
            .clip(CircleShape).background(Palette.green.copy(alpha = 0.08f)))
        Column(Modifier.fillMaxSize().padding(19.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SmallPill(tr(lang, "MATCH CENTER", "مرکز مسابقات"),
                    Palette.green.copy(alpha = 0.15f), Palette.green)
                Spacer(Modifier.weight(1f))
                Icon(Icons.Default.Bolt, null, tint = Palette.green, modifier = Modifier.size(25.dp))
            }
            Column {
                Text(tr(lang, "Every moment. Every match.", "هر لحظه، هر مسابقه."),
                    color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp, lineHeight = 26.sp)
                Text(tr(lang, "Real-time odds • Live scores • Your picks",
                    "ضرایب لحظه‌ای • نتایج زنده • انتخاب‌های شما"),
                    color = Color(0xFFB1D0CF), fontSize = 11.sp,
                    modifier = Modifier.padding(top = 6.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                Button(onClick = onLive, colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
                    shape = RoundedCornerShape(11.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    Icon(Icons.Default.Sensors, null, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(tr(lang, "Live · " + count, "زنده · " + count), fontWeight = FontWeight.ExtraBold)
                }
                OutlinedButton(onClick = onSports, border = BorderStroke(1.dp, Color.White.copy(alpha = .25f)),
                    shape = RoundedCornerShape(11.dp)) {
                    Text(tr(lang, "All sports", "همه ورزش‌ها"), color = Color.White)
                }
            }
        }
    }
}
