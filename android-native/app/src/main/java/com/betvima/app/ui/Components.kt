package com.betvima.app.ui

import androidx.compose.animation.togetherWith
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
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
fun BrandHeader(
    lang: Lang,
    signedIn: Boolean,
    onHome: () -> Unit,
    onAccount: () -> Unit,
    onRegister: () -> Unit,
    onNotifications: () -> Unit,
    unread: Int,
    walletBalance: String? = null,
    onWallet: () -> Unit = {},
    userName: String? = null
) {
    // Keep the brand and financial controls in stable left-to-right order.
    // Actual wallet and identity values come from authenticated backend responses.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(
            Modifier.fillMaxWidth()
                .background(Brush.horizontalGradient(
                    listOf(Color(0xFF080E16), Color(0xFF15242D))))
                .heightIn(min = 74.dp)
                .padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.clickable(onClick = onHome).padding(vertical = 6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("BET", color = Color.White, fontSize = 19.sp,
                        fontWeight = FontWeight.Black, letterSpacing = (-.8).sp)
                    Text("VIMA", color = Palette.green, fontSize = 19.sp,
                        fontWeight = FontWeight.Black, letterSpacing = (-.8).sp)
                }
                Box(Modifier.padding(top = 4.dp).width(40.dp).height(2.dp)
                    .background(Brush.horizontalGradient(
                        listOf(Palette.blue, Palette.green)),
                        RoundedCornerShape(99.dp)))
            }
            Spacer(Modifier.weight(1f))
            androidx.compose.animation.AnimatedContent(
                targetState = signedIn, label = "authenticatedHeader",
                transitionSpec = {
                    androidx.compose.animation.fadeIn(
                        androidx.compose.animation.core.tween(220)) togetherWith
                    androidx.compose.animation.fadeOut(
                        androidx.compose.animation.core.tween(140))
                }
            ) { authenticated ->
                if (authenticated) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Surface(shape = RoundedCornerShape(16.dp),
                            color = Color(0xFF172B31),
                            border = BorderStroke(1.dp, Palette.green.copy(alpha = .45f)),
                            shadowElevation = 4.dp,
                            modifier = Modifier.clickable(onClick = onWallet)) {
                            Row(Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AccountBalanceWallet, null,
                                    modifier = Modifier.size(18.dp), tint = Palette.green)
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text(tr(lang, "BALANCE", "موجودی"),
                                        color = Color(0xFFA5BBC0),
                                        fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                    Text(walletBalance ?: "—",
                                        color = Color.White,
                                        fontSize = 13.sp, fontWeight = FontWeight.Black,
                                        maxLines = 1)
                                }
                            }
                        }
                        Column(Modifier.clickable(onClick = onAccount)
                            .widthIn(max = 95.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            Surface(color = Color(0xFF25383F),
                                border = BorderStroke(1.dp, Color.White.copy(alpha = .18f)),
                                shape = CircleShape) {
                                Icon(Icons.Default.PersonOutline,
                                    tr(lang, "Your profile", "حساب کاربری"),
                                    tint = Palette.green,
                                    modifier = Modifier.padding(8.dp).size(18.dp))
                            }
                            Spacer(Modifier.height(3.dp))
                            Text(userName?.takeIf { it.isNotBlank() }
                                ?: tr(lang, "Account", "حساب"),
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                                color = Color.White, fontSize = 9.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Color.White.copy(alpha = .08f),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = .16f)),
                            modifier = Modifier.clickable(onClick = onAccount)) {
                            Text(tr(lang, "Log in", "ورود"),
                                modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
                                color = Color.White, fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold)
                        }
                        Surface(color = Palette.green,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.clickable(onClick = onRegister)) {
                            Text(tr(lang, "Sign up", "ثبت‌نام"),
                                modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
                                color = Palette.ink, fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SectionHeading(title: String, subtitle: String? = null, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(4.dp).height(19.dp).clip(CircleShape).background(Palette.green))
                Spacer(Modifier.width(9.dp))
                Text(title, fontWeight = FontWeight.Black, fontSize = 17.sp,
                    color = Palette.text, maxLines = 2, lineHeight = 22.sp)
            }
            if (subtitle != null) Text(subtitle, color = Palette.muted,
                fontSize = 11.sp, lineHeight = 16.sp,
                modifier = Modifier.padding(start = 13.dp, top = 4.dp))
        }
        if (action != null && onAction != null) {
            Surface(color = Color.White, shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Palette.border),
                modifier = Modifier.clickable(onClick = onAction)) {
                Row(Modifier.padding(horizontal = 11.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(action, color = Palette.blue, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp)
                    Spacer(Modifier.width(3.dp))
                    Icon(Icons.Default.ChevronRight, null, tint = Palette.blue,
                        modifier = Modifier.size(15.dp))
                }
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
    val bg = if (selected) Color(0xFFDDECFF) else if (enabled) Color(0xFFEDEFF3) else Color(0xFFEDF0F2)
    Surface(
        modifier = Modifier.fillMaxWidth().heightIn(min = 57.dp)
            .clickable(enabled = enabled, onClick = onClick),
        shape = RoundedCornerShape(11.dp), color = bg,
        border = BorderStroke(if (selected) 2.dp else 1.dp,
            if (selected) Palette.blue else Palette.border)
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = 3.dp, vertical = 7.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center) {
            Text(selection.label(LocalLayoutDirection.current == LayoutDirection.Rtl),
                fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = if (selected) Palette.blue else Palette.muted,
                textAlign = TextAlign.Center, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(3.dp))
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center) {
                if (!enabled) Icon(Icons.Default.Lock, null, tint = Palette.muted,
                    modifier = Modifier.size(12.dp))
                if (selected) Icon(Icons.Default.Check, null, tint = Palette.blue,
                    modifier = Modifier.size(12.dp))
                Text(if (enabled) odds(selection.oddsScaled) else "—",
                    fontSize = 16.sp, fontWeight = FontWeight.Black,
                    color = if (selected) Palette.blue
                        else if (enabled) Palette.text else Palette.muted)
                if (enabled && selection.movement == "UP") Icon(
                    Icons.Default.North, null, tint = Palette.green,
                    modifier = Modifier.size(12.dp))
                if (enabled && selection.movement == "DOWN") Icon(
                    Icons.Default.South, null, tint = Palette.red,
                    modifier = Modifier.size(12.dp))
            }
        }
    }
}

