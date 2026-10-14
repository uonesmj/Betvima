package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Native casino lobby presentation. No fabricated games, rounds, or payouts:
 * cards remain non-interactive until an approved source supplies an actual catalogue.
 */
@Composable
fun CasinoLobby(lang: Lang) {
    LazyColumn(
        contentPadding = PaddingValues(BvSpace.screen),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BvPageBanner(
                eyebrow = tr(lang, "BETVIMA CASINO", "کازینو بت‌ویما"),
                title = tr(lang, "Discover the casino", "دنیای بازی‌های کازینو"),
                subtitle = tr(lang,
                    "A dedicated native lobby designed for approved games.",
                    "لابی اختصاصی اندروید برای نمایش بازی‌های معتبر و تأییدشده."),
                icon = Icons.Default.Casino,
                accent = Palette.gold
            ) {
                Spacer(Modifier.height(6.dp))
                SmallPill(tr(lang, "CATALOGUE PENDING", "در انتظار اتصال بازی‌ها"),
                    Palette.gold.copy(alpha = .2f), Palette.gold)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BvStatCard(tr(lang, "Casino currency", "ارز کازینو"),
                    "USD", Icons.Default.AttachMoney, Palette.blue,
                    Modifier.weight(1f))
                BvStatCard(tr(lang, "Minimum bet", "حداقل شرط"),
                    "$0.20", Icons.Default.Casino, Palette.green,
                    Modifier.weight(1f))
            }
        }
        item {
            SectionHeading(tr(lang, "Game categories", "دسته‌بندی بازی‌ها"),
                tr(lang, "Only approved games can be launched.",
                    "فقط بازی‌های تأییدشده قابلیت اجرا خواهند داشت."))
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                CasinoCategoryCard(
                    tr(lang, "Slots", "اسلات"),
                    Icons.Default.Casino, lang, Modifier.weight(1f))
                CasinoCategoryCard(
                    tr(lang, "Live casino", "کازینوی زنده"),
                    Icons.Default.Sensors, lang, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                CasinoCategoryCard(
                    tr(lang, "Table games", "بازی‌های رومیزی"),
                    Icons.Default.Style, lang, Modifier.weight(1f))
                CasinoCategoryCard(
                    tr(lang, "Other games", "سایر بازی‌ها"),
                    Icons.Default.Games, lang, Modifier.weight(1f))
            }
        }
        item {
            BvInformationStrip(
                tr(lang,
                    "Game integration is not yet active. No bet can be made from this lobby. All displayed real-money amounts will be in USD after approval.",
                    "اتصال بازی‌ها هنوز فعال نشده است. از این صفحه امکان ثبت شرط وجود ندارد. مبالغ واقعی پس از تأیید اتصال با دلار نمایش داده می‌شوند."),
                icon = Icons.Default.Info,
                accent = Palette.blue)
        }
        item { ResponsibleNote(lang) }
    }
}

@Composable
private fun CasinoCategoryCard(title: String, icon: ImageVector, lang: Lang,
    modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        color = Color.White,
        shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, Palette.border),
        shadowElevation = 1.dp
    ) {
        Column(Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(color = Palette.paper, shape = RoundedCornerShape(14.dp)) {
                Icon(icon, null, tint = Palette.blue,
                    modifier = Modifier.padding(14.dp).size(28.dp))
            }
            Text(title, color = Palette.text,
                fontSize = 14.sp, fontWeight = FontWeight.Black)
            SmallPill(tr(lang, "Not available", "فعلاً غیرفعال"),
                Palette.paper, Palette.muted)
        }
    }
}
