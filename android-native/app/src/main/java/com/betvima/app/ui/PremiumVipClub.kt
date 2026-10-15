package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.util.Locale

private val vipInk = Color(0xFF151920)
private val vipSecondary = Color(0xFF64738B)
private val vipBlue = Color(0xFF087FF5)
private val vipPink = Color(0xFFEB439E)
private val vipStroke = Color(0xFFE6EAF2)
private val vipBlueWash = Color(0xFFEAF4FF)
private val vipPinkWash = Color(0xFFFFEBF6)

internal data class VipCashbackBand(
    val id: String, val en: String, val fa: String,
    val weeklyDepositUsd: Int, val lossCashbackPercent: Int
)

/** Mirror the five published website cashback bands. No personal status is inferred. */
internal val vipCashbackBands = listOf(
    VipCashbackBand("bronze", "Bronze", "برنزی", 2000, 3),
    VipCashbackBand("silver", "Silver", "نقره‌ای", 4000, 5),
    VipCashbackBand("gold", "Gold", "طلایی", 6000, 6),
    VipCashbackBand("platinum", "Platinum", "پلاتینی", 9000, 8),
    VipCashbackBand("diamond", "Diamond", "الماسی", 15000, 11)
)

internal fun vipIllustrativeCashback(eligibleLossUsd: Int, band: VipCashbackBand): Int =
    eligibleLossUsd * band.lossCashbackPercent / 100

private fun vipUsd(n: Int): String = "$" + String.format(Locale.US, "%,d", n)

@Composable
private fun VipIcon(
    icon: ImageVector,
    color: Color = vipBlue,
    pink: Boolean = false,
    modifier: Modifier = Modifier
) {
    Surface(modifier = modifier.size(37.dp), shape = RoundedCornerShape(13.dp),
        color = if (pink) vipPinkWash else vipBlueWash) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = color,
                modifier = Modifier.size(19.dp))
        }
    }
}

@Composable
private fun VipCrownArt() {
    Box(Modifier.size(112.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(106.dp)
            .background(
                Brush.linearGradient(listOf(Color(0xFFF6FAFF), Color(0xFFFDECF7))),
                CircleShape
            )
            .border(1.dp, Color(0xFFD9E6FF), CircleShape))
        Box(Modifier.size(78.dp)
            .background(
                Brush.linearGradient(listOf(Color(0xFF0787FF), Color(0xFF7D61FA), vipPink)),
                RoundedCornerShape(25.dp)
            ), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.WorkspacePremium, null, tint = Color.White,
                modifier = Modifier.size(57.dp))
        }
        Icon(Icons.Default.AutoAwesome, null, tint = vipPink,
            modifier = Modifier.align(Alignment.TopEnd).size(19.dp))
        Icon(Icons.Default.Star, null, tint = vipBlue,
            modifier = Modifier.align(Alignment.BottomStart).size(16.dp))
    }
}

@Composable
private fun VipHero(lang: Lang, onExplore: () -> Unit, onWallet: () -> Unit) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        Modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(Color.White, Color(0xFFECF5FF),
                Color(0xFFFFF0F9))), shape)
            .border(1.dp, Color(0xFFDCE8FC), shape)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(8.dp), color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFCAE1FF))) {
                Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Stars, null, tint = vipBlue,
                        modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("BETVIMA  VIP CLUB", fontSize = 10.sp,
                        fontWeight = FontWeight.Black, color = vipInk)
                }
            }
            Spacer(Modifier.weight(1f))
            Icon(Icons.Default.AutoAwesome, null, tint = vipPink,
                modifier = Modifier.size(19.dp))
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(tr(lang, "VIP Club", "باشگاه VIP"),
                    fontSize = 29.sp, lineHeight = 34.sp,
                    fontWeight = FontWeight.Black, color = vipInk)
                Text(tr(lang, "Rewarding every level",
                    "مزایای بیشتر در هر سطح"),
                    fontSize = 13.sp, fontWeight = FontWeight.Bold, color = vipBlue)
                Text(tr(lang,
                    "Explore five weekly cashback plans. Your deposits set the rate; eligible settled losses determine the amount.",
                    "پنج پلن کش‌بک هفتگی را ببینید. واریزهای هفته نرخ را تعیین می‌کنند و مبلغ از باخت‌های واجد شرایط و تسویه‌شده محاسبه می‌شود."),
                    fontSize = 11.sp, lineHeight = 18.sp, color = vipSecondary)
            }
            VipCrownArt()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = onExplore,
                modifier = Modifier.weight(1f).heightIn(min = 45.dp),
                colors = ButtonDefaults.buttonColors(containerColor = vipBlue),
                shape = RoundedCornerShape(13.dp),
                contentPadding = PaddingValues(horizontal = 8.dp)
            ) {
                Text(tr(lang, "Explore plans", "مشاهده پلن‌ها"),
                    fontWeight = FontWeight.Black, fontSize = 11.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.width(4.dp))
                Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(16.dp))
            }
            OutlinedButton(
                onClick = onWallet,
                modifier = Modifier.weight(1f).heightIn(min = 45.dp),
                border = BorderStroke(1.dp, Color(0xFFC6DAF1)),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = vipInk),
                shape = RoundedCornerShape(13.dp),
                contentPadding = PaddingValues(horizontal = 8.dp)
            ) {
                Icon(Icons.Default.AccountBalanceWallet, null,
                    modifier = Modifier.size(16.dp), tint = vipPink)
                Spacer(Modifier.width(5.dp))
                Text(tr(lang, "My wallet", "کیف پول"),
                    fontWeight = FontWeight.Black, fontSize = 11.sp, maxLines = 1)
            }
        }
    }
}