@Composable
fun MatchTile(match: Match, lang: Lang, liveEnabled: Boolean, picks: List<Pick>,
    onOpen: () -> Unit, onPick: (Market, Selection) -> Unit) {
    val market = match.featured
    Surface(Modifier.fillMaxWidth().padding(vertical = 3.dp),
        color = Color.White, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Palette.greenLight, shape = RoundedCornerShape(9.dp)) {
                    Icon(Icons.Default.SportsSoccer, null, tint = Palette.ink,
                        modifier = Modifier.padding(7.dp).size(17.dp))
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(match.league, fontWeight = FontWeight.ExtraBold,
                        fontSize = 12.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, color = Palette.text)
                    Text(match.country.ifBlank { tr(lang, "Football", "فوتبال") },
                        color = Palette.muted, fontSize = 10.sp, maxLines = 1)
                }
                if (match.live) SmallPill(
                    tr(lang, "LIVE", "زنده") + " " + (match.minute?.toString() ?: "•") + "′",
                    Color(0xFFFFEEF1), Palette.red
                ) else Text(match.starts.take(16).replace("T", " · "),
                    fontSize = 10.sp, color = Palette.muted)
            }
            HorizontalDivider(color = Palette.border.copy(alpha = .8f), thickness = .5.dp)
            Row(Modifier.fillMaxWidth().clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TeamBadge(match.home, 33)
                        Spacer(Modifier.width(10.dp))
                        Text(match.home.name, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                            color = Palette.text, maxLines = 1,
                            overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        if (match.homeScore != null) Text(match.homeScore.toString(),
                            fontWeight = FontWeight.Black, fontSize = 19.sp,
                            color = if (match.live) Palette.blue else Palette.text)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TeamBadge(match.away, 33)
                        Spacer(Modifier.width(10.dp))
                        Text(match.away.name, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                            color = Palette.text, maxLines = 1,
                            overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        if (match.awayScore != null) Text(match.awayScore.toString(),
                            fontWeight = FontWeight.Black, fontSize = 19.sp,
                            color = if (match.live) Palette.blue else Palette.text)
                    }
                }
                Spacer(Modifier.width(10.dp))
                Surface(color = Palette.paper, shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.clickable(onClick = onOpen)) {
                    Column(Modifier.padding(horizontal = 11.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (match.live) tr(lang, "IN PLAY", "در جریان")
                            else tr(lang, "PRE", "آینده"),
                            fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Palette.muted)
                        Text(if (match.marketsCount > 0) "+${match.marketsCount}" else "›",
                            color = Palette.blue, fontSize = 15.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
            if (market != null) {
                HorizontalDivider(color = Palette.border.copy(alpha = .6f), thickness = .5.dp)
                Column(Modifier.fillMaxWidth().background(Color(0xFFFBFCFD))
                    .padding(horizontal = 12.dp, vertical = 10.dp)) {
                    Text(market.label(lang == Lang.FA), fontSize = 10.sp,
                        fontWeight = FontWeight.Bold, color = Palette.muted,
                        modifier = Modifier.padding(bottom = 6.dp),
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        market.selections.take(3).forEach { selection ->
                            Box(Modifier.weight(1f)) {
                                OddsChoice(match, market, selection, liveEnabled,
                                    picks.any { it.selectionId == selection.id }) {
                                    onPick(market, selection)
                                }
                            }
                        }
                        Surface(
                            modifier = Modifier.width(43.dp).heightIn(min = 57.dp)
                                .clickable(onClick = onOpen),
                            color = Palette.ink, shape = RoundedCornerShape(11.dp)) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.ChevronRight,
                                    contentDescription = tr(lang, "All markets", "تمام بازارها"),
                                    tint = Palette.green, modifier = Modifier.size(24.dp))
                            }
                        }
                    }
                }
            } else {
                BvInformationStrip(tr(lang, "Odds temporarily unavailable",
                    "ضرایب موقتاً در دسترس نیستند"),
                    icon = Icons.Default.Lock,
                    modifier = Modifier.padding(11.dp), accent = Palette.muted)
            }
        }
    }
}

