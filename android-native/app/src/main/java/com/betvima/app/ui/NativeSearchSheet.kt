package com.betvima.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val searchBg = Color(0xFFE9EAEF)
private val searchText = Color(0xFF23252A)
private val searchGray = Color(0xFF747985)

internal fun searchKickoff(value: String, zone: ZoneId = ZoneId.systemDefault()): String =
    runCatching {
        DateTimeFormatter.ofPattern("HH:mm • dd/MM/yyyy", Locale.UK)
            .format(Instant.parse(value).atZone(zone))
    }.getOrElse {
        runCatching {
            DateTimeFormatter.ofPattern("HH:mm • dd/MM/yyyy", Locale.UK)
                .format(LocalDateTime.parse(value))
        }.getOrElse { value.take(16).replace("T", " • ").ifBlank { "—" } }
    }

/**
 * Reference-inspired full-screen search inside the existing Scaffold.
 * The main BetVima header and bottom nav stay visible, just like the reference.
 * No WebView or fake odds. Both result sections use server-side catalogue queries.
 */
@Composable
fun NativeSearchSheet(state: AppState, model: AppViewModel, onDismiss: () -> Unit) {
    var query by rememberSaveable { mutableStateOf(state.searchTerm) }
    val field = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(query) {
        delay(300)
        model.searchMatches(query)
    }
    LaunchedEffect(Unit) {
        delay(150)
        runCatching { field.requestFocus() }
    }
    val close: () -> Unit = {
        keyboard?.hide()
        model.clearSearch()
        onDismiss()
    }
    val openMatch: (String) -> Unit = { id ->
        keyboard?.hide()
        model.clearSearch()
        onDismiss()
        model.openMatch(id)
    }

    Column(Modifier.fillMaxSize().background(searchBg).imePadding()) {
        Box(
            Modifier.fillMaxWidth().height(66.dp).padding(horizontal = 17.dp),
            contentAlignment = Alignment.Center
        ) {
            IconButton(onClick = close, modifier = Modifier.align(Alignment.CenterStart)) {
                Icon(Icons.Default.ArrowBack,
                    tr(state.lang, "Back", "بازگشت"), tint = searchText)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Search, null, tint = searchGray,
                    modifier = Modifier.size(21.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(state.lang, "Search", "جست‌وجو"), color = searchText,
                    fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(80) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                .heightIn(min = 59.dp).focusRequester(field),
            singleLine = true, shape = RoundedCornerShape(16.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
            leadingIcon = {
                Icon(Icons.Default.Search, null, tint = Color(0xFF89919F))
            },
            trailingIcon = {
                if (query.isNotBlank()) IconButton(onClick = { query = "" }) {
                    Icon(Icons.Default.Cancel, tr(state.lang, "Clear", "پاک کردن"),
                        modifier = Modifier.size(20.dp), tint = searchGray)
                }
            },
            placeholder = {
                Text(tr(state.lang, "Team, league or match", "نام تیم، لیگ یا مسابقه"),
                    color = searchGray, fontSize = 14.sp)
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color(0xFFDFE2E9),
                unfocusedContainerColor = Color(0xFFDFE2E9),
                focusedBorderColor = Color(0xFF248CFA),
                unfocusedBorderColor = Color(0xFFB8C0CC),
                focusedTextColor = searchText,
                unfocusedTextColor = searchText,
                cursorColor = Color(0xFF248CFA)
            )
        )
        Spacer(Modifier.height(15.dp))

        val pending = query.trim() != state.searchTerm || state.searchLoading
        val ready = query.trim().length >= 2
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
            flingBehavior = rememberPremiumFlingBehavior()
        ) {
            when {
                !ready -> item(key = "hint") {
                    Text(tr(state.lang,
                        "Enter at least two characters to search live and upcoming matches.",
                        "برای جست‌وجوی مسابقات زنده و آینده حداقل دو حرف وارد کنید."),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                        color = searchGray, fontSize = 13.sp)
                }
                pending -> items(3, key = { "loading-$it" }) {
                    FixtureSkeleton()
                }
                state.searchError != null -> item(key = "error") {
                    EmptyPanel(tr(state.lang, "Search unavailable", "جست‌وجو در دسترس نیست"),
                        state.searchError) { model.searchMatches(query) }
                }
                state.searchLive.isEmpty() && state.searchUpcoming.isEmpty() ->
                    item(key = "empty") {
                        EmptyPanel(tr(state.lang, "No matches found", "مسابقه‌ای پیدا نشد"),
                            tr(state.lang, "Try another team or league.",
                                "نام تیم یا لیگ دیگری را جست‌وجو کنید."))
                    }
                else -> {
                    if (state.searchLive.isNotEmpty()) {
                        item(key = "live-header", contentType = "section") {
                            SearchResultSection(
                                tr(state.lang, "Live", "زنده"), state.searchLive.size,
                                Color(0xFFED0064), true)
                        }
                        items(state.searchLive, key = { "live-${it.id}" }, contentType = { "fixture" }) { match ->
                            PremiumFixtureCard(match, state, model, onOpen = openMatch)
                        }
                    }
                    if (state.searchUpcoming.isNotEmpty()) {
                        item(key = "upcoming-header", contentType = "section") {
                            SearchResultSection(
                                tr(state.lang, "Upcoming", "بازی‌های آینده"),
                                state.searchUpcoming.size, Color(0xFF02C76C), false)
                        }
                        items(state.searchUpcoming, key = { "pre-${it.id}" }, contentType = { "fixture" }) { match ->
                            PremiumFixtureCard(match, state, model, onOpen = openMatch)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchResultSection(label: String, count: Int, color: Color, live: Boolean) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(30.dp).background(color, RoundedCornerShape(9.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(if (live) Icons.Default.Sensors else Icons.Default.Event,
                null, modifier = Modifier.size(19.dp), tint = Color.White)
        }
        Spacer(Modifier.width(10.dp))
        Text(label, fontWeight = FontWeight.Black, fontSize = 18.sp, color = searchText)
        Spacer(Modifier.width(8.dp))
        Text(count.toString(), fontSize = 11.sp, color = searchGray)
    }
}

