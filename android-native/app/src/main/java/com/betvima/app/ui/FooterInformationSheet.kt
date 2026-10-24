package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val infoBackground = Color(0xFF111113)
private val infoPanel = Color(0xFF222327)
private val infoOutline = Color(0xFF363B42)
private val infoInk = Color(0xFFF4F6F9)
private val infoMuted = Color(0xFFA5AEBB)
private val infoBlue = Color(0xFF087FF5)
private val infoMint = Color(0xFF56E4AE)

private fun infoIcon(id: String): ImageVector = when (id) {
    "terms" -> Icons.Default.Gavel
    "privacy" -> Icons.Default.VerifiedUser
    "responsible" -> Icons.Default.HealthAndSafety
    else -> Icons.Default.MenuBook
}

private fun infoText(lang: Lang, en: String, fa: String): String =
    tr(lang, en, fa)

/**
 * Four long-form native reading experiences. Official website policies remain
 * linked as sources. None of this affects wagering, wallet or account logic.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FooterInformationSheet(
    id: String, lang: Lang, onDismiss: () -> Unit
) {
    val article = remember(id) { footerInfoArticle(id) } ?: return
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val uri = LocalUriHandler.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = infoBackground,
        contentColor = infoInk,
        scrimColor = Color.Black.copy(alpha = .78f),
        shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
        dragHandle = {
            Box(
                Modifier.padding(top = 13.dp, bottom = 10.dp)
                    .size(width = 40.dp, height = 4.dp)
                    .clip(CircleShape).background(Color(0xFF626873))
            )
        }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.92f).navigationBarsPadding()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(Modifier.size(47.dp).clip(RoundedCornerShape(15.dp))
                    .background(Color(0xFF163955)), contentAlignment = Alignment.Center) {
                    Icon(infoIcon(id), null, tint = Color(0xFF80C7FF),
                        modifier = Modifier.size(23.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text((RussianFooter180.article(lang, article,  "title") ?: AzerbaijaniFooter179.article(lang, article,  "title") ?: FooterArabic175.article(lang, article,  "title") ?: FooterArmenian173.article(lang, article,  "title") ?: FooterTurkish170.article(lang, article, "title") ?: infoText(lang, article.titleEn, article.titleFa)),
                        color = infoInk, fontSize = 19.sp, fontWeight = FontWeight.Black,
                        maxLines = 2, lineHeight = 25.sp,
                        overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(3.dp))
                    Text((RussianFooter180.article(lang, article,  "subtitle") ?: AzerbaijaniFooter179.article(lang, article,  "subtitle") ?: FooterArabic175.article(lang, article,  "subtitle") ?: FooterArmenian173.article(lang, article,  "subtitle") ?: FooterTurkish170.article(lang, article, "subtitle") ?: infoText(lang, article.subtitleEn, article.subtitleFa)),
                        color = infoMuted, fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold, letterSpacing = .5.sp, maxLines = 2)
                }
                Surface(
                    modifier = Modifier.size(40.dp).clickable(onClick = onDismiss),
                    shape = RoundedCornerShape(13.dp), color = infoPanel,
                    border = BorderStroke(1.dp, infoOutline)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Close, infoText(lang, "Close", "بستن"),
                            tint = infoInk, modifier = Modifier.size(21.dp))
                    }
                }
            }
            val progress by remember(article) {
                derivedStateOf {
                    val count = (article.sections.size + 3).coerceAtLeast(1)
                    (listState.firstVisibleItemIndex.toFloat() / count).coerceIn(0f, 1f)
                }
            }
            LinearProgressIndicator(progress = { progress },
                modifier = Modifier.fillMaxWidth().height(2.dp),
                color = infoBlue, trackColor = infoOutline)

            LazyColumn(
                modifier = Modifier.fillMaxSize(), state = listState,
                contentPadding = PaddingValues(start = 17.dp, end = 17.dp,
                    top = 15.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(13.dp),
                flingBehavior = rememberPremiumFlingBehavior()
            ) {
                item(key = "hero") {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                            .background(Brush.linearGradient(listOf(
                                Color(0xFF102A45), Color(0xFF142337), infoPanel)))
                            .border(1.dp, Color(0xFF285378), RoundedCornerShape(22.dp))
                            .padding(19.dp),
                        verticalArrangement = Arrangement.spacedBy(13.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Color(0xFF204367),
                                shape = RoundedCornerShape(8.dp)) {
                                Text(tr(LocalNativeLanguage176.current, "BETVIMA / GUIDE", "BETVIMA / GUIDE"), color = Color(0xFFBBDCF9),
                                    fontWeight = FontWeight.ExtraBold, fontSize = 9.sp,
                                    letterSpacing = .6.sp,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
                            }
                            Spacer(Modifier.weight(1f))
                            Icon(Icons.Default.AutoAwesome, null, tint = infoMint,
                                modifier = Modifier.size(21.dp))
                        }
                        Text((RussianFooter180.article(lang, article,  "summary") ?: AzerbaijaniFooter179.article(lang, article,  "summary") ?: FooterArabic175.article(lang, article,  "summary") ?: FooterArmenian173.article(lang, article,  "summary") ?: FooterTurkish170.article(lang, article, "summary") ?: infoText(lang, article.summaryEn, article.summaryFa)),
                            color = infoInk, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                            lineHeight = 23.sp)
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.CheckCircle, null,
                                tint = infoMint, modifier = Modifier.size(15.dp))
                            Text(infoText(lang, "Detailed • Read in the app",
                                "راهنمای جامع • مطالعه در اپ"),
                                color = Color(0xFFBED0E0), fontSize = 10.sp)
                            Spacer(Modifier.weight(1f))
                            Text(article.sections.size.toString() + " " +
                                infoText(lang, "sections", "بخش"),
                                color = Color(0xFFBED0E0), fontSize = 10.sp,
                                fontWeight = FontWeight.Bold)
                        }
                    }
                }

                item(key = "index") {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.ListAlt, null, tint = infoBlue,
                                modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(7.dp))
                            Text(infoText(lang, "QUICK NAVIGATION", "دسترسی سریع به موضوعات"),
                                color = infoMuted, fontSize = 10.sp,
                                fontWeight = FontWeight.Black, letterSpacing = .65.sp)
                        }
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 1.dp),
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            itemsIndexed(article.sections) { index, section ->
                                Surface(shape = RoundedCornerShape(12.dp), color = infoPanel,
                                    border = BorderStroke(1.dp, infoOutline),
                                    modifier = Modifier.clickable {
                                        scope.launch { listState.animateScrollToItem(index + 3) }
                                    }) {
                                    Row(Modifier.padding(horizontal = 11.dp, vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically) {
                                        Text((index + 1).toString().padStart(2, '0'),
                                            color = Color(0xFF80C7FF),
                                            fontWeight = FontWeight.ExtraBold, fontSize = 10.sp)
                                        Spacer(Modifier.width(7.dp))
                                        Text((RussianFooter180.section(lang, section,  true) ?: AzerbaijaniFooter179.section(lang, section,  true) ?: FooterArabic175.section(lang, section,  true) ?: FooterArmenian173.section(lang, section,  true) ?: FooterTurkish170.section(lang, section, true) ?: infoText(lang, section.headingEn, section.headingFa)),
                                            color = infoInk, fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium, maxLines = 1)
                                    }
                                }
                            }
                        }
                    }
                }

                item(key = "notice") {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFF202D38))
                            .border(1.dp, Color(0xFF33526C), RoundedCornerShape(14.dp))
                            .padding(13.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Info, null, tint = Color(0xFF75BFFF),
                            modifier = Modifier.size(18.dp))
                        Text(infoText(lang,
                            "18+ only. Services depend on local law and provider availability. Current official terms, payment limits and server confirmations control real transactions.",
                            "فقط ۱۸ سال به بالا؛ ارائه خدمات تابع قوانین محل استفاده و دسترسی ارائه‌دهنده است. در تراکنش واقعی، شرایط رسمی، محدودیت‌های لحظه‌ای درگاه و تأیید سرور ملاک‌اند."),
                            color = Color(0xFFC1D2E4), fontSize = 11.sp, lineHeight = 19.sp)
                    }
                }

                itemsIndexed(article.sections, key = { index, _ -> "section-" + index }) {
                    index, section ->
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
                            .background(infoPanel)
                            .border(1.dp, infoOutline, RoundedCornerShape(19.dp))
                            .padding(horizontal = 17.dp, vertical = 17.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Color(0xFF153A5C),
                                shape = RoundedCornerShape(9.dp)) {
                                Text((index + 1).toString().padStart(2, '0'),
                                    color = Color(0xFF80C7FF),
                                    fontWeight = FontWeight.Black, fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp))
                            }
                            Spacer(Modifier.width(10.dp))
                            Text((RussianFooter180.section(lang, section,  true) ?: AzerbaijaniFooter179.section(lang, section,  true) ?: FooterArabic175.section(lang, section,  true) ?: FooterArmenian173.section(lang, section,  true) ?: FooterTurkish170.section(lang, section, true) ?: infoText(lang, section.headingEn, section.headingFa)),
                                color = infoInk, fontWeight = FontWeight.Bold,
                                fontSize = 15.sp, lineHeight = 23.sp,
                                modifier = Modifier.weight(1f))
                        }
                        HorizontalDivider(color = Color.White.copy(alpha = .075f))
                        Text((RussianFooter180.section(lang, section,  false) ?: AzerbaijaniFooter179.section(lang, section,  false) ?: FooterArabic175.section(lang, section,  false) ?: FooterArmenian173.section(lang, section,  false) ?: FooterTurkish170.section(lang, section, false) ?: infoText(lang, section.bodyEn, section.bodyFa)),
                            color = Color(0xFFCCD3DE), fontSize = 12.sp, lineHeight = 23.sp)
                    }
                }

                item(key = "source") {
                    Column(Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(infoText(lang, "OFFICIAL REFERENCE & MORE INFORMATION",
                            "منبع رسمی و اطلاعات تکمیلی"),
                            color = infoMuted, fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold, letterSpacing = .7.sp)
                        Surface(
                            modifier = Modifier.fillMaxWidth().clickable {
                                runCatching { uri.openUri(article.sourceUrl) }
                            },
                            color = Color(0xFF153D69),
                            shape = RoundedCornerShape(15.dp),
                            border = BorderStroke(1.dp, Color(0xFF3275B5))
                        ) {
                            Row(Modifier.fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 15.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Language, null, tint = Color(0xFF9ED2FF),
                                    modifier = Modifier.size(22.dp))
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(infoText(lang,
                                        if (id == "guide") "Visit BetVima website"
                                            else "Read published policy",
                                        if (id == "guide") "ورود به وب‌سایت بت‌ویما"
                                            else "مشاهده قوانین منتشرشده"),
                                        color = infoInk, fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp)
                                    Text("betvima.com", color = infoMuted, fontSize = 10.sp)
                                }
                                Icon(Icons.Default.OpenInNew, null, tint = Color(0xFF9ED2FF),
                                    modifier = Modifier.size(20.dp))
                            }
                        }
                        Text(infoText(lang,
                            "This guide does not replace provider rules, official terms or local legal advice.",
                            "این راهنما جایگزین مقررات ارائه‌دهنده، شرایط رسمی یا مشاوره حقوقی محلی نیست."),
                            color = infoMuted, fontSize = 10.sp, lineHeight = 17.sp)
                    }
                }
            }
        }
    }
}