@Composable
fun EmptyPanel(title: String, detail: String, onRetry: (() -> Unit)? = null) {
    Surface(color = Color.White, shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp, Palette.border), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(color = Palette.paper, shape = CircleShape) {
                Icon(Icons.Default.TravelExplore, null, tint = Palette.blue,
                    modifier = Modifier.padding(14.dp).size(30.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(title, fontWeight = FontWeight.Black, color = Palette.text,
                textAlign = TextAlign.Center, fontSize = 15.sp)
            Text(detail, textAlign = TextAlign.Center, color = Palette.muted,
                fontSize = 12.sp, lineHeight = 19.sp,
                modifier = Modifier.padding(top = 7.dp))
            if (onRetry != null) {
                Spacer(Modifier.height(10.dp))
                BvPrimaryButton(if (LocalLayoutDirection.current == LayoutDirection.Rtl)
                    "تازه‌سازی" else "Refresh",
                    onClick = onRetry, icon = Icons.Default.Refresh)
            }
        }
    }
}

@Composable
fun BrandHero(lang: Lang, count: Int, onLive: () -> Unit, onSports: () -> Unit) {
    BvPageBanner(
        eyebrow = tr(lang, "BETVIMA MATCH CENTER", "مرکز زنده بت‌ویما"),
        title = tr(lang, "Your sports. Your moment.", "هیجان هر لحظه، در یک نگاه."),
        subtitle = tr(lang, "Explore verified live scores, upcoming fixtures and real market prices.",
            "نتایج زنده، مسابقات آینده و ضرایب واقعی را یک‌جا دنبال کنید."),
        icon = Icons.Default.SportsSoccer,
        accent = Palette.green
    ) {
        Spacer(Modifier.height(5.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            BvPrimaryButton(tr(lang, "Live · $count", "زنده · $count"),
                onClick = onLive, icon = Icons.Default.Sensors)
            OutlinedButton(onClick = onSports, shape = RoundedCornerShape(13.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = .3f)),
                modifier = Modifier.heightIn(min = 50.dp)) {
                Text(tr(lang, "All sports", "همه ورزش‌ها"), color = Color.White,
                    fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}