@Composable
private fun VipSectionTitle(
    title: String, caption: String, icon: ImageVector,
    pink: Boolean = false
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        VipIcon(icon, if (pink) vipPink else vipBlue, pink = pink)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = vipInk, fontWeight = FontWeight.Black, fontSize = 18.sp)
            Text(caption, color = vipSecondary, fontSize = 11.sp, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun VipSmallMetric(number: String, label: String, tint: Color, modifier: Modifier) {
    Surface(modifier = modifier, color = Color.White, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, vipStroke)) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(number, fontWeight = FontWeight.Black, fontSize = 17.sp, color = tint)
            Text(label, color = vipSecondary, fontSize = 10.sp, lineHeight = 13.sp)
        }
    }
}

@Composable
private fun VipBandTile(
    band: VipCashbackBand, lang: Lang, selected: Boolean, index: Int,
    onClick: () -> Unit
) {
    val accent = if (index % 2 == 0) vipBlue else vipPink
    Surface(
        modifier = Modifier.width(116.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(19.dp),
        color = if (selected) Color(0xFFEFF6FF) else Color.White,
        border = BorderStroke(if (selected) 2.dp else 1.dp,
            if (selected) vipBlue else vipStroke),
        shadowElevation = if (selected) 3.dp else 0.dp
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 13.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Surface(color = if (index % 2 == 0) vipBlueWash else vipPinkWash,
                shape = CircleShape) {
                Icon(Icons.Default.WorkspacePremium, contentDescription = null,
                    tint = accent, modifier = Modifier.padding(9.dp).size(25.dp))
            }
            Text(tr(lang, band.en, band.fa), color = vipInk,
                fontWeight = FontWeight.Black, fontSize = 12.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(band.lossCashbackPercent.toString() + "%",
                color = accent, fontWeight = FontWeight.Black, fontSize = 20.sp)
            Text(vipUsd(band.weeklyDepositUsd) + "+",
                color = vipSecondary, fontWeight = FontWeight.Bold, fontSize = 11.sp)
        }
    }
}

@Composable
private fun VipSelectedBand(band: VipCashbackBand, lang: Lang, selectedIndex: Int) {
    Surface(color = Color.White, shape = RoundedCornerShape(23.dp),
        border = BorderStroke(1.dp, Color(0xFFD9E5F8)), shadowElevation = 1.dp) {
        Column(Modifier.fillMaxWidth().padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                VipIcon(Icons.Default.Verified, vipBlue)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "SELECTED PLAN PREVIEW", "پیش‌نمایش پلن انتخابی"),
                        color = vipSecondary, fontSize = 10.sp,
                        fontWeight = FontWeight.Bold)
                    Text(tr(lang, band.en, band.fa), color = vipInk,
                        fontSize = 23.sp, fontWeight = FontWeight.Black)
                }
                Surface(color = vipPinkWash, shape = RoundedCornerShape(10.dp)) {
                    Text((selectedIndex + 1).toString() + " / 5",
                        color = vipPink, fontWeight = FontWeight.Black, fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Weekly deposits from", "حداقل واریز هفته"),
                        color = vipSecondary, fontSize = 10.sp)
                    Text(vipUsd(band.weeklyDepositUsd),
                        color = vipInk, fontWeight = FontWeight.Black, fontSize = 20.sp)
                }
                Column(Modifier.weight(1f)) {
                    Text(tr(lang, "Loss cashback rate", "درصد کش‌بک باخت"),
                        color = vipSecondary, fontSize = 10.sp)
                    Text(band.lossCashbackPercent.toString() + "%",
                        color = vipBlue, fontWeight = FontWeight.Black, fontSize = 20.sp)
                }
            }
            HorizontalDivider(color = vipStroke)
            Surface(color = Color(0xFFF5F8FD), shape = RoundedCornerShape(13.dp)) {
                Row(Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.Top) {
                    Icon(Icons.Default.Calculate, null, tint = vipPink,
                        modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(9.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang, "Example with $1,000 eligible weekly losses",
                            "مثال با ۱٬۰۰۰ دلار باخت واجد شرایط هفته"),
                            fontSize = 11.sp, color = vipSecondary, lineHeight = 17.sp)
                        Text(vipUsd(vipIllustrativeCashback(1000, band)) +
                            tr(lang, " illustrative cashback", " کش‌بک فرضی"),
                            fontWeight = FontWeight.Black, fontSize = 14.sp,
                            color = vipInk)
                    }
                }
            }
            Text(tr(lang,
                "This is a comparison, not your actual VIP level or credited reward.",
                "این فقط مقایسه پلن‌هاست؛ سطح واقعی حساب یا پاداش واریزشده شما نیست."),
                color = vipSecondary, fontSize = 10.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun VipBenefitTile(
    icon: ImageVector, en: String, fa: String, enDesc: String, faDesc: String,
    lang: Lang, isPink: Boolean, modifier: Modifier
) {
    Surface(modifier = modifier, color = Color.White,
        shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, vipStroke)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            VipIcon(icon, if (isPink) vipPink else vipBlue, isPink)
            Text(tr(lang, en, fa), fontSize = 12.sp,
                fontWeight = FontWeight.Black, color = vipInk, lineHeight = 16.sp)
            Text(tr(lang, enDesc, faDesc), fontSize = 10.sp,
                color = vipSecondary, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun VipStep(
    step: String, icon: ImageVector,
    en: String, fa: String, enDesc: String, faDesc: String, lang: Lang,
    pink: Boolean = false
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Surface(color = if (pink) vipPinkWash else vipBlueWash, shape = CircleShape) {
            Text(step, color = if (pink) vipPink else vipBlue,
                fontWeight = FontWeight.Black, fontSize = 12.sp,
                modifier = Modifier.padding(13.dp))
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = if (pink) vipPink else vipBlue,
                    modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp))
                Text(tr(lang, en, fa), color = vipInk,
                    fontWeight = FontWeight.Black, fontSize = 13.sp)
            }
            Text(tr(lang, enDesc, faDesc),
                color = vipSecondary, fontSize = 11.sp, lineHeight = 17.sp)
        }
    }
}

