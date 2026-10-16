package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// A genuinely native, illustrated and animated Partners landing.
// Does not embed 1win content, third-party media, or an external website.
private val partnerNight = Color(0xFF0A0C15)
private val partnerBlue = Color(0xFF355CFA)
private val partnerViolet = Color(0xFF8559E9)
private val partnerMint = Color(0xFF00D47A)
private val partnerPaper = Color(0xFFF3F4F8)
private val partnerMuted = Color(0xFF818A9D)
private val partnerWhite = Color.White

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumAffiliateSheet(state: AppState, model: AppViewModel, onClose: () -> Unit) {
    val lang = state.lang
    var showPortal by rememberSaveable { mutableStateOf(false) }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = sheet,
        containerColor = partnerNight,
        contentColor = partnerWhite,
        shape = RoundedCornerShape(topStart = 25.dp, topEnd = 25.dp),
        dragHandle = {
            Box(Modifier.fillMaxWidth().height(23.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.size(52.dp, 5.dp).clip(CircleShape).background(Color(0xFFB6B8C2)))
            }
        }
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.97f)) {
            Row(
                Modifier.fillMaxWidth().height(65.dp).background(partnerNight)
                    .padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("BETVIMA", fontWeight = FontWeight.Black, color = partnerWhite,
                    fontSize = 21.sp, letterSpacing = -.8.sp)
                Spacer(Modifier.width(5.dp))
                Column {
                    Text("PARTNERS", color = partnerMint, fontSize = 9.sp,
                        fontWeight = FontWeight.Bold, letterSpacing = 1.7.sp)
                    Text(tr(lang, "Affiliate center", "مرکز همکاری"),
                        color = Color(0xFFB2B4C6), fontSize = 9.sp)
                }
                Spacer(Modifier.weight(1f))
                if (showPortal) {
                    TextButton(onClick = { showPortal = false }) {
                        Text(tr(lang, "Explore", "معرفی"), color = partnerWhite)
                    }
                } else {
                    TextButton(onClick = { showPortal = true }) {
                        Text(tr(lang, "Log in", "ورود"), color = partnerWhite)
                    }
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, tr(lang, "Close", "بستن"),
                        tint = partnerWhite)
                }
            }
            if (showPortal) {
                AffiliateDashboard(state, model)
            } else {
                AffiliateMotionLanding(lang, onGetStarted = { showPortal = true })
            }
        }
    }
}

@Composable
private fun AffiliateMotionLanding(lang: Lang, onGetStarted: () -> Unit) {
    val list = rememberLazyListState()
    val showing: (Int) -> Boolean = { index ->
        list.layoutInfo.visibleItemsInfo.any { it.index == index }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(partnerNight),
        state = list,
        flingBehavior = rememberPremiumFlingBehavior(),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item(key = "hero") {
            val active by remember { derivedStateOf { showing(0) } }
            PartnerHero(lang, active, onGetStarted)
        }
        item(key = "stats") {
            val active by remember { derivedStateOf { showing(1) } }
            PartnerStats(lang, active)
        }
        item(key = "features-heading") {
            LightHeading(lang, "FEATURES",
                "The ecosystem behind every partnership",
                "یک اکوسیستم برای رشد همکاری")
        }
        item(key = "features") {
            PartnerFeatures(lang)
        }
        item(key = "chart") {
            val active by remember { derivedStateOf { showing(4) } }
            PartnerChart(lang, active)
        }
        item(key = "coverage") {
            PartnerCoverage(lang, onGetStarted)
        }
        item(key = "products") {
            PartnerProducts(lang)
        }
        item(key = "questions") {
            PartnerFaq(lang)
        }
        item(key = "gallery") {
            PartnerGallery(lang)
        }
        item(key = "signup") {
            PartnerSignup(lang, onGetStarted)
        }
    }
}

