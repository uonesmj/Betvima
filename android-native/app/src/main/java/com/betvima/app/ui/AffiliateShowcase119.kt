package com.betvima.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Public marketing screen only. Account figures never come from illustrations.
// No financial ledger, authentication or registration logic lives in this file.
private val cNight = Color(0xFF070B09)
private val cPanel = Color(0xFF111A14)
private val cMint = Color(0xFF50D78E)
private val cForest = Color(0xFF145D3B)
private val cIvory = Color(0xFFF7FAF6)
private val cPale = Color(0xFFE8F3EB)
private val cSlate = Color(0xFF75857A)

@Composable
internal fun AffiliateShowcase119(
    lang: Lang,
    onRegister: () -> Unit,
    onLogin: () -> Unit
) {
    val scrollState = rememberLazyListState()
    val fadeInStarted = remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { fadeInStarted.value = true }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(cNight),
        state = scrollState,
        flingBehavior = rememberPremiumFlingBehavior(),
        contentPadding = PaddingValues(bottom = 0.dp)
    ) {
        item(key="partner-main-hero") {
            Affiliate119Hero(lang, fadeInStarted.value, onRegister, onLogin)
        }
        item(key="partner-advantage") {
            Affiliate119Advantage(lang)
        }
        item(key="partner-categories") {
            Affiliate119Products(lang)
        }
        item(key="partner-earnings") {
            Affiliate119Earnings(lang, onRegister)
        }
        item(key="partner-stories") {
            Affiliate119Gallery(lang)
        }
        item(key="partner-faq") {
            Affiliate119Faq(lang)
        }
        item(key="partner-final-action") {
            Affiliate119Join(lang,onRegister,onLogin)
        }
    }
}