private data class VipQuestion(
    val en: String, val fa: String, val answerEn: String, val answerFa: String
)

private val vipQuestions = listOf(
    VipQuestion(
        "What unlocks a cashback rate?", "درصد کش‌بک چگونه تعیین می‌شود؟",
        "Successful weekly deposits: $2,000 / $4,000 / $6,000 / $9,000 / $15,000+ unlock 3% / 5% / 6% / 8% / 11%.",
        "مجموع واریز موفق هفتگی ۲٬۰۰۰ / ۴٬۰۰۰ / ۶٬۰۰۰ / ۹٬۰۰۰ / ۱۵٬۰۰۰ دلار به بالا به ترتیب نرخ ۳٪ / ۵٪ / ۶٪ / ۸٪ / ۱۱٪ دارد."
    ),
    VipQuestion(
        "Is cashback paid on deposits?", "کش‌بک به واریز تعلق می‌گیرد؟",
        "No. Deposits set only the rate. The amount is calculated on eligible settled weekly losses.",
        "خیر. واریزها فقط نرخ را تعیین می‌کنند. مبلغ از باخت‌های واجد شرایط و تسویه‌شده همان هفته محاسبه می‌شود."
    ),
    VipQuestion(
        "Is Monday payment guaranteed?", "آیا پرداخت دوشنبه قطعی است؟",
        "Monday is the designated review/payment day. Actual account credits require an enabled and verified server-side cashback system.",
        "دوشنبه روز تعیین‌شده برای بررسی و پرداخت است. واریز واقعی به سیستم کش‌بک فعال و تأییدشده در سرور نیاز دارد."
    ),
    VipQuestion(
        "Why can't I see my actual VIP progress?", "چرا پیشرفت واقعی حسابم را نمی‌بینم؟",
        "The app currently has no verified personal weekly cashback progress endpoint. The plans shown here are informational, never a fabricated balance or status.",
        "هنوز سرویس تأییدشده پیشرفت شخصی کش‌بک در اپ وجود ندارد. این پلن‌ها فقط اطلاع‌رسانی‌اند و موجودی یا سطح ساختگی نشان نمی‌دهند."
    )
)