@Composable
private fun PartnerHero(lang: Lang, active: Boolean, onGetStarted: () -> Unit) {
    val appear by animateFloatAsState(if (active) 1f else 0f,
        animationSpec = tween(850, easing = FastOutSlowInEasing), label = "hero")
    val floatAnim = rememberInfiniteTransition(label = "hero-float")
    val floatY by floatAnim.animateFloat(
        initialValue = 0f, targetValue = -12f,
        animationSpec = infiniteRepeatable(tween(2600, easing = EaseInOutSine),
            RepeatMode.Reverse), label = "float"
    )
    Column(
        Modifier.fillMaxWidth().background(
            Brush.verticalGradient(listOf(partnerNight, Color(0xFF12152B), partnerNight))
        ).padding(horizontal = 23.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(33.dp))
        Text("BETVIMA  PARTNERS", fontSize = 11.sp,
            letterSpacing = 2.sp, color = partnerMint, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(21.dp))
        Text(tr(lang, "Grow together with a\npremium Sports & Casino brand",
                "با برند ورزشی و کازینویی\nبت‌ویما رشد کنید"),
            color = Color.White, fontSize = 32.sp, lineHeight = 39.sp,
            fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
            modifier = Modifier.graphicsLayer {
                alpha = appear
                translationY = (1f - appear) * 65f
            })
        Spacer(Modifier.height(24.dp))
        Button(onClick = onGetStarted, modifier = Modifier.fillMaxWidth().height(58.dp),
            colors = ButtonDefaults.buttonColors(containerColor = partnerBlue),
            shape = RoundedCornerShape(15.dp)) {
            Text(tr(lang, "Become an affiliate", "شروع همکاری"),
                color = partnerWhite, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(10.dp))
            Icon(Icons.Default.ArrowForward, null, tint = partnerWhite)
        }
        Spacer(Modifier.height(18.dp))
        TextButton(onClick = onGetStarted) {
            Text(tr(lang, "Already a partner? Log in", "حساب دارید؟ ورود"),
                color = Color(0xFFC2C9DD), fontSize = 12.sp)
        }
        Box(Modifier.fillMaxWidth().height(365.dp), contentAlignment = Alignment.BottomCenter) {
            Box(Modifier.size(310.dp).align(Alignment.Center).background(
                Brush.radialGradient(listOf(Color(0xFF6B58C6).copy(alpha = .23f),
                    Color.Transparent)), CircleShape))
            Box(Modifier.align(Alignment.BottomCenter)
                .graphicsLayer {
                    alpha = appear
                    translationX = (1f - appear) * 230f
                    translationY = floatY
                    rotationZ = -9f
                }) {
                PartnerPhone()
            }
            PartnerFloatLabel("RevShare",
                tr(lang, "Agreement based", "طبق قرارداد"),
                Modifier.align(Alignment.CenterStart).offset(y = 43.dp)
                    .graphicsLayer { alpha = appear; translationX = (1f-appear)*-100 })
            PartnerFloatLabel("CPA",
                tr(lang, "On approval", "با تأیید جداگانه"),
                Modifier.align(Alignment.BottomEnd).offset(y = (-55).dp)
                    .graphicsLayer { alpha = appear; translationX = (1f-appear)*100 })
        }
    }
}

@Composable
private fun PartnerFloatLabel(title: String, sub: String, modifier: Modifier) {
    Surface(modifier = modifier.shadow(13.dp, RoundedCornerShape(19.dp)),
        color = Color.White, shape = RoundedCornerShape(19.dp),
        border = BorderStroke(3.dp, Color(0xFFD2B8FF))) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 10.dp)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black,
                color = partnerNight)
            Text(sub, fontSize = 9.sp, color = Color(0xFF73809A))
        }
    }
}

