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

/** Dark native locale picker with accessible contrast and persistent selection. */
@Composable
fun LanguagePickerDialog(current: Lang, onSelect: (Lang) -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxWidth(.91f)
            .heightIn(max = 610.dp)
            .clip(RoundedCornerShape(26.dp))
            .verticalScroll(rememberScrollState())
            .background(Brush.verticalGradient(listOf(Color(0xFF1D2230), Color(0xFF11141B))))
            .padding(horizontal = 17.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF163F3B),
                        Color(0xFF163454)))), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Language, null, tint = Color(0xFF20D9A4),
                        modifier = Modifier.size(23.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(current, "Language", "زبان"),
                        color = Color(0xFFF8FAFF), fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text(tr(current, "Choose your preferred language", "زبان مورد نظر را انتخاب کنید"),
                        color = Color(0xFFBBC5D4), fontSize = 10.sp)
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(35.dp)) {
                    Icon(Icons.Default.Close,
                        tr(current,"Close","بستن"), tint = Color(0xFFD4DCEC),
                        modifier = Modifier.size(19.dp))
                }
            }
            CompactLocaleOption("🇮🇷", "فارسی", localeName180(current, "Persian"), current == Lang.FA) {
                onSelect(Lang.FA)
            }
            CompactLocaleOption("🇬🇧", "English", localeName180(current, "English"), current == Lang.EN) {
                onSelect(Lang.EN)
            }
            CompactLocaleOption("🇹🇷", "Türkçe", localeName180(current, "Turkish"), current == Lang.TR) {
                onSelect(Lang.TR)
            }
            CompactLocaleOption("🇦🇫", "دری", localeName180(current, "Afghan Dari"), current == Lang.DARI) {
                onSelect(Lang.DARI)
            }
            CompactLocaleOption("🇦🇲", "Հայերեն", localeName180(current, "Armenian"), current == Lang.HY) {
                onSelect(Lang.HY)
            }
            CompactLocaleOption("🇸🇦", "العربية", localeName180(current, "Arabic"), current == Lang.AR) {
                onSelect(Lang.AR)
            }
            CompactLocaleOption("🇦🇿", "Azərbaycan dili", localeName180(current, "Azerbaijani"), current == Lang.AZ) {
                onSelect(Lang.AZ)
            }
            CompactLocaleOption("🇷🇺", "Русский", localeName180(current, "Russian"), current == Lang.RU) {
                onSelect(Lang.RU)
            }
        }
    }
}

/** Labels translated only; row geometry, icon and selection state do not change. */
private fun localeName180(lang: Lang, english: String): String =
    if (lang == Lang.RU) when (english) {
        "Persian" -> "Персидский"
        "English" -> "Английский"
        "Turkish" -> "Турецкий"
        "Afghan Dari" -> "Дари"
        "Armenian" -> "Армянский"
        "Arabic" -> "Арабский"
        "Azerbaijani" -> "Азербайджанский"
        "Russian" -> "Русский"
        else -> english
    } else if (lang != Lang.AZ) english else when (english) {
        "Persian" -> "Fars dili"
        "English" -> "İngilis dili"
        "Turkish" -> "Türk dili"
        "Afghan Dari" -> "Dari dili"
        "Armenian" -> "Erməni dili"
        "Arabic" -> "Ərəb dili"
        "Azerbaijani" -> "Azərbaycan dili"
        "Russian" -> "Rus dili"
        else -> english
    }

@Composable
private fun CompactLocaleOption(
    symbol: String, title: String, subtitle: String,
    selected: Boolean, onClick: () -> Unit
) {
    val fill by animateColorAsState(
        if (selected) Color(0xFF123D36) else Color(0xFF232833),
        animationSpec = tween(180), label = "compactLocaleFill")
    Surface(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .clickable(onClick = onClick),
        color = fill, shape = RoundedCornerShape(15.dp),
        border = BorderStroke(if (selected) 1.3.dp else 1.dp,
            if (selected) Color(0xFF20D9A4) else Color(0xFF424958))
    ) {
        Row(Modifier.heightIn(min = 64.dp).padding(horizontal = 13.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(35.dp).clip(RoundedCornerShape(10.dp))
                .background(if(selected) Color(0xFF174D43) else Color(0xFF313744)),
                contentAlignment = Alignment.Center) {
                Text(symbol, color = if (selected) Color(0xFF007F52) else Color(0xFFCDDAE9),
                    fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = Color(0xFFF7FAFF),
                    fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(subtitle, color = Color(0xFFB5C0D0), fontSize = 10.sp)
            }
            if (selected) Box(Modifier.size(24.dp).clip(CircleShape)
                .background(Color(0xFF00C991)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Check, null, tint = Color.White,
                    modifier = Modifier.size(16.dp))
            }
        }
    }
}
