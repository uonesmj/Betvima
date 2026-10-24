package com.betvima.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Language
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** Compact language dialog, without country flags or excess empty space. */
@Composable
fun LanguagePickerDialog(current: Lang, onSelect: (Lang) -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxWidth(.86f)
            .heightIn(max = 570.dp)
            .clip(RoundedCornerShape(25.dp))
            .verticalScroll(rememberScrollState())
            .background(Color.White)
            .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFDBF9EB),
                        Color(0xFFE9F2FF)))), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Language, null, tint = Color(0xFF007F52),
                        modifier = Modifier.size(23.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(current, "Language", "زبان"),
                        color = Color(0xFF1C2430), fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text(tr(current, "Choose your preferred language", "زبان مورد نظر را انتخاب کنید"),
                        color = Color(0xFF687481), fontSize = 10.sp)
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(35.dp)) {
                    Icon(Icons.Default.Close,
                        tr(current,"Close","بستن"), tint = Color(0xFF87919F),
                        modifier = Modifier.size(19.dp))
                }
            }
            CompactLocaleOption("🇮🇷", "فارسی", localeNameAZ179(current, "Persian"), current == Lang.FA) {
                onSelect(Lang.FA)
            }
            CompactLocaleOption("🇬🇧", "English", localeNameAZ179(current, "English"), current == Lang.EN) {
                onSelect(Lang.EN)
            }
            CompactLocaleOption("🇹🇷", "Türkçe", localeNameAZ179(current, "Turkish"), current == Lang.TR) {
                onSelect(Lang.TR)
            }
            CompactLocaleOption("🇦🇫", "دری", localeNameAZ179(current, "Afghan Dari"), current == Lang.DARI) {
                onSelect(Lang.DARI)
            }
            CompactLocaleOption("🇦🇲", "Հայերեն", localeNameAZ179(current, "Armenian"), current == Lang.HY) {
                onSelect(Lang.HY)
            }
            CompactLocaleOption("🇸🇦", "العربية", localeNameAZ179(current, "Arabic"), current == Lang.AR) {
                onSelect(Lang.AR)
            }
            CompactLocaleOption("🇦🇿", "Azərbaycan dili", localeNameAZ179(current, "Azerbaijani"), current == Lang.AZ) {
                onSelect(Lang.AZ)
            }
            CompactLocaleOption("🇷🇺", "Русский", localeNameRU180(current, "Russian"), current == Lang.RU) {
                onSelect(Lang.RU)
            }
        }
    }
}

/** Localize language descriptions only when Azerbaijani is selected. */
private fun localeNameAZ179(lang: Lang, english: String): String =
    if (lang != Lang.AZ) english else when (english) {
        "Persian" -> "Fars dili"
        "English" -> "İngilis dili"
        "Turkish" -> "Türk dili"
        "Afghan Dari" -> "Dari dili"
        "Armenian" -> "Erməni dili"
        "Arabic" -> "Ərəb dili"
        "Azerbaijani" -> "Azərbaycan dili"
        else -> english
    }

@Composable
private fun CompactLocaleOption(
    symbol: String, title: String, subtitle: String,
    selected: Boolean, onClick: () -> Unit
) {
    val fill by animateColorAsState(
        if (selected) Color(0xFFE9FBF2) else Color(0xFFF5F7FA),
        animationSpec = tween(180), label = "compactLocaleFill")
    Surface(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .clickable(onClick = onClick),
        color = fill, shape = RoundedCornerShape(15.dp),
        border = BorderStroke(if (selected) 1.3.dp else 1.dp,
            if (selected) Color(0xFF04BF76) else Color(0xFFE5E9EE))
    ) {
        Row(Modifier.heightIn(min = 58.dp).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(35.dp).clip(RoundedCornerShape(10.dp))
                .background(if(selected) Color(0xFFD0F3E3) else Color.White),
                contentAlignment = Alignment.Center) {
                Text(symbol, color = if (selected) Color(0xFF007F52) else Color(0xFF516071),
                    fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = Color(0xFF192632),
                    fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(subtitle, color = Color(0xFF6C7985), fontSize = 10.sp)
            }
            if (selected) Box(Modifier.size(24.dp).clip(CircleShape)
                .background(Color(0xFF00BC76)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Check, null, tint = Color.White,
                    modifier = Modifier.size(16.dp))
            }
        }
    }
}