@Composable
private fun PartnerPhone() {
    Surface(
        modifier = Modifier.size(width = 183.dp, height = 337.dp),
        color = Color(0xFF080A13), shape = RoundedCornerShape(27.dp),
        border = BorderStroke(5.dp, Color(0xFF343A47)),
        shadowElevation = 20.dp
    ) {
        Column(Modifier.padding(9.dp)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.size(64.dp, 9.dp).clip(CircleShape)
                    .background(Color.Black))
            }
            Spacer(Modifier.height(11.dp))
            Text("BETVIMA", color = partnerWhite, fontSize = 14.sp,
                fontWeight = FontWeight.Black)
            Spacer(Modifier.height(9.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("Live", "Sports", "Casino").forEach {
                    Surface(shape = RoundedCornerShape(5.dp),
                        color = if (it == "Live") partnerBlue else Color(0xFF20283A)) {
                        Text(it, Modifier.padding(5.dp), color = Color.White, fontSize = 7.sp)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().height(93.dp).clip(RoundedCornerShape(12.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF3D36B8),
                    Color(0xFF802B9D), Color(0xFF142A57))))) {
                Column(Modifier.align(Alignment.CenterStart).padding(11.dp)) {
                    Text("BETVIMA", color = Color(0xFFB7C5FF), fontSize = 8.sp)
                    Text("Explore the game", color = Color.White, fontSize = 14.sp,
                        fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(5.dp))
                    Text("SPORTS • CASINO", color = Color.White, fontSize = 7.sp)
                }
            }
            Spacer(Modifier.height(9.dp))
            repeat(3) { idx ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 3.dp)
                        .background(Color(0xFF1B2330), RoundedCornerShape(8.dp))
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(if(idx==0) Icons.Default.SportsSoccer else
                        if(idx==1) Icons.Default.Casino else Icons.Default.BarChart,
                        null, tint = if(idx==0)partnerMint else Color(0xFFB4A4FF),
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(9.dp))
                    Text(listOf("Football", "Live Casino", "Insights")[idx],
                        color = Color.White, fontSize = 9.sp)
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Default.ChevronRight,null,
                        tint=Color(0xFFBAC5D4),modifier=Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun PartnerStats(lang: Lang, active: Boolean) {
    val count by animateIntAsState(if(active) 3 else 0,
        animationSpec = tween(1100), label = "partner-stat")
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp)
        .clip(RoundedCornerShape(34.dp))
        .background(partnerBlue)
        .padding(horizontal = 27.dp, vertical = 33.dp)) {
        Text(tr(lang, "Your tools for partner growth",
                "ابزارهای رشد همکاری شما"),
            color = Color.White, fontSize = 23.sp, lineHeight = 28.sp,
            fontWeight = FontWeight.Black)
        Spacer(Modifier.height(24.dp))
        listOf(
            "0$count" to tr(lang, "Product experiences", "بخش‌های محصول"),
            "02" to tr(lang, "Partnership models to explore", "روش همکاری قابل بررسی"),
            "01" to tr(lang, "Dedicated partner dashboard", "داشبورد اختصاصی")
        ).forEachIndexed { index, pair ->
            HorizontalDivider(color = Color.White.copy(alpha = .23f))
            Spacer(Modifier.height(15.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(pair.first, color = Color.White, fontSize = 39.sp,
                    fontWeight = FontWeight.Black)
                Spacer(Modifier.width(19.dp))
                Text(pair.second, color = Color(0xFFE8ECFF), fontSize = 14.sp,
                    modifier = Modifier.weight(1f))
                Icon(Icons.Default.AutoAwesome, null, tint = Color.White,
                    modifier = Modifier.size(17.dp))
            }
            Spacer(Modifier.height(if(index==2)4.dp else 16.dp))
        }
    }
}

@Composable
private fun LightHeading(lang: Lang, label: String, en: String, fa: String) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(start = 24.dp, end = 24.dp, top = 53.dp, bottom = 24.dp)) {
        Text(label, color = partnerBlue, fontSize = 11.sp, letterSpacing = 2.sp,
            fontWeight = FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,en,fa), color = partnerNight,
            fontSize = 30.sp, fontWeight = FontWeight.Black, lineHeight = 35.sp)
    }
}