@Composable
private fun Affiliate119Hero(
    lang: Lang, active: Boolean, onRegister: () -> Unit, onLogin: () -> Unit
) {
    Box(Modifier.fillMaxWidth().height(510.dp).background(cNight)) {
        AffiliateCinematicPhoto(
            scene=AffiliateScene.HERO, active=active, corner=0,
            modifier=Modifier.fillMaxSize()
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            listOf(cNight.copy(alpha=.02f),cNight.copy(alpha=.03f),
                cNight.copy(alpha=.54f),cNight.copy(alpha=.98f)))))
        Column(Modifier.align(Alignment.BottomStart)
            .fillMaxWidth().padding(horizontal=23.dp,vertical=28.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                Icon(Icons.Default.AutoAwesome,null,tint=cMint,
                    modifier=Modifier.size(15.dp))
                Text(tr(lang,"THE PARTNER PROGRAM","برنامه همکاری حرفه‌ای"),
                    color=cMint,fontSize=11.sp,fontWeight=FontWeight.Bold,
                    letterSpacing=1.4.sp)
            }
            Text(tr(lang,"MAKE YOUR IMPACT","اثرگذاری شما"),
                color=Color.White,fontWeight=FontWeight.Black,fontSize=30.sp,
                lineHeight=36.sp)
            Text(tr(lang,"GROW WITH BETVIMA","رشد با بت‌ویما"),
                color=cMint,fontWeight=FontWeight.Black,fontSize=32.sp,
                lineHeight=38.sp)
            Text(tr(lang,
                "A professional platform to share campaigns, follow verified results and request payouts.",
                "پنل حرفه‌ای معرفی کاربران، ساخت کمپین، پیگیری آمار تأییدشده و درخواست برداشت."),
                color=Color(0xFFE1ECE3),fontSize=12.sp,lineHeight=20.sp)
            Affiliate119Primary(
                tr(lang,"Become an affiliate","شروع همکاری"),
                onRegister, modifier=Modifier.fillMaxWidth())
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.Center) {
                TextButton(onClick=onLogin) {
                    Text(tr(lang,"Already a partner? Sign in","حساب همکاری دارید؟ ورود"),
                        color=Color.White,fontSize=12.sp,fontWeight=FontWeight.Bold)
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Default.ArrowForward,null,
                        tint=cMint,modifier=Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun Affiliate119Advantage(lang: Lang) {
    // Curved section bridges the cinematic hero and the editorial product gallery.
    Column(Modifier.fillMaxWidth()
        .clip(RoundedCornerShape(topStart=35.dp,topEnd=35.dp))
        .background(cIvory).padding(start=21.dp,end=21.dp,top=26.dp,bottom=32.dp),
        verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Affiliate119Eyebrow(tr(lang,"YOUR PARTNERSHIP","همکاری شما"),cForest)
        Text(tr(lang,"Built for real growth","برای رشد واقعی طراحی شده"),
            color=cNight,fontSize=28.sp,fontWeight=FontWeight.Black,lineHeight=34.sp)
        Text(tr(lang,
            "Share BetVima with your audience and manage commissions from one secure dashboard.",
            "بت‌ویما را به مخاطبان خود معرفی کنید و کمیسیون‌ها را از یک داشبورد امن مدیریت کنید."),
            color=Color(0xFF526359),fontSize=12.sp,lineHeight=20.sp)
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(cNight).padding(20.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Text("70%",color=cMint,fontSize=44.sp,fontWeight=FontWeight.Black)
            Spacer(Modifier.width(18.dp))
            Column(Modifier.weight(1f)) {
                Text(tr(lang,"Default revenue share","نرخ پایه کمیسیون"),
                    color=Color.White,fontWeight=FontWeight.Bold,fontSize=14.sp)
                Text(tr(lang,
                    "For approved accounts. Your actual rate is shown after sign-in.",
                    "برای حساب‌های تأییدشده؛ نرخ واقعی حساب پس از ورود نمایش داده می‌شود."),
                    color=Color(0xFFB8CBC0),fontSize=11.sp,lineHeight=16.sp)
            }
        }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(cPale)) {
            Affiliate119BenefitRow(Icons.Default.CalendarMonth,
                tr(lang,"Weekly settlement","تسویه هفتگی"),
                tr(lang,"Subject to your agreement and approved statement",
                    "مطابق قرارداد و صورت‌حساب تأییدشده"))
            HorizontalDivider(color=Color(0xFFD3E6D9),modifier=Modifier.padding(horizontal=17.dp))
            Affiliate119BenefitRow(Icons.Default.VerifiedUser,
                tr(lang,"Verified partner analytics","گزارش معتبر همکاری"),
                tr(lang,"Track attributed signups and earned commission",
                    "ثبت‌نام‌های منتسب و کمیسیون کسب‌شده"))
            HorizontalDivider(color=Color(0xFFD3E6D9),modifier=Modifier.padding(horizontal=17.dp))
            Affiliate119BenefitRow(Icons.Default.PhoneAndroid,
                tr(lang,"Native Android workspace","پنل نیتیو اندروید"),
                tr(lang,"Campaigns and payouts in one app",
                    "کمپین‌ها و برداشت‌ها در یک اپلیکیشن"))
        }
    }
}

@Composable
private fun Affiliate119BenefitRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String, subtitle: String
) {
    Row(Modifier.fillMaxWidth().padding(horizontal=17.dp,vertical=16.dp),
        verticalAlignment=Alignment.CenterVertically) {
        Surface(color=Color.White,shape=RoundedCornerShape(13.dp)) {
            Icon(icon,null,tint=cForest,
                modifier=Modifier.padding(11.dp).size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title,color=cNight,fontSize=13.sp,fontWeight=FontWeight.Black)
            Text(subtitle,color=Color(0xFF617B69),fontSize=11.sp,
                lineHeight=16.sp)
        }
    }
}

private data class Affiliate119Product(
    val scene: AffiliateScene,
    val name: String,
    val nameFa: String,
    val desc: String,
    val descFa: String
)

