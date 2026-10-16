package com.betvima.app.ui

import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.betvima.app.data.CasinoGame
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

private val sheetPaper = Color(0xFF141414)
private val sheetCard = Color(0xFF29292B)
private val sheetMuted = Color(0xFFA4A4AE)
private val sheetBlue = Color(0xFF0A7CFA)
private val highlightedProviders = listOf(
    "Pragmatic Play", "Evolution", "PG SOFT", "Hacksaw", "BGaming", "3 Oaks Gaming"
)

internal fun providerLetter(name: String): String {
    val first = name.trim().firstOrNull()?.uppercaseChar() ?: return "#"
    return if (first in '0'..'9') "0-9"
        else if (first in 'A'..'Z') first.toString()
        else "#"
}

@Composable
fun CasinoReferenceSearch(
    lang: Lang,
    model: AppViewModel,
    games: List<CasinoGame>,
    providers: List<String>,
    initialProviders: Boolean,
    onDismiss: () -> Unit,
    onGame: (CasinoGame) -> Unit,
    onProvider: (String) -> Unit
) {
    var providersTab by remember { mutableStateOf(initialProviders) }
    var input by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<CasinoGame>>(emptyList()) }
    var resultProviders by remember { mutableStateOf<List<String>>(emptyList()) }
    var globalProviders by remember { mutableStateOf<List<String>>(emptyList()) }
    var globalGames by remember { mutableStateOf<List<CasinoGame>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try {
            val page = model.casinoGames(1, "", "", "")
            globalProviders = page.providers
            globalGames = page.games
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            // The known cards/facets remain available during temporary outages.
        }
    }
    var failed by remember { mutableStateOf(false) }
    // All provider names are taken from the global catalogue facets.
    LaunchedEffect(input) {
        val search = input.trim()
        if (search.isBlank()) {
            results = emptyList()
            resultProviders = emptyList()
            loading = false
            failed = false
            return@LaunchedEffect
        }
        delay(300)
        loading = true
        failed = false
        try {
            val response = model.casinoGames(1, "", search, "")
            results = response.games
            resultProviders = response.providers
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            results = emptyList()
            resultProviders = emptyList()
            failed = true
        } finally {
            loading = false
        }
    }
    val knownProviders = (providers + globalProviders + resultProviders)
        .filter(String::isNotBlank).distinct()
    val matched = knownProviders.filter { it.contains(input.trim(), ignoreCase = true) }
        .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it })
    val recommended = highlightedProviders.mapNotNull { title ->
        matched.firstOrNull { it.equals(title, ignoreCase = true) }
    }.distinct()
    val otherProviders = matched.filter { it !in recommended }
    val alphabetical = otherProviders.groupBy(::providerLetter).toSortedMap(
        compareBy<String> { if (it == "0-9") "0" else it }
    )
    Dialog(onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.97f)
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(Brush.verticalGradient(listOf(
                Color(0xFF1A1A1C), sheetPaper, Color(0xFF141414)
            )))
            .border(1.dp, Color(0xFF3B3B3D),
                RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))) {
            Box(Modifier.align(Alignment.CenterHorizontally)
                .padding(top = 10.dp).width(44.dp).height(4.dp)
                .clip(CircleShape).background(Color(0xFF6B83AE)))
            Row(Modifier.fillMaxWidth().height(76.dp).padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically) {
                CasinoBrandMark(size = 27.dp)
                Spacer(Modifier.width(10.dp))
                Text(tr(lang, "Search", "جست‌وجو"),
                    fontSize = 25.sp, color = Color.White,
                    fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Surface(color = sheetCard,
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color(0xFF424244)),
                    modifier = Modifier.size(43.dp).casinoBounce(onDismiss)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Close, tr(lang,"Close search","بستن جست‌وجو"),
                            modifier = Modifier.size(24.dp), tint = Color.White)
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(18.dp)).background(sheetCard)
                .border(1.dp, Color(0xFF3B3B3D), RoundedCornerShape(18.dp))
                .padding(3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(false to tr(lang, "Games", "بازی‌ها"),
                    true to tr(lang, "Providers", "سازندگان")).forEach { (key, label) ->
                    val tabColor by animateColorAsState(
                        if (providersTab == key) sheetBlue else sheetCard,
                        animationSpec = tween(230), label = "casinoSearchSelection")
                    Box(Modifier.weight(1f).height(48.dp)
                        .clip(RoundedCornerShape(15.dp))
                        .background(tabColor)
                        .casinoBounce { providersTab = key }, contentAlignment = Alignment.Center) {
                        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .height(56.dp).clip(RoundedCornerShape(16.dp))
                .background(sheetCard)
                .border(1.dp, Color(0xFF3B3B3D), RoundedCornerShape(16.dp))
                .padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Search, null, tint = sheetMuted,
                    modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(15.dp))
                Box(Modifier.weight(1f)) {
                    if (input.isEmpty()) Text(tr(lang, "Search", "جست‌وجو"),
                        color = sheetMuted, fontSize = 16.sp)
                    BasicTextField(input,
                        onValueChange = { if (it.length <= 80) input = it },
                        textStyle = TextStyle(fontSize = 16.sp, color = Color.White),
                        singleLine = true, modifier = Modifier.fillMaxWidth())
                }
                if (input.isNotEmpty()) {
                    Icon(Icons.Default.Close, null, tint = sheetMuted,
                        modifier = Modifier.size(21.dp).clickable { input = "" })
                }
            }
            Spacer(Modifier.height(16.dp))
            if (loading) LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(), color = sheetBlue)
            Crossfade(providersTab, animationSpec = tween(220),
                label = "casinoSearchContent") { providersSelected ->
            LazyColumn(Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (providersSelected) {
                    if (input.isBlank() && recommended.isNotEmpty()) {
                        item(key = "recommended-providers-label") {
                            SearchGroupHeading(tr(lang,"Recommended","پیشنهادی"))
                        }
                        recommended.chunked(2).forEachIndexed { index, line ->
                            item(key = "recommended-providers-" + index) {
                                ProviderSearchRow(line, onProvider)
                            }
                        }
                    }
                    alphabetical.forEach { (letter, names) ->
                        item(key = "provider-group-" + letter) {
                            SearchGroupHeading(letter)
                        }
                        names.chunked(2).forEachIndexed { i, line ->
                            item(key = "provider-group-" + letter + i) {
                                ProviderSearchRow(line, onProvider)
                            }
                        }
                    }
                    if (matched.isEmpty() && !loading) {
                        item(key = "no-providers") {
                            SearchEmpty(tr(lang, "No providers found", "سازنده‌ای پیدا نشد"))
                        }
                    }
                } else {
                    val filtered = if (input.isBlank()) (games + globalGames)
                        else results
                    val realGames = filtered.distinctBy { it.id }
                    val sections = listOf(
                        Triple("original", tr(lang, "BetVima games", "بازی‌های بت‌ویما"),
                            realGames.filter(::isBetvimaOriginal)),
                        Triple("live", tr(lang, "Live casino", "کازینو زنده"),
                            realGames.filter { it.category == "live" }),
                        Triple("quick", tr(lang, "Quick games", "بازی‌های سریع"),
                            realGames.filter { it.category in setOf("instant","crash") }),
                        Triple("all", tr(lang, "All games", "همه بازی‌ها"), realGames)
                    )
                    sections.forEach { (key, title, titles) ->
                        if (titles.isNotEmpty()) {
                            item(key = "search-section-" + key) {
                                Row(Modifier.fillMaxWidth().padding(top = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Text(title, color = Color.White, fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.weight(1f))
                                    Icon(Icons.Default.ChevronRight, null, tint = sheetMuted)
                                }
                            }
                            item(key = "search-cards-" + key) {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    items(titles.take(24), key = { it.id }) { game ->
                                        SearchGameCard(game) { onGame(game) }
                                    }
                                }
                            }
                        }
                    }
                    if (realGames.isEmpty() && !loading) {
                        item(key = "no-games") {
                            SearchEmpty(if (failed) tr(lang,"Search temporarily unavailable","جست‌وجو موقتاً در دسترس نیست")
                                else tr(lang, "No games found", "بازی‌ای پیدا نشد"))
                        }
                    }
                }
            }
            }
        }
    }
}

