package com.betvima.app.ui

import androidx.compose.foundation.background
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

private val sheetPaper = Color.White
private val sheetCard = Color(0xFFF3F3F4)
private val sheetMuted = Color(0xFF777984)
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
    var loading by remember { mutableStateOf(false) }
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
    val knownProviders = (providers + resultProviders).filter(String::isNotBlank).distinct()
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
        Column(Modifier.fillMaxWidth().fillMaxHeight(.96f)
            .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
            .background(sheetPaper)) {
            Row(Modifier.fillMaxWidth().height(76.dp).padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(tr(lang, "Search", "جست‌وجو"),
                    fontSize = 25.sp, color = Color.Black,
                    fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close,
                        tr(lang,"Close search","بستن جست‌وجو"),
                        modifier = Modifier.size(28.dp), tint = sheetMuted)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(18.dp)).background(sheetCard)
                .padding(3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(false to tr(lang, "Games", "بازی‌ها"),
                    true to tr(lang, "Providers", "سازندگان")).forEach { (key, label) ->
                    Box(Modifier.weight(1f).height(48.dp)
                        .clip(RoundedCornerShape(15.dp))
                        .background(if (providersTab == key) Color(0xFFE6E7E9)
                            else sheetCard)
                        .clickable { providersTab = key }, contentAlignment = Alignment.Center) {
                        Text(label, color = Color.Black, fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .height(56.dp).clip(RoundedCornerShape(16.dp))
                .background(sheetCard).padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Search, null, tint = sheetMuted,
                    modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(15.dp))
                Box(Modifier.weight(1f)) {
                    if (input.isEmpty()) Text(tr(lang, "Search", "جست‌وجو"),
                        color = sheetMuted, fontSize = 16.sp)
                    BasicTextField(input,
                        onValueChange = { if (it.length <= 80) input = it },
                        textStyle = TextStyle(fontSize = 16.sp, color = Color.Black),
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
            LazyColumn(Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (providersTab) {
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
                    val filtered = if (input.isBlank()) games
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
                                    Text(title, color = Color.Black, fontSize = 18.sp,
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

@Composable
private fun SearchGroupHeading(title: String) {
    Row(Modifier.fillMaxWidth().padding(top = 9.dp, bottom = 3.dp)) {
        Surface(color = Color(0xFFF4F4F5), shape = CircleShape) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                color = Color.Black,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
        }
    }
}

@Composable
private fun ProviderSearchRow(names: List<String>, onProvider: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        names.forEach { name ->
            Column(Modifier.weight(1f).height(112.dp)
                .clip(RoundedCornerShape(23.dp)).background(sheetCard)
                .clickable { onProvider(name) }.padding(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center) {
                Text(name.take(2).uppercase(), color = sheetBlue,
                    fontWeight = FontWeight.Black, fontSize = 23.sp)
                Spacer(Modifier.height(7.dp))
                Text(name, color = Color.Black, fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold, maxLines = 2,
                    overflow = TextOverflow.Ellipsis)
            }
        }
        if (names.size == 1) Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun SearchGameCard(game: CasinoGame, onClick: () -> Unit) {
    Column(Modifier.width(123.dp).clickable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().height(159.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFFE3E5EF))) {
            if (!game.imageUrl.isNullOrBlank()) {
                AsyncImage(game.imageUrl, game.name, Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop)
            } else {
                Text(game.name, Modifier.align(Alignment.Center).padding(8.dp),
                    fontSize = 13.sp, color = Color.Black,
                    fontWeight = FontWeight.Bold)
            }
        }
        Text(game.name, fontSize = 12.sp, color = Color.Black, maxLines = 1,
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
