package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

private val clubBg = Color(0xFF0B0C10)
private val clubPanel = Color(0xFF1B1C22)
private val clubLight = Color(0xFFC3C5D0)
private val clubGreen = Color(0xFF6FAEFF)
private val clubGold = Color(0xFFE5BE78)

private data class ClubBenefit(
    val icon: ImageVector, val name: String, val nameFa: String,
    val detail: String, val detailFa: String
)

private val clubBenefits = listOf(
    ClubBenefit(Icons.Default.CardGiftcard, "Exclusive campaigns", "کمپین‌های اختصاصی",
        "Explore offers published for eligible members.", "پیشنهادهای منتشرشده برای اعضای واجد شرایط را بررسی کنید."),
    ClubBenefit(Icons.Default.SupportAgent, "Member assistance", "راهنمایی اعضا",
        "Ask support which services are available to you.", "از پشتیبانی درباره خدمات قابل دسترس حساب خود بپرسید."),
    ClubBenefit(Icons.Default.AutoAwesome, "Special experiences", "تجربه‌های ویژه",
        "Discover limited-time club announcements.", "اطلاعیه‌های دوره‌ای باشگاه را دنبال کنید."),
    ClubBenefit(Icons.Default.VerifiedUser, "Clear eligibility", "شرایط شفاف",
        "Membership and rewards require verification.", "عضویت و پاداش‌ها نیازمند تأیید شرایط هستند.")
)

private data class ClubFaq(
    val question: String, val questionFa: String, val answer: String, val answerFa: String
)

private val clubFaqs = listOf(
    ClubFaq("How do I join VIP Club?", "چطور عضو باشگاه VIP شوم؟",
        "Contact support to confirm whether enrollment is available for your account and location.",
        "برای بررسی امکان عضویت حساب و منطقه خود با پشتیبانی تماس بگیرید."),
    ClubFaq("Are benefits guaranteed?", "آیا مزایا تضمینی هستند؟",
        "No. Offers depend on published terms, availability, eligibility and local rules. An offer is not a wallet credit until confirmed by the server.",
        "خیر. مزایا به شرایط اعلام‌شده، موجودبودن، احراز شرایط و قوانین محلی وابسته‌اند و تا تأیید سرور اعتبار کیف پول نیستند."),
    ClubFaq("Where can I see my rewards?", "پاداش‌هایم کجا نمایش داده می‌شوند؟",
        "Only confirmed bonuses and account transactions appear in the appropriate wallet or bonus pages.",
        "فقط بونوس‌ها و تراکنش‌های تأییدشده در بخش کیف پول یا بونوس حساب نمایش داده می‌شوند."),
    ClubFaq("Does this page activate cashback?", "آیا این صفحه کش‌بک را فعال می‌کند؟",
        "No. This is a club information screen, not a cashback schedule, promise of payout or claim about your VIP level.",
        "خیر. این صفحه معرفی باشگاه است و وعده کش‌بک، برنامه پرداخت یا سطح VIP واقعی شما نیست.")
)

