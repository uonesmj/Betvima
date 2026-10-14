package com.betvima.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Language
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Locale picker: flags describe the language options, never a claimed user location. */
@Composable
fun LanguagePickerDialog(
    current: Lang, onSelect: (Lang) -> Unit, onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(26.dp),
        containerColor = Color.White,
        icon = {
            Icon(Icons.Default.Language, null, tint = Palette.blue,
                modifier = Modifier.size(28.dp))
        },
        title = {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(if (current == Lang.FA) "انتخاب زبان" else "Choose language",
                    modifier = Modifier.weight(1f),
                    color = Palette.text, fontWeight = FontWeight.Black,
                    fontSize = 20.sp)
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close,
                        if (current == Lang.FA) "بستن" else "Close",
                        tint = Palette.muted)
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                LocaleOption("🇮🇷", "فارسی", "Persian · راست‌به‌چپ",
                    current == Lang.FA) { onSelect(Lang.FA) }
                LocaleOption("🇬🇧", "English", "English · Left to right",
                    current == Lang.EN) { onSelect(Lang.EN) }
            }
        },
        confirmButton = {}
    )
}

@Composable
private fun LocaleOption(
    flag: String, title: String, description: String,
    selected: Boolean, onClick: () -> Unit
) {
    val background by animateColorAsState(
        if (selected) Palette.greenLight else Palette.paper, label = "localeBackground")
    Surface(color = background,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(if (selected) 1.5.dp else 1.dp,
            if (selected) Palette.green else Palette.border),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.heightIn(min = 72.dp).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text(flag, fontSize = 28.sp)
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, color = Palette.text,
                    fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                Text(description, color = Palette.muted, fontSize = 11.sp)
            }
            if (selected) Icon(Icons.Default.Check, null,
                tint = Palette.green, modifier = Modifier.size(22.dp))
        }
    }
}
