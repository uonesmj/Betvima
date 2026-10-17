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
import androidx.compose.ui.graphics.Brush
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
    var games by remember { mutableStateOf<List<CasinoGame>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        loading = true
        // Load each vertical separately: the first general catalogue page may
        // consist entirely of slots, hiding all live-dealer games.
        val slots = try {
            model.casinoGames(1, "slots", "", "").games.take(4)
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            emptyList()
        }
        val live = try {
            model.casinoGames(1, "live", "", "").games.take(4)
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            emptyList()
        }
        games = (slots + live).distinctBy { it.id }
        loading = false
    }

    if (loading) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(end = 1.dp)) {
            items(2) {
                Surface(
                    modifier = Modifier.width(315.dp).height(250.dp),
                    color = Color.White,
                    shape = RoundedCornerShape(21.dp),
                    border = BorderStroke(1.dp, casinoCardBorder95)
                ) {
                    Box(Modifier.fillMaxSize().background(Color(0xFFF3F6F9)))
                }
            }
        }
    } else if (games.isEmpty()) {
        Surface(color = Color.White, shape = RoundedCornerShape(21.dp),
            border = BorderStroke(1.dp, casinoCardBorder95)) {
            Text(tr(lang, "Casino games are temporarily unavailable.",
                "بازی‌های کازینو فعلاً در دسترس نیستند."),
                modifier = Modifier.fillMaxWidth().padding(22.dp),
                color = casinoCardMuted95, fontSize = 12.sp)
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
    val fa = lang == Lang.FA
    val isLive = game.category.contains("live", ignoreCase = true)
    val categoryName = casinoCategoryLabel(game.category, fa)
    var imageFailed by remember(game.id) { mutableStateOf(false) }
    Surface(
        modifier = Modifier.width(315.dp).clickable(onClick = onOpen),
        shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp, casinoCardBorder95),
        color = Color.White,
        shadowElevation = 2.dp
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(
                        listOf(Color(0xFFF1F7F9), Color(0xFFFCFDFE))))
                    .padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    modifier = Modifier.size(34.dp),
                    color = Color.White,
                    shape = RoundedCornerShape(11.dp),
                    border = BorderStroke(1.dp, casinoCardBorder95)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Casino, null, tint = casinoCardBlue95,
                            modifier = Modifier.size(21.dp))
                    }
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(game.providerName.ifBlank { game.provider },
                        color = casinoCardInk95, fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Text(categoryName, color = casinoCardMuted95,
                        fontSize = 9.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                }
                Surface(
                    color = if (isLive) Color(0xFFFFEAF2) else Color(0xFFE8F8F1),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(if (isLive) "LIVE" else "SLOTS",
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 7.dp),
                        color = if (isLive) Color(0xFFC71961) else Color(0xFF008957),
                        fontWeight = FontWeight.Black, fontSize = 10.sp)
                }
            }
            HorizontalDivider(color = casinoCardBorder95, thickness = .7.dp)
            Box(Modifier.fillMaxWidth().height(138.dp).background(Color(0xFFF3F6F9)),
                contentAlignment = Alignment.Center) {
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
                        tint = Color(0xFFB2BEC9), modifier = Modifier.size(42.dp))
                }
            }
            HorizontalDivider(color = casinoCardBorder95, thickness = .7.dp)
            Column(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(game.name, color = casinoCardInk95,
                    fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(categoryName + "  ·  " + game.providerName,
                    color = casinoCardMuted95, fontSize = 10.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Surface(
                    color = casinoCardBlue95,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(Modifier.height(39.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically) {
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