@Composable
fun PremiumVipClubPage(state: AppState, model: AppViewModel) {
    val lang = state.lang
    var selected by rememberSaveable { mutableIntStateOf(0) }
    var expandedFaq by rememberSaveable { mutableIntStateOf(-1) }
    val scroll = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val current = vipCashbackBands[selected]
    val openWallet: () -> Unit = {
        if (state.signedIn) model.tab(Tab.WALLET) else model.showLogin(true)
    }
    LazyColumn(
        state = scroll,
        modifier = Modifier.fillMaxSize().background(Color(0xFFF8F9FC)),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        flingBehavior = rememberPremiumFlingBehavior()
    ) {
        item(key = "hero") {
            VipHero(lang,
                onExplore = { scope.launch { scroll.animateScrollToItem(2) } },
                onWallet = openWallet)
        }
        item(key = "numbers") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VipSmallMetric("05", tr(lang, "Weekly plans", "پلن هفتگی"),
                    vipBlue, Modifier.weight(1f))
                VipSmallMetric("11%", tr(lang, "Maximum rate", "سقف درصد"),
                    vipPink, Modifier.weight(1f))
                VipSmallMetric(tr(lang, "MON", "دوشنبه"),
                    tr(lang, "Planned payout", "روز تعیین‌شده"), vipBlue,
                    Modifier.weight(1f))
            }
        }
        item(key = "tier-heading") {
            VipSectionTitle(
                tr(lang, "Explore VIP levels", "سطوح VIP را بررسی کنید"),
                tr(lang, "Select a plan to compare; not personal progress",
                    "پلن‌ها را مقایسه کنید؛ این پیشرفت شخصی نیست"),
                Icons.Default.WorkspacePremium
            )
        }
        item(key = "tier-select") {
            LazyRow(
                contentPadding = PaddingValues(vertical = 3.dp, horizontal = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                itemsIndexed(vipCashbackBands, key = { _, band -> band.id }) { i, band ->
                    VipBandTile(band, lang, selected == i, i) { selected = i }
                }
            }
        }
        item(key = "selected-detail") { VipSelectedBand(current, lang, selected) }
        item(key = "benefits-title") {
            VipSectionTitle(
                tr(lang, "VIP benefits", "مزایای باشگاه VIP"),
                tr(lang, "The published weekly cashback programme",
                    "مزایای طرح کش‌بک هفتگی سایت"),
                Icons.Default.CardGiftcard, pink = true
            )
        }
        item(key = "benefit-grid-a") {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                VipBenefitTile(Icons.Default.Savings, "Cashback rates",
                    "نرخ کش‌بک", "3% to 11% on eligible losses",
                    "۳ تا ۱۱٪ باخت‌های واجد شرایط", lang, false,
                    Modifier.weight(1f))
                VipBenefitTile(Icons.Default.CalendarMonth, "Monday review",
                    "بررسی دوشنبه", "Designated weekly payment day",
                    "روز تعیین‌شده پرداخت هفتگی", lang, true,
                    Modifier.weight(1f))
            }
        }
        item(key = "benefit-grid-b") {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                VipBenefitTile(Icons.Default.CompareArrows, "Five deposit bands",
                    "پنج سطح واریز", "Choose and compare the plans",
                    "انتخاب و مقایسه پلن‌ها", lang, true,
                    Modifier.weight(1f))
                VipBenefitTile(Icons.Default.Shield, "Clear conditions",
                    "شرایط شفاف", "No unverified balance shown",
                    "بدون نمایش موجودی تأییدنشده", lang, false,
                    Modifier.weight(1f))
            }
        }
        item(key = "steps-heading") {
            VipSectionTitle(
                tr(lang, "How it works", "نحوه محاسبه کش‌بک"),
                tr(lang, "Three steps, clear conditions", "سه مرحله با شرایط شفاف"),
                Icons.Default.AutoAwesome
            )
        }
        item(key = "steps-card") {
            Surface(color = Color.White, shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, vipStroke)) {
                Column(Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(17.dp)) {
                    VipStep("01", Icons.Default.AccountBalanceWallet,
                        "Weekly deposits", "واریزهای هفته",
                        "Successful deposits determine the cashback percentage.",
                        "مجموع واریز موفق هفته درصد کش‌بک را تعیین می‌کند.", lang)
                    HorizontalDivider(color = vipStroke)
                    VipStep("02", Icons.Default.Calculate,
                        "Eligible settled losses", "باخت تسویه‌شده واجد شرایط",
                        "Apply that rate to eligible settled weekly losses, not deposits.",
                        "درصد به باخت واجد شرایط هفته تعلق می‌گیرد، نه مبلغ واریزی.", lang,
                        pink = true)
                    HorizontalDivider(color = vipStroke)
                    VipStep("03", Icons.Default.EventAvailable,
                        "Monday payment schedule", "برنامه پرداخت دوشنبه",
                        "Actual credits require a verified active cashback payment service.",
                        "پرداخت واقعی نیازمند سرویس کش‌بک فعال و تأییدشده است.", lang)
                }
            }
        }
        item(key = "faq-title") {
            VipSectionTitle(tr(lang, "Common questions", "سوالات متداول"),
                tr(lang, "Everything explained in one place",
                    "پاسخ‌های روشن و کاربردی"),
                Icons.Default.HelpOutline, pink = true)
        }
        itemsIndexed(vipQuestions, key = { i, _ -> "faq-" + i }) { i, q ->
            val opened = expandedFaq == i
            Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, if (opened) Color(0xFFB5D7FF) else vipStroke)) {
                Column(Modifier.fillMaxWidth().clickable {
                    expandedFaq = if (opened) -1 else i
                }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.HelpOutline, null, tint = if (i % 2 == 0) vipBlue else vipPink,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(9.dp))
                        Text(tr(lang, q.en, q.fa), color = vipInk,
                            fontSize = 12.sp, fontWeight = FontWeight.Black,
                            modifier = Modifier.weight(1f))
                        Icon(if (opened) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            null, tint = vipBlue, modifier = Modifier.size(20.dp))
                    }
                    if (opened) {
                        HorizontalDivider(color = vipStroke)
                        Text(tr(lang, q.answerEn, q.answerFa),
                            fontSize = 11.sp, lineHeight = 18.sp,
                            color = vipSecondary)
                    }
                }
            }
        }
        item(key = "action") {
            Surface(color = vipBlueWash, shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, Color(0xFFCDE1FA))) {
                Column(Modifier.fillMaxWidth().padding(17.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        VipIcon(Icons.Default.SupportAgent, vipPink, pink = true)
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang, "Questions about VIP?", "درباره VIP سوال دارید؟"),
                                fontSize = 15.sp, fontWeight = FontWeight.Black,
                                color = vipInk)
                            Text(tr(lang,
                                "Ask about rules and payout availability.",
                                "درباره شرایط و فعال بودن پرداخت بپرسید."),
                                color = vipSecondary, fontSize = 11.sp)
                        }
                    }
                    Button(onClick = { model.feature(Feature.SUPPORT) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = vipBlue),
                        shape = RoundedCornerShape(13.dp)) {
                        Icon(Icons.Default.SupportAgent, null,
                            modifier = Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(lang, "Contact support", "ارتباط با پشتیبانی"),
                            fontWeight = FontWeight.Black)
                    }
                }
            }
        }
        item(key = "disclaimer") {
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                verticalAlignment = Alignment.Top) {
                Icon(Icons.Default.Info, null, tint = vipPink,
                    modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang,
                    "Informational plan preview. No personal tier, cash balance, mission completion or automatic payout is implied. Play responsibly.",
                    "پیش‌نمایش اطلاعات پلن‌هاست؛ هیچ سطح واقعی، موجودی، مأموریت تکمیل‌شده یا پرداخت خودکاری به حساب شما نسبت داده نمی‌شود. مسئولانه بازی کنید."),
                    color = vipSecondary, fontSize = 10.sp, lineHeight = 16.sp)
            }
        }
    }
}
