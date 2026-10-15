package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.Match

/** Competition selector backed exclusively by live catalogue data. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumTournamentSheet(
    lang: Lang,
    groups: Map<String, List<Match>>,
    selected: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var search by rememberSaveable { mutableStateOf("") }
    val visible = remember(groups, search) {
        groups.entries.filter { entry ->
            val fixture = entry.value.firstOrNull()
            search.isBlank() || fixture?.league?.contains(search.trim(), ignoreCase = true) == true ||
                fixture?.country?.contains(search.trim(), ignoreCase = true) == true
        }.sortedBy { it.value.firstOrNull()?.league.orEmpty() }
    }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val animatedDismiss: () -> Unit = {
        scope.launch {
            sheetState.hide()
            onDismiss()
        }
    }
    ModalBottomSheet(
        onDismissRequest = animatedDismiss,
        sheetState = sheetState,
        containerColor = Palette.paper,
        shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
        dragHandle = {
            Box(Modifier.padding(top = 11.dp, bottom = 8.dp)
                .width(42.dp).height(4.dp).background(Palette.muted.copy(alpha = .4f),
                    RoundedCornerShape(99.dp)))
        }
    ) {
        Column(Modifier.fillMaxWidth().imePadding().heightIn(max = 700.dp)) {
            Box(Modifier.fillMaxWidth().background(
                Brush.horizontalGradient(listOf(Palette.ink, Color(0xFF183B3E))))
                .padding(horizontal = 21.dp, vertical = 23.dp)) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Palette.green.copy(alpha = .16f),
                            shape = RoundedCornerShape(15.dp),
                            border = BorderStroke(1.dp, Palette.green.copy(alpha = .32f))) {
                            Icon(Icons.Default.EmojiEvents, null,
                                tint = Palette.green,
                                modifier = Modifier.padding(12.dp).size(24.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang, "CHOOSE A TOURNAMENT", "انتخاب رقابت"),
                                color = Color.White, fontSize = 19.sp,
                                fontWeight = FontWeight.Black)
                            Spacer(Modifier.height(3.dp))
                            Text(tr(lang, "Explore competitions", "جست‌وجوی لیگ‌ها و مسابقات"),
                                color = Color(0xFFBACAD0), fontSize = 11.sp)
                        }
                        IconButton(onClick = animatedDismiss) {
                            Icon(Icons.Default.Close, tr(lang, "Close", "بستن"),
                                tint = Color.White)
                        }
                    }
                    Spacer(Modifier.height(17.dp))
                    OutlinedTextField(
                        value = search, onValueChange = { search = it.take(70) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true, shape = RoundedCornerShape(16.dp),
                        leadingIcon = {
                            Icon(Icons.Default.Search, null, tint = Palette.green)
                        },
                        placeholder = { Text(tr(lang, "Search leagues or countries",
                            "جست‌وجوی لیگ یا کشور"), fontSize = 12.sp) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                            focusedBorderColor = Palette.green,
                            unfocusedBorderColor = Color.White.copy(alpha = .2f),
                            focusedPlaceholderColor = Color(0xFFBBC6D2),
                            unfocusedPlaceholderColor = Color(0xFFBBC6D2),
                            cursorColor = Palette.green)
                    )
                }
            }
            Text(tr(lang, "AVAILABLE COMPETITIONS", "رقابت‌های موجود"),
                color = Palette.muted, fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(start = 21.dp, end = 21.dp,
                    top = 18.dp, bottom = 8.dp))
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 15.dp, vertical = 5.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item(key = "all") {
                    PremiumLeagueChoice(
                        name = tr(lang, "All competitions", "تمام رقابت‌ها"),
                        subtitle = tr(lang, "Every available league", "نمایش تمام لیگ‌ها"),
                        count = groups.values.sumOf { it.size },
                        checked = selected.isEmpty(),
                        onClick = { onSelect(""); animatedDismiss() })
                }
                items(visible, key = { it.key }) { entry ->
                    val first = entry.value.first()
                    PremiumLeagueChoice(
                        name = first.league,
                        subtitle = first.country,
                        count = entry.value.size,
                        checked = selected == entry.key,
                        onClick = { onSelect(entry.key); animatedDismiss() })
                }
                if (visible.isEmpty()) item {
                    Text(tr(lang, "No competition matches your search.",
                        "رقابتی مطابق جست‌وجو پیدا نشد."),
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        color = Palette.muted)
                }
            }
        }
    }
}

@Composable
private fun PremiumLeagueChoice(name: String, subtitle: String, count: Int,
    checked: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(17.dp),
        color = if (checked) Color(0xFFE3FFF2) else Color.White,
        border = BorderStroke(if (checked) 1.5.dp else 1.dp,
            if (checked) Palette.green else Palette.border),
        shadowElevation = if (checked) 3.dp else 1.dp
    ) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = if (checked) Palette.green else Palette.subtle,
                shape = CircleShape) {
                Icon(if (checked) Icons.Default.Check else Icons.Default.EmojiEvents, null,
                    tint = if (checked) Palette.ink else Palette.blue,
                    modifier = Modifier.padding(11.dp).size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(name, color = Palette.text, fontWeight = FontWeight.ExtraBold,
                    fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (subtitle.isNotBlank()) Text(subtitle, color = Palette.muted,
                    fontSize = 11.sp, maxLines = 1)
            }
            Text(count.toString(), fontSize = 11.sp,
                color = Palette.muted, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.ChevronRight, null, tint = Palette.blue,
                modifier = Modifier.size(18.dp))
        }
    }
}