@Composable
private fun PartnerFeatures(lang: Lang) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=17.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
        val cards = listOf(
            Triple(Icons.Default.Casino,
                tr(lang,"One BetVima ecosystem","اکوسیستم یکپارچه"),
                tr(lang,"Sports and casino experiences in one brand.",
                    "تجربه ورزش و کازینو با هویت مشترک.")),
            Triple(Icons.Default.Smartphone,
                tr(lang,"Designed for mobile","طراحی ویژه موبایل"),
                tr(lang,"Native experiences and smooth navigation.",
                    "تجربه بومی و پیمایش نرم در اپلیکیشن.")),
            Triple(Icons.Default.Leaderboard,
                tr(lang,"Partner reporting","گزارش‌های همکاری"),
                tr(lang,"Review traffic, links and eligible commissions.",
                    "آمار ورودی، لینک‌ها و کمیسیون‌های مجاز."))
        )
        cards.forEachIndexed { i, card ->
            Surface(color = if (i == 0) Color(0xFF111828) else Color.White,
                shape = RoundedCornerShape(27.dp),
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 1.dp) {
                Column(Modifier.padding(23.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(card.first, null,
                            tint = if (i==0) partnerMint else partnerBlue,
                            modifier = Modifier.size(32.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(card.second,
                            color = if(i==0)Color.White else partnerNight,
                            fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(card.third,
                        color = if(i==0)Color(0xFFC0C9DE) else partnerMuted,
                        fontSize = 13.sp, lineHeight = 19.sp)
                    if(i==0) {
                        Spacer(Modifier.height(20.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                            Surface(color=Color(0xFF20355B),
                                shape=RoundedCornerShape(13.dp)) {
                                Row(Modifier.padding(15.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.SportsSoccer,null,
                                        tint=partnerMint,modifier=Modifier.size(44.dp))
                                    Spacer(Modifier.width(20.dp))
                                    Icon(Icons.Default.Casino,null,
                                        tint=Color(0xFFC8A1FF),modifier=Modifier.size(44.dp))
                                    Spacer(Modifier.width(20.dp))
                                    Icon(Icons.Default.Smartphone,null,
                                        tint=Color.White,modifier=Modifier.size(44.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PartnerChart(lang: Lang, active: Boolean) {
    val rise by animateFloatAsState(if (active) 1f else 0f,
        animationSpec = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
        label = "affiliate-chart")
    Column(Modifier.fillMaxWidth().background(partnerPaper).padding(17.dp)) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp))
            .background(Color(0xFF101625)).padding(22.dp)) {
            Text(tr(lang,"Statistics that move with you","آمار پویا و حرفه‌ای"),
                fontWeight = FontWeight.Black,color=Color.White,fontSize=23.sp)
            Spacer(Modifier.height(10.dp))
            Text(tr(lang,"Illustrative visualisation — your actual commissions are displayed only in the authenticated dashboard.",
                    "نمودار نمایشی است؛ ارقام واقعی فقط در داشبورد احراز هویت‌شده نمایش داده می‌شوند."),
                fontSize=11.sp,lineHeight=17.sp,color=Color(0xFFA9B6C7))
            Spacer(Modifier.height(26.dp))
            Row(Modifier.fillMaxWidth().height(180.dp),
                horizontalArrangement=Arrangement.spacedBy(8.dp),
                verticalAlignment=Alignment.Bottom) {
                listOf(.23f,.49f,.38f,.67f,.45f,.8f,.61f,1f).forEachIndexed { i, value ->
                    Box(Modifier.weight(1f).fillMaxHeight(value*rise.coerceAtLeast(.02f))
                        .clip(RoundedCornerShape(topStart=16.dp,topEnd=16.dp))
                        .background(if(i==5 || i==7)partnerMint else Color(0xFF283347)))
                }
            }
        }
    }
}

@Composable
private fun PartnerCoverage(lang: Lang, onGetStarted: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=24.dp, vertical=40.dp),
        horizontalAlignment=Alignment.CenterHorizontally) {
        Icon(Icons.Default.Public, null, tint=partnerBlue,
            modifier=Modifier.size(102.dp))
        Spacer(Modifier.height(19.dp))
        Text(tr(lang,"Partner thinking, worldwide","همکاری با نگاهی جهانی"),
            color=partnerNight, fontSize=27.sp, lineHeight=32.sp,
            fontWeight=FontWeight.Black, textAlign=TextAlign.Center)
        Spacer(Modifier.height(11.dp))
        Text(tr(lang,"Availability depends on the markets and territories approved for BetVima. Local restrictions apply.",
                "ارائه خدمات بر اساس قوانین منطقه و کشورهای مجاز BetVima تعیین می‌شود."),
            color=partnerMuted,fontSize=13.sp,textAlign=TextAlign.Center,lineHeight=19.sp)
        Spacer(Modifier.height(22.dp))
        Button(onClick=onGetStarted,
            shape=RoundedCornerShape(13.dp),
            colors=ButtonDefaults.buttonColors(containerColor=partnerNight)) {
            Text(tr(lang,"Become an affiliate","شروع همکاری"),
                color=Color.White,fontWeight=FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.ArrowForward,null,tint=Color.White)
        }
    }
}

@Composable
private fun PartnerProducts(lang: Lang) {
    Column(Modifier.fillMaxWidth().background(partnerNight)
        .padding(vertical=45.dp)) {
        Column(Modifier.padding(horizontal=24.dp)) {
            Text("PRODUCT", color=partnerMint,letterSpacing=2.sp,fontSize=11.sp,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(14.dp))
            Text(tr(lang,"The BetVima experience,\nin your pocket",
                    "محصولات بت‌ویما\nدر موبایل شما"),
                fontSize=30.sp,lineHeight=36.sp,color=Color.White,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(13.dp))
            Text(tr(lang,"Swipe to explore the platform.",
                "برای دیدن محصولات ورق بزنید."),
                color=Color(0xFF9CA3B7),fontSize=13.sp)
        }
        Spacer(Modifier.height(21.dp))
        LazyRow(contentPadding=PaddingValues(horizontal=20.dp),
            horizontalArrangement=Arrangement.spacedBy(13.dp)) {
            items(listOf(
                Triple(Icons.Default.Casino,"Casino","کازینو"),
                Triple(Icons.Default.SportsSoccer,"Sports","ورزش"),
                Triple(Icons.Default.Smartphone,"Mobile app","اپلیکیشن")
            )) { (icon, en, fa) ->
                Surface(modifier=Modifier.width(259.dp).height(325.dp),
                    shape=RoundedCornerShape(25.dp),
                    color=Color(0xFF171D28)) {
                    Column(Modifier.padding(22.dp)) {
                        Icon(icon,null,tint=partnerMint,
                            modifier=Modifier.size(34.dp))
                        Spacer(Modifier.height(11.dp))
                        Text(tr(lang,en,fa), color=Color.White,
                            fontSize=26.sp,fontWeight=FontWeight.Black)
                        Spacer(Modifier.height(8.dp))
                        Text(tr(lang,
                            "Explore BetVima products designed for discovery and mobile navigation.",
                            "محصولات بت‌ویما برای استفاده روان و راحت در موبایل."),
                            color=Color(0xFFBBC2D3),fontSize=12.sp,lineHeight=18.sp)
                        Spacer(Modifier.height(18.dp))
                        Box(Modifier.fillMaxWidth().height(130.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Brush.linearGradient(listOf(partnerBlue,
                                partnerViolet,Color(0xFF182D55)))),
                            contentAlignment=Alignment.Center) {
                            Icon(icon,null,tint=Color.White,modifier=Modifier.size(82.dp))
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(13.dp))
        Text("←   SWIPE   →",color=Color(0xFF99A3BE),
            modifier=Modifier.align(Alignment.CenterHorizontally),fontSize=11.sp)
    }
}

private data class PartnerQuestion(val en:String,val fa:String,val answerEn:String,val answerFa:String)
private val partnerQuestions=listOf(
    PartnerQuestion(
        "How do I earn with BetVima?","چطور از BetVima درآمد داشته باشم؟",
        "Register a separate partner account, share eligible referral links, and see approved commission in your dashboard.",
        "حساب همکاری بسازید، لینک اختصاصی را به اشتراک بگذارید و کمیسیون تأییدشده را در پنل ببینید."),
    PartnerQuestion(
        "RevShare or CPA?","RevShare و CPA چه تفاوتی دارند؟",
        "RevShare follows your approved revenue agreement. CPA requires a separate approval and is not automatically active.",
        "RevShare طبق قرارداد درآمدی محاسبه می‌شود. CPA نیاز به تأیید جداگانه دارد و به‌صورت خودکار فعال نیست."),
    PartnerQuestion(
        "When are payouts issued?","تسویه چه زمانی انجام می‌شود؟",
        "Payment timing and eligibility follow the current approved partner agreement and account settlement rules.",
        "زمان و شرایط برداشت مطابق قرارداد تأییدشده و مقررات تسویه حساب است."),
    PartnerQuestion(
        "How can I check my statistics?","آمار را کجا می‌بینم؟",
        "Sign in to your native partner dashboard for traffic, referrals, and account-authorized reports.",
        "پس از ورود به پنل بومی، آمار ورودی‌ها، معرفی‌ها و گزارش‌های حساب را ببینید.")
)

@Composable
private fun PartnerFaq(lang: Lang) {
    Column(Modifier.fillMaxWidth().background(partnerPaper)
        .padding(horizontal=19.dp, vertical=45.dp)) {
        Text("FAQ",color=partnerBlue,letterSpacing=2.sp,fontSize=12.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Frequently asked questions","پرسش‌های متداول"),
            color=partnerNight,fontSize=29.sp,fontWeight=FontWeight.Black,
            lineHeight=34.sp)
        Spacer(Modifier.height(18.dp))
        Surface(color=Color.White,shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(17.dp)) {
                Text(tr(lang,"Hello! Tell me about joining BetVima.",
                        "سلام! درباره همکاری با بت‌ویما توضیح می‌دهید؟"),
                    color=partnerNight,fontSize=12.sp)
                Spacer(Modifier.height(9.dp))
                Text(tr(lang,"Welcome! Create a partner account to get started.",
                        "خوش آمدید! برای شروع یک حساب همکار ایجاد کنید."),
                    modifier=Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(13.dp))
                        .background(partnerBlue).padding(13.dp),
                    color=Color.White,fontSize=12.sp)
            }
        }
        Spacer(Modifier.height(21.dp))
        partnerQuestions.forEachIndexed { index, question ->
            var expanded by rememberSaveable(index) { mutableStateOf(false) }
            Column(Modifier.padding(vertical=6.dp).fillMaxWidth()
                .clip(RoundedCornerShape(19.dp))
                .background(Color.White).animateContentSize()) {
                Row(Modifier.fillMaxWidth().clickable { expanded=!expanded }
                    .padding(17.dp), verticalAlignment=Alignment.CenterVertically) {
                    Text(tr(lang,question.en,question.fa),
                        color=partnerNight,fontSize=15.sp,
                        fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                    Icon(if(expanded)Icons.Default.Remove else Icons.Default.Add,
                        null,tint=partnerBlue)
                }
                if(expanded) {
                    Text(tr(lang,question.answerEn,question.answerFa),
                        modifier=Modifier.padding(start=17.dp,end=17.dp,bottom=19.dp),
                        color=partnerMuted,fontSize=12.sp,lineHeight=19.sp)
                }
            }
        }
    }
}

@Composable
private fun PartnerGallery(lang: Lang) {
    Column(Modifier.fillMaxWidth().background(Color(0xFFFAFAFD))
        .padding(20.dp)) {
        Text("ABOUT US",color=partnerBlue,letterSpacing=2.sp,
            fontWeight=FontWeight.Black,fontSize=11.sp)
        Spacer(Modifier.height(12.dp))
        Text(tr(lang,"Discover BetVima","دنیای بت‌ویما"),
            color=partnerNight,fontWeight=FontWeight.Black,fontSize=31.sp)
        Spacer(Modifier.height(16.dp))
        val tiles=listOf(
            Triple(Icons.Default.Smartphone,"BETVIMA","MOBILE"),
            Triple(Icons.Default.SportsSoccer,"SPORTS","EXPERIENCE"),
            Triple(Icons.Default.Casino,"CASINO","DISCOVERY"),
            Triple(Icons.Default.ShowChart,"PARTNER","INSIGHTS")
        )
        tiles.chunked(2).forEachIndexed { row, group ->
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                group.forEachIndexed { col, tile ->
                    val tone=when(row*2+col) {
                        0 -> listOf(Color(0xFF1B56E9),Color(0xFF222449))
                        1 -> listOf(Color(0xFF118C88),Color(0xFF11253B))
                        2 -> listOf(Color(0xFF8D49B7),Color(0xFF292052))
                        else -> listOf(Color(0xFF00A57A),Color(0xFF19354F))
                    }
                    Column(Modifier.weight(1f).height(178.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brush.linearGradient(tone))
                        .padding(16.dp),
                        verticalArrangement=Arrangement.Center,
                        horizontalAlignment=Alignment.CenterHorizontally) {
                        Icon(tile.first,null,tint=Color.White,
                            modifier=Modifier.size(52.dp))
                        Spacer(Modifier.height(15.dp))
                        Text(tile.second+"\n"+tile.third,
                            color=Color.White,fontSize=13.sp,
                            fontWeight=FontWeight.Black,textAlign=TextAlign.Center)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun PartnerSignup(lang: Lang, onGetStarted: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(partnerNight)
        .padding(horizontal=23.dp,vertical=58.dp)) {
        Text("JOIN US",color=partnerMint,fontSize=11.sp,letterSpacing=2.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Start earning right now","همین حالا همکاری را آغاز کنید"),
            color=Color.White,fontSize=32.sp,lineHeight=38.sp,
            fontWeight=FontWeight.Black)
        Spacer(Modifier.height(13.dp))
        Text(tr(lang,"Your own partner login, referral dashboard and approved contract terms.",
                "ورود اختصاصی، داشبورد ارجاع‌ها و شرایط قرارداد تأییدشده."),
            color=Color(0xFF9DA8BE),fontSize=13.sp,lineHeight=20.sp)
        Spacer(Modifier.height(26.dp))
        Button(onClick=onGetStarted, modifier=Modifier.fillMaxWidth().height(56.dp),
            shape=RoundedCornerShape(16.dp),
            colors=ButtonDefaults.buttonColors(containerColor=partnerBlue)) {
            Text(tr(lang,"Sign up or log in","ثبت‌نام یا ورود"),color=Color.White,
                fontSize=16.sp,fontWeight=FontWeight.Bold)
            Spacer(Modifier.width(9.dp))
            Icon(Icons.Default.ArrowForward,null,tint=Color.White)
        }
        Spacer(Modifier.height(27.dp))
        HorizontalDivider(color=Color.White.copy(alpha=.14f))
        Spacer(Modifier.height(22.dp))
        Text(tr(lang,"Contact us","ارتباط با ما"),
            color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Black)
        Spacer(Modifier.height(11.dp))
        Row(verticalAlignment=Alignment.CenterVertically) {
            Icon(Icons.Default.Email,null,tint=partnerMint,
                modifier=Modifier.size(21.dp))
            Spacer(Modifier.width(9.dp))
            Text("BetVimaSupport@gmail.com",color=Color.White,fontSize=13.sp)
        }
        Spacer(Modifier.height(26.dp))
        Text(tr(lang,"Partnership eligibility and payments are subject to applicable rules and approved agreements.",
            "شرایط همکاری و تسویه تابع قوانین و قرارداد تأییدشده است."),
            color=Color(0xFF7E879B),fontSize=11.sp,lineHeight=18.sp)
    }
}