@Composable
private fun Affiliate119Products(lang:Lang) {
    Column(Modifier.fillMaxWidth().background(cNight)
        .padding(top=29.dp,bottom=33.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)) {
        Column(Modifier.padding(horizontal=22.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Affiliate119Eyebrow(tr(lang,"OUR PRODUCTS","محصولات بت‌ویما"),cMint)
            Text(tr(lang,"Bring players together","مخاطبان بیشتری جذب کنید"),
                color=Color.White,fontSize=27.sp,
                fontWeight=FontWeight.Black,lineHeight=33.sp)
            Text(tr(lang,"Explore the experiences you can introduce to your audience.",
                "محصولاتی را معرفی کنید که مخاطبان شما به آن علاقه دارند."),
                color=Color(0xFFAFBCB2),fontSize=12.sp,lineHeight=19.sp)
        }
        val categories = listOf(
            Affiliate119Product(AffiliateScene.SPORTS,"Sports","ورزش",
                "Live fixtures and pre-match markets","مسابقات زنده و پیش از شروع"),
            Affiliate119Product(AffiliateScene.CASINO,"Casino","کازینو",
                "Games from the available casino catalogue","بازی‌های موجود در کاتالوگ کازینو"),
            Affiliate119Product(AffiliateScene.MOBILE,"Android app","اپلیکیشن",
                "Native mobile partner access","دسترسی نیتیو به پنل همکاری")
        )
        LazyRow(horizontalArrangement=Arrangement.spacedBy(12.dp),
            contentPadding=PaddingValues(horizontal=20.dp)) {
            items(categories,key={it.name}) { product ->
                Box(Modifier.width(260.dp).height(310.dp)
                    .clip(RoundedCornerShape(27.dp))) {
                    AffiliateCinematicPhoto(scene=product.scene,
                        modifier=Modifier.fillMaxSize(),corner=27)
                    Box(Modifier.fillMaxSize().background(
                        Brush.verticalGradient(listOf(Color.Transparent,
                            cNight.copy(alpha=.12f),cNight.copy(alpha=.9f)))))
                    Column(Modifier.align(Alignment.BottomStart).padding(19.dp)) {
                        Text(tr(lang,product.name,product.nameFa),color=Color.White,
                            fontSize=25.sp,fontWeight=FontWeight.Black)
                        Text(tr(lang,product.desc,product.descFa),
                            color=Color(0xFFD3E3D6),fontSize=12.sp,
                            lineHeight=18.sp,modifier=Modifier.padding(top=7.dp))
                        Spacer(Modifier.height(10.dp))
                        Box(Modifier.width(54.dp).height(3.dp)
                            .clip(CircleShape).background(cMint))
                    }
                }
            }
        }
    }
}

@Composable
private fun Affiliate119Earnings(lang:Lang,onRegister:()->Unit) {
    Column(Modifier.fillMaxWidth()
        .clip(RoundedCornerShape(topStart=34.dp,topEnd=34.dp))
        .background(cIvory)
        .padding(top=25.dp,bottom=28.dp),
        verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Column(Modifier.padding(horizontal=22.dp),
            verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Affiliate119Eyebrow(tr(lang,"AFFILIATE ADVANTAGES","مزایای همکاری"),cForest)
            Text(tr(lang,"Share. Track. Grow.","معرفی، پیگیری، رشد"),
                fontSize=28.sp,fontWeight=FontWeight.Black,
                color=cNight,lineHeight=34.sp)
        }
        Box(Modifier.fillMaxWidth().height(265.dp)
            .padding(horizontal=18.dp)
            .clip(RoundedCornerShape(26.dp))) {
            AffiliateCinematicPhoto(AffiliateScene.STATISTICS,
                modifier=Modifier.fillMaxSize(),corner=26)
            Box(Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color.Transparent,
                    cNight.copy(alpha=.05f),cNight.copy(alpha=.86f)))))
            Column(Modifier.align(Alignment.BottomStart).padding(18.dp)) {
                Text(tr(lang,"Real reports, not estimates","آمار واقعی، نه تخمینی"),
                    color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Black)
                Text(tr(lang,
                    "Verified registrations, available commission and payout history in your account.",
                    "ثبت‌نام‌های تأییدشده، کمیسیون قابل برداشت و سوابق پرداخت در حساب شما."),
                    color=Color(0xFFE3F4E8),fontSize=11.sp,lineHeight=18.sp)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal=20.dp),
            horizontalArrangement=Arrangement.spacedBy(1.dp)) {
            Affiliate119Step(Modifier.weight(1f),Icons.Default.Link,
                tr(lang,"Invite","دعوت"),"01")
            Affiliate119Step(Modifier.weight(1f),Icons.Default.QueryStats,
                tr(lang,"Track","پیگیری"),"02")
            Affiliate119Step(Modifier.weight(1f),Icons.Default.Payments,
                tr(lang,"Request payout","برداشت"),"03")
        }
        Column(Modifier.padding(horizontal=22.dp)) {
            Text(tr(lang,
                "Commissions depend on approved affiliate terms and verified account activity. A request is reviewed before payment.",
                "کمیسیون تابع قرارداد تأییدشده و فعالیت واقعی حساب است. درخواست برداشت پیش از پرداخت بررسی می‌شود."),
                color=cSlate,fontSize=11.sp,lineHeight=19.sp)
            Spacer(Modifier.height(13.dp))
            Affiliate119Primary(tr(lang,"Start partnering","شروع همکاری"),
                onRegister,Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun Affiliate119Step(modifier:Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,label:String,number:String) {
    Column(modifier.background(cPale).padding(vertical=16.dp,horizontal=6.dp),
        horizontalAlignment=Alignment.CenterHorizontally,
        verticalArrangement=Arrangement.spacedBy(7.dp)) {
        Icon(icon,null,tint=cForest,modifier=Modifier.size(23.dp))
        Text(number,color=cSlate,fontSize=10.sp,fontWeight=FontWeight.Bold)
        Text(label,color=cNight,fontSize=11.sp,fontWeight=FontWeight.Bold,
            maxLines=1,overflow=TextOverflow.Ellipsis)
    }
}

@Composable
private fun Affiliate119Gallery(lang: Lang) {
    Column(Modifier.fillMaxWidth().background(cNight)
        .padding(top=30.dp,bottom=32.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)) {
        Column(Modifier.padding(horizontal=22.dp)) {
            Affiliate119Eyebrow(tr(lang,"THE BETVIMA EXPERIENCE","تجربه بت‌ویما"),cMint)
            Spacer(Modifier.height(9.dp))
            Text(tr(lang,"One brand. More opportunities.","یک برند؛ فرصت‌های بیشتر"),
                color=Color.White,fontSize=26.sp,
                fontWeight=FontWeight.Black,lineHeight=32.sp)
        }
        val photos=listOf(
            AffiliateScene.ECOSYSTEM to tr(lang,"Sports community","جامعه ورزشی"),
            AffiliateScene.JOIN to tr(lang,"Partner growth","رشد همکاران"),
            AffiliateScene.GEOGRAPHY to tr(lang,"Global vision","نگاه جهانی"),
            AffiliateScene.NUMBERS to tr(lang,"Track results","پیگیری نتایج")
        )
        LazyRow(horizontalArrangement=Arrangement.spacedBy(11.dp),
            contentPadding=PaddingValues(horizontal=20.dp)) {
            items(photos,key={it.first.name}) { (photo,caption) ->
                Box(Modifier.width(225.dp).height(220.dp)
                    .clip(RoundedCornerShape(24.dp))) {
                    AffiliateCinematicPhoto(scene=photo,
                        modifier=Modifier.fillMaxSize(),corner=24)
                    Box(Modifier.fillMaxSize().background(
                        Brush.verticalGradient(listOf(Color.Transparent,cNight.copy(alpha=.92f)))))
                    Row(Modifier.align(Alignment.BottomStart).fillMaxWidth()
                        .padding(horizontal=14.dp,vertical=17.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Text(caption,color=Color.White,fontSize=13.sp,
                            fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
                        Icon(Icons.Default.NorthEast,null,tint=cMint,
                            modifier=Modifier.size(17.dp))
                    }
                }
            }
        }
    }
}

private data class Affiliate119Question(
    val en:String,val fa:String,val answerEn:String,val answerFa:String
)

@Composable
private fun Affiliate119Faq(lang:Lang) {
    val questions=listOf(
        Affiliate119Question("How can I join?","چطور عضو شوم؟",
            "Create an affiliate account and wait for approval. Then sign in to manage campaigns.",
            "حساب همکاری بسازید و منتظر تأیید بمانید. سپس برای مدیریت کمپین‌ها وارد شوید."),
        Affiliate119Question("Is the 70% rate guaranteed?","آیا نرخ ۷۰٪ تضمین شده است؟",
            "The public programme shows a default rate. Your approved account rate and campaign terms take precedence.",
            "نرخ اعلامی برنامه پایه است؛ نرخ حساب تأییدشده و شرایط کمپین ملاک هستند."),
        Affiliate119Question("When are payouts available?","برداشت سود چه زمانی ممکن است؟",
            "Settlement is generally weekly. Requests depend on a verified payable balance, minimum amount and approval.",
            "تسویه معمولاً هفتگی است. درخواست برداشت تابع موجودی تأییدشده، حداقل مبلغ و تأیید پرداخت است."),
        Affiliate119Question("Where do I see my referrals?","زیرمجموعه‌ها کجا هستند؟",
            "After signing in, use the Referrals page for the data your account is allowed to access.",
            "پس از ورود از صفحه زیرمجموعه‌ها، اطلاعات مجاز حساب خود را ببینید.")
    )
    var expanded by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxWidth()
        .clip(RoundedCornerShape(topStart=35.dp,topEnd=35.dp))
        .background(cIvory)
        .padding(start=19.dp,end=19.dp,top=27.dp,bottom=33.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Affiliate119Eyebrow("FAQ",cForest)
        Text(tr(lang,"Frequently asked questions","پرسش‌های متداول"),
            color=cNight,fontSize=27.sp,fontWeight=FontWeight.Black)
        Spacer(Modifier.height(4.dp))
        Column(Modifier.clip(RoundedCornerShape(23.dp)).background(cPale)) {
            questions.forEachIndexed { idx,q ->
                Column {
                    Row(Modifier.fillMaxWidth().clickable { expanded=if(expanded==idx)-1 else idx }
                        .padding(horizontal=15.dp,vertical=17.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Text(tr(lang,q.en,q.fa),color=cNight,fontSize=13.sp,
                            fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                        Icon(if(expanded==idx)Icons.Default.Remove else Icons.Default.Add,
                            null,tint=cForest)
                    }
                    AnimatedVisibility(
                        visible=expanded==idx,
                        enter=fadeIn(tween(190))+slideInVertically(tween(190)){ -it/8 }
                    ) {
                        Text(tr(lang,q.answerEn,q.answerFa),
                            color=Color(0xFF466252),fontSize=12.sp,lineHeight=20.sp,
                            modifier=Modifier.padding(start=15.dp,end=15.dp,bottom=17.dp))
                    }
                    if(idx<questions.lastIndex) HorizontalDivider(
                        color=Color(0xFFCBDDD0),
                        modifier=Modifier.padding(horizontal=15.dp))
                }
            }
        }
    }
}

@Composable
private fun Affiliate119Join(lang:Lang,onRegister:()->Unit,onLogin:()->Unit) {
    Box(Modifier.fillMaxWidth().height(355.dp)) {
        AffiliateCinematicPhoto(AffiliateScene.JOIN,
            modifier=Modifier.fillMaxSize(),corner=0)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(
            cNight.copy(alpha=.15f),cNight.copy(alpha=.66f),cNight.copy(alpha=.97f)))))
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()
            .padding(horizontal=22.dp,vertical=24.dp),
            verticalArrangement=Arrangement.spacedBy(13.dp)) {
            Affiliate119Eyebrow(tr(lang,"BECOME A PARTNER","به خانواده همکاران بپیوندید"),cMint)
            Text(tr(lang,"Ready to grow?","آماده رشد هستید؟"),
                color=Color.White,fontSize=28.sp,fontWeight=FontWeight.Black)
            Affiliate119Primary(tr(lang,"Join BetVima Partners","عضویت در بت‌ویما"),
                onRegister,Modifier.fillMaxWidth())
            TextButton(onClick=onLogin) {
                Text(tr(lang,"Partner sign in","ورود به پنل همکاری"),
                    color=Color.White,fontWeight=FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Affiliate119Eyebrow(text:String,color:Color) {
    Row(verticalAlignment=Alignment.CenterVertically,
        horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(color))
        Text(text,color=color,fontWeight=FontWeight.Black,
            fontSize=10.sp,letterSpacing=1.5.sp)
    }
}

@Composable
private fun Affiliate119Primary(label:String,onClick:()->Unit,modifier:Modifier=Modifier) {
    val glow = rememberInfiniteTransition(label="affiliate-cta-breath")
    val progress by glow.animateFloat(initialValue=.90f,targetValue=1f,
        animationSpec=infiniteRepeatable(tween(2300,easing=EaseInOutSine),
            repeatMode=RepeatMode.Reverse),label="affiliate-cta-glow")
    Button(
        onClick=onClick,
        modifier=modifier.height(56.dp).graphicsLayer { alpha=progress },
        shape=RoundedCornerShape(17.dp),
        colors=ButtonDefaults.buttonColors(containerColor=cMint),
        contentPadding=PaddingValues(horizontal=19.dp)
    ) {
        Text(label,color=cNight,fontSize=14.sp,fontWeight=FontWeight.Black,
            modifier=Modifier.weight(1f),textAlign=TextAlign.Center)
        Icon(Icons.Default.ArrowForward,null,tint=cNight,modifier=Modifier.size(20.dp))
    }
}