@Composable
private fun SearchGroupHeading(title: String) {
    Row(Modifier.fillMaxWidth().padding(top = 9.dp, bottom = 3.dp)) {
        Surface(color = Color(0xFF29292B), shape = CircleShape,
            border = BorderStroke(1.dp, Color(0xFF3C3C40))) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                color = Color.White,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
        }
    }
}

@Composable
private fun ProviderSearchRow(names: List<String>, onProvider: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        names.forEach { name ->
            val brandColor = when ((name.firstOrNull()?.lowercaseChar() ?: 'a').code % 4) {
                0 -> Color(0xFF19B6FF)
                1 -> Color(0xFF00D898)
                2 -> Color(0xFFFFBA47)
                else -> Color(0xFF9A78FF)
            }
            Box(Modifier.weight(1f).height(115.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(
                    Color(0xFF313133), Color(0xFF222224))))
                .border(1.dp, brandColor.copy(alpha = .46f),
                    RoundedCornerShape(20.dp))
                .casinoBounce { onProvider(name) }) {
                Column(Modifier.fillMaxSize().padding(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center) {
                    Surface(shape = RoundedCornerShape(11.dp),
                        color = brandColor.copy(alpha = .16f),
                        border = BorderStroke(1.dp, brandColor.copy(alpha = .48f))) {
                        Text(name.trim().take(2).uppercase(), color = brandColor,
                            fontWeight = FontWeight.Black, fontSize = 21.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(name, color = Color.White, fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold, maxLines = 2,
                        overflow = TextOverflow.Ellipsis)
                }
                CasinoBrandMark(Modifier.align(Alignment.TopEnd).padding(7.dp),
                    size = 12.dp)
            }
        }
        if (names.size == 1) Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun SearchGameCard(game: CasinoGame, onClick: () -> Unit) {
    Column(Modifier.width(123.dp).casinoBounce(onClick)) {
        Box(Modifier.fillMaxWidth().height(159.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(
                Color(0xFF303032), Color(0xFF222224))))
            .border(1.dp, Color(0xFF3B3B3D), RoundedCornerShape(14.dp))) {
            if (!game.imageUrl.isNullOrBlank()) {
                AsyncImage(game.imageUrl, game.name, Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop)
            } else {
                Text(game.name, Modifier.align(Alignment.Center).padding(8.dp),
                    fontSize = 13.sp, color = Color.White,
                    fontWeight = FontWeight.Bold)
            }
        }
        Text(game.name, fontSize = 12.sp, color = Color.White, maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun SearchEmpty(text: String) {
    Box(Modifier.fillMaxWidth().height(90.dp), contentAlignment = Alignment.Center) {
        Text(text, fontSize = 13.sp, color = sheetMuted)
    }
}

internal fun isBetvimaOriginal(game: CasinoGame): Boolean =
    game.provider.equals("betvima", ignoreCase = true) ||
        game.providerName.equals("betvima", ignoreCase = true)
