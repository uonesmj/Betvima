package com.betvima.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties
import com.betvima.app.data.Match
import kotlinx.coroutines.delay

/**
 * Native sportsbook search. Results are returned by GET /api/v1/matches?q=...;
 * no fake suggestions or browser redirect. Live/prematch are queried separately.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NativeSearchSheet(
    state: AppState,
    model: AppViewModel,
    onDismiss: () -> Unit
) {
    var query by rememberSaveable { mutableStateOf(state.searchTerm) }
    val field = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(query) {
        delay(320)
        model.searchMatches(query)
    }
    LaunchedEffect(Unit) {
        delay(220)
        runCatching { field.requestFocus() }
    }

    ModalBottomSheet(
        onDismissRequest = { model.clearSearch(); onDismiss() },
        containerColor = Palette.paper,
        shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        dragHandle = {
            Box(Modifier.padding(top = 12.dp, bottom = 6.dp)
                .width(42.dp).height(4.dp)
                .background(Palette.muted.copy(alpha = .35f), RoundedCornerShape(99.dp)))
        }
    ) {
        Column(Modifier.fillMaxWidth().imePadding()
            .heightIn(max = 700.dp)
            .padding(horizontal = 15.dp, vertical = 7.dp)) {
            Row(Modifier.fillMaxWidth().background(
                Brush.horizontalGradient(listOf(Palette.ink, Color(0xFF183A3C))),
                    RoundedCornerShape(21.dp))
                .padding(horizontal = 13.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Surface(color = Palette.green.copy(alpha = .18f),
                    shape = RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.Search, null, tint = Palette.green,
                        modifier = Modifier.padding(11.dp).size(22.dp))
                }
                Spacer(Modifier.width(9.dp))
                Text(tr(state.lang, "Search BetVima", "جست‌وجو در بت‌ویما"),
                    modifier = Modifier.weight(1f), fontWeight = FontWeight.Black,
                    fontSize = 20.sp, color = Color.White)
                IconButton(onClick = { model.clearSearch(); onDismiss() }) {
                    Icon(Icons.Default.Close, tr(state.lang, "Close", "بستن"),
                        tint = Color.White)
                }
            }
            OutlinedTextField(
                value = query, onValueChange = { query = it.take(80) },
                modifier = Modifier.fillMaxWidth().focusRequester(field),
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = Palette.green,
                    unfocusedBorderColor = Palette.border,
                    cursorColor = Palette.blue),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                leadingIcon = { Icon(Icons.Default.Search, null, tint = Palette.blue) },
                placeholder = { Text(tr(state.lang,
                    "Team, fixture or league", "نام تیم، مسابقه یا لیگ"),
                    fontSize = 12.sp) },
                trailingIcon = {
                    if (query.isNotBlank()) IconButton(onClick = { query = "" }) {
                        Icon(Icons.Default.Close, tr(state.lang, "Clear search", "پاک کردن"))
                    }
                }
            )
            Spacer(Modifier.height(17.dp))
            AnimatedContent(
                targetState = when {
                    query.trim().length < 2 -> "hint"
                    state.searchLoading || state.searchTerm != query.trim() -> "loading"
                    state.searchError != null -> "error"
                    state.searchLive.isEmpty() && state.searchUpcoming.isEmpty() -> "empty"
                    else -> "results"
                },
                label = "searchContent",
                transitionSpec = {
                    (fadeIn() + expandVertically()).togetherWith(fadeOut() + shrinkVertically())
                }
            ) { mode ->
                when (mode) {
                    "hint" -> SearchHint(state.lang, tr(state.lang,
                        "Type at least 2 characters to search every listed match.",
                        "برای جست‌وجوی مسابقات، حداقل دو حرف وارد کنید."))
                    "loading" -> Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        repeat(2) { FixtureSkeleton() }
                    }
                    "error" -> EmptyPanel(tr(state.lang,
                        "Search temporarily unavailable", "جست‌وجو در دسترس نیست"),
                        state.searchError.orEmpty()) { model.searchMatches(query) }
                    "empty" -> EmptyPanel(tr(state.lang,
                        "No matches found", "مسابقه‌ای پیدا نشد"),
                        tr(state.lang, "Try another team or league.",
                            "نام تیم یا لیگ دیگری را جست‌وجو کنید."))
                    else -> LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 16.dp)
                    ) {
                        if (state.searchLive.isNotEmpty()) {
                            item { SearchSection(tr(state.lang, "Live", "زنده"),
                                state.searchLive.size, Palette.red) }
                            items(state.searchLive, key = { "live-${it.id}" }) { match ->
                                SearchResultCard(match, state.lang, onClick = {
                                    keyboard?.hide()
                                    model.clearSearch()
                                    onDismiss()
                                    model.openMatch(match.id)
                                })
                            }
                        }
                        if (state.searchUpcoming.isNotEmpty()) {
                            item { SearchSection(tr(state.lang, "Upcoming", "آینده"),
                                state.searchUpcoming.size, Palette.blue) }
                            items(state.searchUpcoming, key = { "pre-${it.id}" }) { match ->
                                SearchResultCard(match, state.lang, onClick = {
                                    keyboard?.hide()
                                    model.clearSearch()
                                    onDismiss()
                                    model.openMatch(match.id)
                                })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchHint(lang: Lang, message: String) {
    BvInformationStrip(message, Icons.Default.Info, accent = Palette.blue)
}

@Composable
private fun SearchSection(title: String, count: Int, color: Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(color, RoundedCornerShape(4.dp)))
        Spacer(Modifier.width(8.dp))
        Text(title, fontWeight = FontWeight.ExtraBold, color = Palette.text,
            fontSize = 14.sp, modifier = Modifier.weight(1f))
        SmallPill(count.toString(), Palette.paper, Palette.text)
    }
}

@Composable
private fun SearchResultCard(match: Match, lang: Lang, onClick: () -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 3.dp,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(match.league, fontSize = 10.sp, color = Palette.muted,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(5.dp))
                Text(match.home.name + "  –  " + match.away.name,
                    fontSize = 13.sp, color = Palette.text,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(5.dp))
                Text(if (match.live)
                    tr(lang, "Live", "زنده") +
                        (match.minute?.let { " · ${it}′" } ?: "")
                    else match.starts.take(16).replace("T", " · "),
                    color = if (match.live) Palette.red else Palette.muted,
                    fontSize = 11.sp)
            }
            Spacer(Modifier.width(10.dp))
            Icon(Icons.Default.ChevronRight,
                contentDescription = tr(lang, "View match", "مشاهده بازی"),
                tint = Palette.blue)
        }
    }
}
