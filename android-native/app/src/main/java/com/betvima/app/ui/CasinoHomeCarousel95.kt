package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.VideogameAsset
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.CasinoGame
import com.betvima.app.data.casinoCategoryLabel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

private val casinoCardInk95 = Color(0xFF202832)
private val casinoCardMuted95 = Color(0xFF798592)
private val casinoCardBorder95 = Color(0xFFE2E7EC)
private val casinoCardBlue95 = Color(0xFF087FF5)

/**
 * Native home casino shelf. It shares the 315dp horizontal LazyRow + white,
 * rounded sportsbook card treatment used by ReferenceMatchCarousel.
 *
 * Only supplier-returned games are displayed; no locally invented slot titles,
 * no wallet operations and no implicit real-money game launches.
 */
@Composable
fun CasinoHomeCarousel95(lang: Lang, model: AppViewModel, onViewAll: () -> Unit) {
    val darkHome = LocalDarkHome.current
    val cardBackground = if (darkHome) DarkHomePalette.panel else Color.White
    val cardBorder = if (darkHome) DarkHomePalette.outline else casinoCardBorder95
    val cardInk = if (darkHome) DarkHomePalette.ink else casinoCardInk95
    val cardMuted = if (darkHome) DarkHomePalette.muted else casinoCardMuted95
    var games by remember { mutableStateOf<List<CasinoGame>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshSerial by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshSerial) {
        loading = true
        // Run live-dealer and slot reads concurrently. The ViewModel shares
        // short-lived catalogue entries with Casino so navigation can reuse them.
        val (live, slots) = coroutineScope {
            val liveJob = async {
                try { model.casinoGames(1, "live", "", "").games.take(4) }
                catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { emptyList() }
            }
            val slotsJob = async {
                try { model.casinoGames(1, "slots", "", "").games.take(4) }
                catch (cancel: CancellationException) { throw cancel }
                catch (_: Exception) { emptyList() }
            }
            liveJob.await() to slotsJob.await()
        }
        // Live dealer games appear first, then slots. Never insert dummy games.
        games = (live + slots).distinctBy { it.id }
        loading = false
    }

    if (loading) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(end = 1.dp)) {
            items(2) {
                Surface(
                    modifier = Modifier.width(315.dp).height(250.dp),
                    color = cardBackground,
                    shape = RoundedCornerShape(21.dp),
                    border = BorderStroke(1.dp, cardBorder)
                ) {
                    Box(Modifier.fillMaxSize().background(
                        if (darkHome) DarkHomePalette.soft else Color(0xFFF3F6F9)))
                }
            }
        }
    } else if (games.isEmpty()) {
        Surface(color = cardBackground, shape = RoundedCornerShape(21.dp),
            border = BorderStroke(1.dp, cardBorder),
            modifier = Modifier.clickable { refreshSerial++ }) {
            Text(tr(lang, "Casino games are unavailable. Tap to retry.",
                "بازی‌های کازینو در دسترس نیستند. برای تلاش مجدد لمس کنید."),
                modifier = Modifier.fillMaxWidth().padding(22.dp),
                color = cardMuted, fontSize = 12.sp)
        }
    } else {
        LazyRow(Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(end = 1.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            flingBehavior = rememberPremiumFlingBehavior()) {
            items(games, key = { it.id }) { game ->
                CasinoHomeGameCard95(game, lang, onViewAll)
            }
        }
    }
}

@Composable
private fun CasinoHomeGameCard95(game: CasinoGame, lang: Lang, onOpen: () -> Unit) {
    val darkHome = LocalDarkHome.current
    val cardBackground = if (darkHome) DarkHomePalette.panel else Color.White
    val cardBorder = if (darkHome) DarkHomePalette.outline else casinoCardBorder95
    val cardInk = if (darkHome) DarkHomePalette.ink else casinoCardInk95
    val cardMuted = if (darkHome) DarkHomePalette.muted else casinoCardMuted95
    val fa = lang == Lang.FA
    val isLive = game.category.contains("live", ignoreCase = true)
    val categoryName = tr(lang, casinoCategoryLabel(game.category, false), casinoCategoryLabel(game.category, true))
    var imageFailed by remember(game.id) { mutableStateOf(false) }

    Surface(
        modifier = Modifier.width(315.dp).clickable(onClick = onOpen),
        shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp, cardBorder),
        color = cardBackground,
        shadowElevation = if (darkHome) 0.dp else 2.dp
    ) {
        Column {
            // The supplied artwork fills the entire upper card, edge to edge.
            // Category badges overlay the image rather than stealing artwork space.
            Box(
                modifier = Modifier.fillMaxWidth().height(246.dp)
                    .background(if (darkHome) DarkHomePalette.soft else Color(0xFFF3F6F9)),
                contentAlignment = Alignment.Center
            ) {
                if (game.imageUrl != null && !imageFailed) {
                    AsyncImage(
                        model = game.imageUrl,
                        contentDescription = game.name,
                        contentScale = ContentScale.Crop,
                        onError = { imageFailed = true },
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(Icons.Default.VideogameAsset, null,
                        tint = Color(0xFFB2BEC9), modifier = Modifier.size(48.dp))
                }

                Surface(
                    modifier = Modifier.align(Alignment.TopStart).padding(11.dp),
                    shape = RoundedCornerShape(10.dp),
                    color = if (isLive) Color(0xFFFFEAF2) else Color(0xFFE8F8F1)
                ) {
                    Text(
                        if (isLive) "LIVE" else "SLOTS",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                        color = if (isLive) Color(0xFFC71961) else Color(0xFF008957),
                        fontWeight = FontWeight.Black, fontSize = 10.sp
                    )
                }
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd).padding(11.dp),
                    shape = RoundedCornerShape(10.dp),
                    color = Color(0xE6212832)
                ) {
                    Row(
                        Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Icon(Icons.Default.Casino, null,
                            tint = Color.White, modifier = Modifier.size(14.dp))
                        Text(categoryName, color = Color.White,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            maxLines = 1)
                    }
                }
            }
            HorizontalDivider(color = cardBorder, thickness = .7.dp)
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(game.name, color = cardInk,
                    fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(categoryName + "  ·  " + game.providerName.ifBlank { game.provider },
                    color = cardMuted, fontSize = 10.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = casinoCardBlue95,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        Modifier.height(39.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(tr(lang, "View game", "مشاهده بازی"),
                            fontSize = 11.sp, color = Color.White,
                            fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.width(7.dp))
                        Icon(Icons.Default.ArrowForward, null,
                            tint = Color.White, modifier = Modifier.size(15.dp))
                    }
                }
            }
        }
    }
}
