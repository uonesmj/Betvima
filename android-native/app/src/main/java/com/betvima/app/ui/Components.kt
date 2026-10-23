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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.*

/** Presentation locale; visual layout direction stays fixed for all languages. */
val LocalNativeLanguage176 = staticCompositionLocalOf { Lang.EN }

fun tr(lang: Lang, en: String, fa: String): String = when (lang) {
    Lang.EN -> en
    Lang.FA -> fa
    Lang.TR -> NativeQuality176.translate(lang, en) ?: NativeDynamic176.translate(lang, en) ?: TurkishTranslations169.translate(en)
    Lang.DARI -> AfghanDari171.translate(en, fa)
    Lang.HY -> NativeQuality176.translate(lang, en) ?: NativeDynamic176.translate(lang, en) ?: Armenian172.translate(en)
    Lang.AR -> NativeQuality176.translate(lang, en) ?: NativeDynamic176.translate(lang, en) ?: ArabicTranslations175.translate(en)
}

/** Localized football statistics; does not confuse \"Home\" (team) with Home navigation. */
fun trLive177(lang: Lang, en: String, fa: String): String =
    NativeLiveTranslations177.translate(lang, en) ?: tr(lang, en, fa)

/**
 * BetVima's compact sportsbook header, aligned to the supplied 1win reference.
 *
 * Only the header is affected: no sports tabs, wallet data, bottom navigation,
 * login flow or notification data is replaced with mock values.
 */
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
    walletCurrency: String? = null,
    onWallet: () -> Unit = {},
    userName: String? = null,
    casinoStyle: Boolean = false
) {
    val headerBlack = if (casinoStyle) Color(0xFF141414) else Palette.headerDark
    val headerGreen = Color(0xFF0BC66B)
    // Financial values must come from the current authenticated wallet.
    // Never substitute a synthetic 0.00 or force USD/USDT.
    val currency = walletCurrency?.trim()?.takeIf { it.isNotEmpty() } ?: "—"
    val amount = walletBalance
        ?.removeSuffix(" " + currency)
        ?.trim()
        ?.takeIf { it.isNotEmpty() } ?: "—"

    // A LTR top bar matches the reference even in the Persian locale;
    // the rest of the app retains its own RTL behavior.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxWidth()
                .background(headerBlack)
                // System status bar is already handled by decorFitsSystemWindows.
                // Reserve visual breathing room BELOW it, without double insets.
                .height(106.dp)
        ) {
            val compact = maxWidth < 395.dp
            val narrow = maxWidth < 340.dp
            val actionGap = if (compact) 6.dp else 9.dp
            Row(
                Modifier.fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .height(70.dp)
                    .padding(
                        start = if (compact) 10.dp else 16.dp,
                        end = if (compact) 10.dp else 16.dp,
                        bottom = 6.dp
                    ),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.clickable(onClick = onHome)
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("BET", color = Color.White,
                        fontSize = if (compact) 17.sp else 19.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-.9).sp,
                        maxLines = 1)
                    Text("VIMA", color = headerGreen,
                        fontSize = if (compact) 17.sp else 19.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-.9).sp,
                        maxLines = 1)
                }
                Spacer(Modifier.weight(1f))
                if (signedIn) {
                    // Two-line currency + available balance: reference arrangement.
                    // Tap delegates to the existing authenticated wallet.
                    Column(
                        modifier = Modifier.width(if (compact) 68.dp else 88.dp)
                            .clickable(onClick = onWallet)
                            .padding(vertical = 5.dp),
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.End) {
                            Text(currency,
                                fontSize = if (compact) 11.sp else 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFB5B8C0),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
                            Icon(Icons.Default.KeyboardArrowDown,
                                contentDescription = tr(lang, "Wallet", "کیف پول"),
                                tint = Color(0xFF9EA2AA),
                                modifier = Modifier.size(15.dp))
                        }
                        Text(amount,
                            fontSize = if (compact) 13.sp else 15.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.width(actionGap))
                    Surface(
                        modifier = Modifier.height(44.dp)
                            .width(if (compact) 82.dp else 96.dp)
                            .clickable(onClick = onWallet),
                        color = headerGreen,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(tr(lang, "Deposit", "واریز"),
                                fontSize = if (compact) 12.sp else 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                maxLines = 1)
                        }
                    }
                    Spacer(Modifier.width(actionGap))
                    Box(
                        modifier = Modifier.size(43.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF29292C))
                            .clickable(onClick = onNotifications),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Notifications,
                            contentDescription = tr(lang, "Notifications", "اعلان‌ها"),
                            tint = Color.White, modifier = Modifier.size(22.dp))
                        if (unread > 0) {
                            Box(
                                Modifier.align(Alignment.TopEnd)
                                    .padding(5.dp)
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFFF6330))
                                    .border(2.dp, Color(0xFF29292C), CircleShape)
                            )
                        }
                    }
                } else {
                    // Reference guest actions: flat charcoal Login and green
                    // Registration, aligned on one baseline. Keep the existing
                    // account/register callbacks and localized labels intact.
                    val loginWidth = when {
                        narrow -> 62.dp
                        compact -> 72.dp
                        else -> 82.dp
                    }
                    val registerWidth = when {
                        narrow -> 96.dp
                        compact -> 113.dp
                        else -> 126.dp
                    }
                    Surface(
                        modifier = Modifier.width(loginWidth).height(46.dp)
                            .clickable(onClick = onAccount),
                        color = Color(0xFF2B2B2D),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(tr(lang, "Login", "ورود"),
                                color = Color.White,
                                fontSize = if (narrow) 12.sp else 13.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Spacer(Modifier.width(if (compact) 9.dp else 11.dp))
                    Surface(
                        modifier = Modifier.width(registerWidth).height(46.dp)
                            .clickable(onClick = onRegister),
                        color = Color(0xFF08CA60),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(tr(lang, "Registration", "ثبت‌نام"),
                                color = Color.White,
                                fontSize = if (narrow) 11.sp else 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis)
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

/** Real server-provided crest first; show a deterministic initials mark while loading
 * and whenever the URL is absent or broken. Never guess another club's badge. */
@Composable
fun TeamBadge(team: Team, size: Int = 34) {
    val logoCandidates = remember(team.logo, team.alternateLogos) {
        (listOfNotNull(team.logo) + team.alternateLogos)
            .mapNotNull(::verifiedLogoUrl).distinct()
    }
    var candidateIndex by remember(logoCandidates, team.name) { mutableIntStateOf(0) }
    val safe = logoCandidates.getOrNull(candidateIndex)
    var loaded by remember(logoCandidates, team.name) { mutableStateOf(false) }
    val initials = remember(team.name) { teamBadgeInitials(team.name) }
    val hue = remember(team.name) {
        val palette = listOf(
            Color(0xFF0A69C6), Color(0xFF1B8B6E),
            Color(0xFF7853B9), Color(0xFFB05B43), Color(0xFF304D83)
        )
        palette[((team.name.hashCode().toLong() and 0x7fffffffL) % palette.size.toLong()).toInt()]
    }
    Surface(
        shape = CircleShape, color = Color.White,
        modifier = Modifier.size(size.dp),
        border = BorderStroke(1.dp, Color(0xFFDDE5EE))
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (!loaded) {
                Box(Modifier.fillMaxSize().padding(2.dp)
                    .background(hue.copy(alpha = .105f), CircleShape),
                    contentAlignment = Alignment.Center) {
                    Text(initials, fontWeight = FontWeight.Black,
                        fontSize = (size * .34f).sp,
                        color = hue, maxLines = 1)
                }
            }
            if (safe != null) {
                AsyncImage(
                    model = safe,
                    contentDescription = team.name,
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                    onSuccess = { loaded = true },
                    onError = {
                        loaded = false
                        if (candidateIndex < logoCandidates.lastIndex) candidateIndex += 1
                    },
                    modifier = Modifier.fillMaxSize()
                        .padding((size * .09f).dp)
                        .graphicsLayer { alpha = if (loaded) 1f else 0f }
                )
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
            Text(NativeMarketLabels176.selection(LocalNativeLanguage176.current, selection.label(false), selection.label(true)),
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
                    Text(NativeMarketLabels176.selection(lang, market.label(false), market.label(true)), fontSize = 10.sp,
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
    val darkHome = LocalDarkHome.current
    Surface(color = if (darkHome) DarkHomePalette.panel else Color.White,
        shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp,
            if (darkHome) DarkHomePalette.outline else Palette.border), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(color = if (darkHome) DarkHomePalette.soft else Palette.paper,
                shape = CircleShape) {
                Icon(Icons.Default.TravelExplore, null, tint = Palette.blue,
                    modifier = Modifier.padding(14.dp).size(30.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(title, fontWeight = FontWeight.Black,
                color = if (darkHome) DarkHomePalette.ink else Palette.text,
                textAlign = TextAlign.Center, fontSize = 15.sp)
            Text(detail, textAlign = TextAlign.Center,
                color = if (darkHome) DarkHomePalette.muted else Palette.muted,
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