/** Native full-height modal; no legacy cashback tiers, fake progress or automatic awards. */
@Composable
fun VipClubPopup82(
    lang: Lang,
    onDismiss: () -> Unit,
    onSupport: () -> Unit,
    onBonuses: () -> Unit
) {
    var expanded by rememberSaveable { mutableIntStateOf(-1) }

    PremiumMotionDialog(onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)) { motion, closeWith ->
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(.96f)
                .then(motion)
                .padding(horizontal = 7.dp)
                .clip(RoundedCornerShape(29.dp))
                .background(clubBg)
        ) {
            Column(Modifier.fillMaxWidth()
                .background(Brush.verticalGradient(
                    listOf(Color(0xFF202127), clubBg)))
                .padding(horizontal = 19.dp, vertical = 15.dp)
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally)
                    .width(37.dp).height(4.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = .25f)))
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(43.dp)
                        .clip(RoundedCornerShape(13.dp))
                        .background(Brush.linearGradient(
                            listOf(Color(0xFF393B50), clubGreen.copy(alpha = .32f)))),
                        contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.WorkspacePremium, null,
                            tint = clubGold, modifier = Modifier.size(27.dp))
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text("BETVIMA  /  VIP",
                            fontSize = 10.sp, letterSpacing = 1.5.sp,
                            fontWeight = FontWeight.Black, color = clubGreen)
                        Text(tr(lang, "VIP Club", "باشگاه VIP"),
                            color = Color.White, fontSize = 23.sp,
                            fontWeight = FontWeight.Black)
                    }
                    IconButton(onClick = { closeWith({}) },
                        modifier = Modifier.clip(CircleShape)
                            .background(Color.White.copy(alpha = .1f))) {
                        Icon(Icons.Default.Close,
                            tr(lang, "Close VIP Club", "بستن باشگاه VIP"),
                            tint = Color.White)
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp,
                    top = 6.dp, bottom = 26.dp),
                verticalArrangement = Arrangement.spacedBy(17.dp),
                flingBehavior = rememberPremiumFlingBehavior()
            ) {
                item(key = "hero") {
                    Box(Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(27.dp))
                        .background(Brush.linearGradient(listOf(
                            Color(0xFF28222F), Color(0xFF151923), Color(0xFF101116))))
                        .heightIn(min = 225.dp)) {
                        Box(Modifier.size(175.dp).align(Alignment.TopEnd)
                            .offset(x = 42.dp, y = (-39).dp)
                            .background(Brush.radialGradient(listOf(
                                Color(0xFF976EDE).copy(alpha = .24f), Color.Transparent)), CircleShape))
                        Icon(Icons.Default.WorkspacePremium, null,
                            tint = clubGold.copy(alpha = .40f),
                            modifier = Modifier.align(Alignment.TopEnd)
                                .padding(top = 19.dp, end = 22.dp).size(80.dp))
                        Column(Modifier.fillMaxWidth().padding(21.dp),
                            verticalArrangement = Arrangement.spacedBy(11.dp)) {
                            Text(tr(lang, "AN EXPERIENCE ABOVE THE ORDINARY",
                                    "تجربه‌ای فراتر از معمول"),
                                color = clubGreen, fontWeight = FontWeight.Black,
                                fontSize = 10.sp, letterSpacing = .9.sp)
                            Text(tr(lang, "Welcome to the\ninner circle",
                                    "به دنیای\nویژه خوش آمدید"),
                                fontSize = 31.sp, lineHeight = 36.sp,
                                color = Color.White, fontWeight = FontWeight.Black)
                            Text(tr(lang,
                                "Discover club news, possible member privileges and clear ways to ask about eligibility.",
                                "اخبار باشگاه، مزایای احتمالی اعضا و راه بررسی شرایط عضویت را در یکجا ببینید."),
                                color = clubLight, fontSize = 12.sp, lineHeight = 19.sp,
                                modifier = Modifier.fillMaxWidth(.94f))
                            Surface(color = Color.White.copy(alpha = .11f),
                                shape = RoundedCornerShape(30.dp)) {
                                Row(Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Shield, null, tint = clubGreen,
                                        modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(7.dp))
                                    Text(tr(lang, "Availability verified individually",
                                        "شرایط هر حساب جداگانه بررسی می‌شود"),
                                        fontSize = 10.sp, color = Color.White,
                                        fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }

                item(key = "intro") {
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(tr(lang, "Discover your possibilities",
                            "فرصت‌های عضویت را کشف کنید"),
                            fontWeight = FontWeight.Black,
                            fontSize = 21.sp, color = Color.White)
                        Text(tr(lang,
                            "Features below describe possible club experiences, not automatically active account privileges.",
                            "موارد زیر معرفی امکانات احتمالی باشگاه هستند، نه مزایای فعال و قطعی حساب شما."),
                            fontSize = 11.sp, lineHeight = 18.sp, color = clubLight)
                    }
                }

                item(key = "benefits-top") {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ClubBenefitTile(clubBenefits[0], lang, Modifier.weight(1f))
                        ClubBenefitTile(clubBenefits[1], lang, Modifier.weight(1f))
                    }
                }
                item(key = "benefits-bottom") {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ClubBenefitTile(clubBenefits[2], lang, Modifier.weight(1f))
                        ClubBenefitTile(clubBenefits[3], lang, Modifier.weight(1f))
                    }
                }

                item(key = "steps-header") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome, null, tint = clubGold,
                            modifier = Modifier.size(24.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang, "Your path to the club", "مسیر آشنایی با باشگاه"),
                            fontSize = 20.sp, color = Color.White,
                            fontWeight = FontWeight.Black)
                    }
                }
                item(key = "steps") {
                    Column(Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(23.dp))
                        .background(clubPanel)
                        .padding(17.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        ClubStep("01", tr(lang, "Explore", "بررسی"),
                            tr(lang, "Discover current campaigns and announcements.",
                                "کمپین‌ها و اطلاعیه‌های فعلی را ببینید."))
                        HorizontalDivider(color = Color.White.copy(alpha = .1f))
                        ClubStep("02", tr(lang, "Confirm", "تأیید"),
                            tr(lang, "Ask support about account and location eligibility.",
                                "شرایط حساب و محل اقامت را از پشتیبانی بپرسید."))
                        HorizontalDivider(color = Color.White.copy(alpha = .1f))
                        ClubStep("03", tr(lang, "Enjoy", "استفاده"),
                            tr(lang, "Use benefits only after they are explicitly confirmed.",
                                "فقط از مزایای تأییدشده استفاده کنید."))
                    }
                }
                item(key = "faq-title") {
                    Text(tr(lang, "Questions & answers", "سؤالات متداول"),
                        color = Color.White, fontSize = 20.sp,
                        fontWeight = FontWeight.Black)
                }
                itemsIndexed(clubFaqs, key = { i, _ -> "club-faq-$i" }) { i, faq ->
                    val opened = expanded == i
                    val shade by animateColorAsState(
                        targetValue = if (opened) Color(0xFF272932) else clubPanel,
                        animationSpec = tween(240), label = "vipFaqHighlight")
                    Column(Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(17.dp))
                        .background(shade)
                        .clickable { expanded = if (opened) -1 else i }
                        .padding(horizontal = 15.dp, vertical = 15.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(tr(lang, faq.question, faq.questionFa),
                                color = Color.White, fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f))
                            Icon(if (opened) Icons.Default.Remove else Icons.Default.Add,
                                null, tint = clubGreen, modifier = Modifier.size(20.dp))
                        }
                        AnimatedVisibility(visible = opened,
                            enter = expandVertically(tween(210)) + fadeIn(tween(170)),
                            exit = shrinkVertically(tween(170)) + fadeOut(tween(120))) {
                            Text(tr(lang, faq.answer, faq.answerFa),
                                color = clubLight, fontSize = 11.sp, lineHeight = 18.sp,
                                modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                }
                item(key = "disclosure") {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 3.dp),
                        verticalAlignment = Alignment.Top) {
                        Icon(Icons.Default.Info, null, tint = clubGold,
                            modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang,
                            "VIP access and benefits are subject to eligibility, published terms and local rules. No cashback, payout or tier is activated by this screen.",
                            "دسترسی و مزایای VIP تابع احراز شرایط، قوانین اعلام‌شده و مقررات محلی است. این صفحه هیچ کش‌بک، پرداخت یا سطحی را فعال نمی‌کند."),
                            color = Color(0xFF96A9B9), fontSize = 10.sp,
                            lineHeight = 16.sp)
                    }
                }
            }

            Row(Modifier.fillMaxWidth()
                .background(Color(0xFF121318))
                .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { closeWith(onBonuses) },
                    modifier = Modifier.weight(.86f).height(50.dp),
                    shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = .24f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)) {
                    Text(tr(lang, "Bonuses", "بونوس‌ها"),
                        fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Button(onClick = { closeWith(onSupport) },
                    modifier = Modifier.weight(1.2f).height(50.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = clubGreen),
                    shape = RoundedCornerShape(15.dp)) {
                    Icon(Icons.Default.SupportAgent, null,
                        tint = Color(0xFF0E1320), modifier = Modifier.size(19.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(tr(lang, "Ask about VIP", "پرسش درباره VIP"),
                        fontSize = 12.sp, color = Color(0xFF0E1320),
                        fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun ClubBenefitTile(benefit: ClubBenefit, lang: Lang, modifier: Modifier = Modifier) {
    Column(modifier.heightIn(min = 151.dp)
        .clip(RoundedCornerShape(19.dp))
        .background(Brush.verticalGradient(listOf(
            Color(0xFF262830), Color(0xFF18191F))))
        .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(39.dp).clip(RoundedCornerShape(12.dp))
            .background(clubGreen.copy(alpha = .13f)),
            contentAlignment = Alignment.Center) {
            Icon(benefit.icon, null, tint = clubGreen, modifier = Modifier.size(22.dp))
        }
        Text(tr(lang, benefit.name, benefit.nameFa), color = Color.White,
            fontSize = 13.sp, fontWeight = FontWeight.Black, lineHeight = 16.sp)
        Text(tr(lang, benefit.detail, benefit.detailFa), color = clubLight,
            fontSize = 10.sp, lineHeight = 15.sp)
    }
}

@Composable
private fun ClubStep(number: String, title: String, details: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF333044)), contentAlignment = Alignment.Center) {
            Text(number, color = clubGreen, fontSize = 13.sp,
                fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
            Text(details, color = clubLight, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
}
