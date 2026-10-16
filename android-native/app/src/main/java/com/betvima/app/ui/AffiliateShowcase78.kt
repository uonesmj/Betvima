package com.betvima.app.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.min

// All values in the promotional chart are schematic. Financial amounts are never
// taken from illustrative media; the signed-in server-backed dashboard is authoritative.
private val a78Background = Color(0xFF07101E)
private val a78Panel = Color(0xFF101C2E)
private val a78Green = Color(0xFF00D47A)
private val a78Blue = Color(0xFF168CFF)
private val a78Lilac = Color(0xFFC288FF)
private val a78Muted = Color(0xFFB5C6DA)

@Composable
internal fun AffiliateShowcase78(
    lang: Lang, onRegister: () -> Unit, onLogin: () -> Unit
) {
    val scroll = rememberLazyListState()
    fun isVisible(index: Int): Boolean =
        scroll.layoutInfo.visibleItemsInfo.any { it.index == index }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(a78Background),
        state = scroll,
        flingBehavior = rememberPremiumFlingBehavior(),
        contentPadding = PaddingValues(bottom = 29.dp)
    ) {
        item(key = "hero78") {
            val active by remember { derivedStateOf { isVisible(0) } }
            AffiliateReveal(visible = active) {
                Column {
                    A78Hero(lang, active, onRegister, onLogin)
                    A78PartnerTerms83(lang)
                }
            }
        }
        item(key = "products78") {
            val active by remember { derivedStateOf { isVisible(1) } }
            A78Products(lang, active)
        }
        item(key = "report78") {
            val active by remember { derivedStateOf { isVisible(2) } }
            AffiliateReveal(visible=active,delayMillis=60) {
                A78Analytics(lang, active)
            }
        }
        item(key = "tools78") {
            val active by remember { derivedStateOf { isVisible(3) } }
            A78Tools(lang, active)
        }
        item(key = "ecosystem78") {
            val active by remember { derivedStateOf { isVisible(4) } }
            A78Ecosystem(lang, active)
        }
        item(key = "gallery78") {
            val active by remember { derivedStateOf { isVisible(5) } }
            A78Gallery(lang, active)
        }
        item(key = "faq78") {
            A78Faq(lang)
        }
        item(key = "join78") {
            val active by remember { derivedStateOf { isVisible(7) } }
            A78Join(lang, active, onRegister, onLogin)
        }
    }
}

@Composable
private fun A78Logo(modifier: Modifier=Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(
            painter=painterResource(com.betvima.app.R.drawable.ic_betvima_mini),
            contentDescription=null,
            tint=a78Green,
            modifier=Modifier.size(22.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text("BetVima", fontWeight=FontWeight.Black, color=Color.White,
            fontSize=17.sp,letterSpacing=(-.6).sp)
    }
}

@Composable
private fun A78Eyebrow(text: String, color: Color=a78Green) {
    Text(text, color=color, letterSpacing=2.sp,
        fontWeight=FontWeight.Black, fontSize=10.sp)
}

@Composable
private fun A78Action(label: String, onClick: () -> Unit,
                       modifier: Modifier=Modifier) {
    Button(
        onClick=onClick,
        modifier=modifier.height(53.dp),
        colors=ButtonDefaults.buttonColors(containerColor=a78Green),
        shape=RoundedCornerShape(17.dp),
        elevation=ButtonDefaults.buttonElevation(defaultElevation=4.dp)
    ) {
        Text(label, color=a78Background, fontWeight=FontWeight.ExtraBold,
            fontSize=15.sp)
        Spacer(Modifier.width(12.dp))
        Icon(Icons.Default.ArrowForward,contentDescription=null,
            tint=a78Background,modifier=Modifier.size(20.dp))
    }
}

@Composable
private fun A78Hero(lang: Lang, active: Boolean, onRegister: () -> Unit,
                    onLogin: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(11.dp)
        .clip(RoundedCornerShape(23.dp))
        .background(Color(0xFF0D1C30))) {
        AffiliateCinematicPhoto(
            scene=AffiliateScene.HERO,
            modifier=Modifier.fillMaxWidth().height(208.dp),
            active=active,corner=22,showMark=false
        )
        Column(Modifier.padding(horizontal=18.dp,vertical=19.dp)) {
            A78Eyebrow(tr(lang,"TURN PASSION INTO OPPORTUNITY",
                "همکاری و رشد با بت‌ویما"))
            Spacer(Modifier.height(8.dp))
            Text(tr(lang,"Grow with BetVima","با BetVima رشد کنید"),
                fontSize=30.sp,lineHeight=35.sp,color=Color.White,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(8.dp))
            Text(tr(lang,
                "Discover sports, casino and the tools behind our partner program.",
                "با محصولات ورزشی، کازینو و ابزارهای همکاری آشنا شوید."),
                color=a78Muted,fontSize=13.sp,lineHeight=19.sp)
            Spacer(Modifier.height(16.dp))
            A78Action(
                tr(lang,"Become an affiliate","شروع همکاری"),
                onRegister,Modifier.fillMaxWidth()
            )
            TextButton(
                onClick=onLogin,
                modifier=Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text(tr(lang,"Already a partner? Log in",
                    "قبلاً ثبت‌نام کرده‌اید؟ ورود"),
                    color=Color.White,fontSize=12.sp)
            }
        }
    }
}

@Composable
private fun A78PartnerTerms83(lang: Lang) {
    val panelShape = RoundedCornerShape(21.dp)
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 7.dp)
        .clip(panelShape)
        .background(Brush.verticalGradient(listOf(
            Color(0xFF143D37), Color(0xFF132837), Color(0xFF101C30))))
        .border(1.dp, Color(0xFF3F655F).copy(alpha = .65f), panelShape)
        .padding(17.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.TrendingUp, null, tint = a78Green,
                modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text(tr(lang, "PARTNER PROGRAM", "برنامه همکاری"),
                color = a78Green, fontSize = 10.sp,
                fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
        }
        Text(tr(lang, "Built for partners", "همکاری حرفه‌ای با بت‌ویما"),
            color = Color.White, fontSize = 23.sp, lineHeight = 28.sp,
            fontWeight = FontWeight.Black)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("70%", color = Color(0xFF43F0A9), fontSize = 37.sp,
                fontWeight = FontWeight.Black)
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(tr(lang, "Default revenue share", "سهم درآمد پیش‌فرض"),
                    color = Color.White, fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold)
                Text(tr(lang, "For approved affiliate accounts",
                        "برای حساب‌های افیلیت تأییدشده"),
                    color = a78Muted, fontSize = 11.sp)
            }
        }
        HorizontalDivider(color = Color.White.copy(alpha = .12f))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Icon(Icons.Default.CalendarMonth, null,
                    tint = Color(0xFF7CC6FF), modifier = Modifier.size(21.dp))
                Text(tr(lang, "Weekly settlement", "تسویه هفتگی"),
                    color = Color.White, fontSize = 12.sp,
                    fontWeight = FontWeight.Black)
                Text(tr(lang, "Subject to approved statements and terms",
                    "مطابق صورت‌حساب و شرایط تأییدشده"),
                    color = a78Muted, fontSize = 10.sp, lineHeight = 14.sp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Icon(Icons.Default.Smartphone, null,
                    tint = Color(0xFF7CC6FF), modifier = Modifier.size(21.dp))
                Text(tr(lang, "Android partner access", "دسترسی اختصاصی اندروید"),
                    color = Color.White, fontSize = 12.sp,
                    fontWeight = FontWeight.Black)
                Text(tr(lang, "Affiliate tools in the BetVima Android app",
                    "ابزارهای افیلیت در اپ اندروید بت‌ویما"),
                    color = a78Muted, fontSize = 10.sp, lineHeight = 14.sp)
            }
        }
        Text(tr(lang,
            "Revenue share and settlement depend on approval, the affiliate agreement and verified reporting; no automatic payment is implied.",
            "سهم درآمد و تسویه تابع تأیید حساب، قرارداد همکاری و گزارش‌های مالی معتبر است؛ این توضیح به معنی پرداخت خودکار نیست."),
            color = Color(0xFFB3C5D1), fontSize = 9.sp, lineHeight = 14.sp)
    }
}

@Composable
private fun A78Products(lang: Lang, active: Boolean) {
    Column(Modifier.fillMaxWidth().padding(vertical=24.dp)) {
        Column(Modifier.padding(horizontal=19.dp)) {
            A78Eyebrow(tr(lang,"OUR PRODUCTS","محصولات ما"))
            Spacer(Modifier.height(9.dp))
            Text(tr(lang,"One powerful ecosystem","یک اکوسیستم قدرتمند"),
                fontSize=28.sp,lineHeight=33.sp,
                fontWeight=FontWeight.Black,color=Color.White)
            Text(tr(lang,"Explore a different experience in each category.",
                "در هر بخش تجربه‌ای متفاوت را کشف کنید."),
                color=a78Muted,fontSize=13.sp,
                modifier=Modifier.padding(top=7.dp,bottom=15.dp))
        }
        val kinds=listOf(
            Triple(AffiliateScene.SPORTS, "Sports", "ورزش"),
            Triple(AffiliateScene.CASINO,"Casino","کازینو"),
            Triple(AffiliateScene.MOBILE,"Mobile app","اپلیکیشن")
        )
        val rowState=rememberLazyListState()
        val cardWidth = (androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp - 36)
            .coerceAtLeast(240).dp
        LazyRow(
            state=rowState,
            horizontalArrangement=Arrangement.spacedBy(12.dp),
            contentPadding=PaddingValues(horizontal=18.dp)
        ) {
            itemsIndexed(kinds) { i, item ->
                val selected = active && rowState.layoutInfo.visibleItemsInfo.any {
                    it.index == i
                }
                val zoom by animateFloatAsState(
                    if(selected)1f else .955f,
                    animationSpec=tween(470,easing=FastOutSlowInEasing),
                    label="product-card-zoom"
                )
                AffiliateReveal(visible=selected,delayMillis=i*60) {
                    Surface(
                        modifier=Modifier.width(cardWidth).height(299.dp)
                            .graphicsLayer { scaleX=zoom;scaleY=zoom },
                        shape=RoundedCornerShape(24.dp),
                        color=Color(0xFF122337),
                        border=BorderStroke(1.dp,item.first.accent.copy(alpha=.35f))
                    ) {
                        Column {
                            AffiliateCinematicPhoto(
                                scene=item.first,
                                modifier=Modifier.fillMaxWidth().height(171.dp),
                                active=selected,corner=19,showMark=true
                            )
                            Column(Modifier.padding(16.dp)) {
                                Row(verticalAlignment=Alignment.CenterVertically) {
                                    Icon(item.first.mark,contentDescription=null,
                                        tint=item.first.accent,modifier=Modifier.size(25.dp))
                                    Spacer(Modifier.width(10.dp))
                                    Text(tr(lang,item.second,item.third),
                                        color=Color.White,fontWeight=FontWeight.Black,
                                        fontSize=22.sp)
                                }
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    tr(lang,
                                        when(i) {
                                            0 -> "Live and upcoming sporting events"
                                            1 -> "Discover casino and quick games"
                                            else -> "Designed for Android devices"
                                        },
                                        when(i) {
                                            0 -> "رویدادهای ورزشی زنده و آینده"
                                            1 -> "کازینو و بازی‌های سریع"
                                            else -> "طراحی اختصاصی برای اندروید"
                                        }
                                    ),
                                    color=a78Muted,fontSize=11.sp,lineHeight=16.sp
                                )
                            }
                        }
                    }
                }
            }
        }
        Text("‹     SWIPE     ›",color=a78Muted,fontSize=10.sp,
            modifier=Modifier.align(Alignment.CenterHorizontally)
                .padding(top=12.dp),letterSpacing=2.sp)
    }
}

@Composable
private fun A78Analytics(lang: Lang, active: Boolean) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=10.dp)
            .clip(RoundedCornerShape(27.dp))
            .background(Brush.verticalGradient(
                listOf(Color(0xFF142443),Color(0xFF081626))))
            .padding(18.dp)
    ) {
        A78Eyebrow(tr(lang,"PARTNER ANALYTICS","آمار همکاری"),a78Blue)
        Spacer(Modifier.height(9.dp))
        Text(tr(lang,"Performance at a glance","عملکرد در یک نگاه"),
            fontWeight=FontWeight.Black,color=Color.White,
            fontSize=26.sp,lineHeight=31.sp)
        Text(tr(lang,
            "Interactive example — real values are available in your secure partner dashboard.",
            "نمونه گرافیکی است؛ ارقام واقعی فقط در داشبورد امن حساب شما نمایش داده می‌شوند."),
            color=a78Muted,fontSize=11.sp,lineHeight=17.sp,
            modifier=Modifier.padding(top=9.dp,bottom=17.dp))
        Surface(
            shape=RoundedCornerShape(19.dp),
            color=Color(0xFF071020),
            border=BorderStroke(1.dp,Color(0xFF244467))
        ) {
            Column(Modifier.padding(12.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Text(tr(lang,"Illustrative trend","روند نمونه"),
                        color=Color.White,fontWeight=FontWeight.Bold,
                        fontSize=13.sp,modifier=Modifier.weight(1f))
                    Surface(
                        color=a78Green.copy(alpha=.15f),
                        shape=RoundedCornerShape(30.dp)
                    ) {
                        Text("● LIVE DEMO",color=a78Green,fontSize=9.sp,
                            modifier=Modifier.padding(horizontal=10.dp,vertical=6.dp))
                    }
                }
                Spacer(Modifier.height(8.dp))
                A78AnimatedChart(active)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(),
                    horizontalArrangement=Arrangement.SpaceBetween) {
                    listOf("JAN","FEB","MAR","APR","MAY","JUN").forEach {
                        Text(it,color=Color(0xFF7C91AD),fontSize=9.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
            A78Metric(Modifier.weight(1f),Icons.Default.Groups,
                tr(lang,"Referrals","معرفی‌ها"),"↗",a78Blue)
            A78Metric(Modifier.weight(1f),Icons.Default.Link,
                tr(lang,"Tracking","پیگیری"),"↗",a78Green)
            A78Metric(Modifier.weight(1f),Icons.Default.BarChart,
                tr(lang,"Reports","گزارش‌ها"),"↗",a78Lilac)
        }
    }
}

@Composable
private fun A78Metric(modifier:Modifier,icon:androidx.compose.ui.graphics.vector.ImageVector,
                      caption:String,value:String,color:Color) {
    Column(
        modifier.clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0D253B)).padding(12.dp)
    ) {
        Icon(icon,null,tint=color,modifier=Modifier.size(24.dp))
        Spacer(Modifier.height(13.dp))
        Text(value,color=Color.White,fontSize=25.sp,fontWeight=FontWeight.Black)
        Text(caption,color=a78Muted,fontSize=10.sp)
    }
}

@Composable
private fun A78AnimatedChart(active:Boolean) {
    val progress by animateFloatAsState(
        if(active)1f else 0f,
        animationSpec=tween(durationMillis=1650,easing=FastOutSlowInEasing),
        label="partner-chart-draw"
    )
    val points=listOf(.82f,.65f,.70f,.41f,.51f,.30f,.44f,.17f,.25f,.08f)
    Canvas(Modifier.fillMaxWidth().height(187.dp)) {
        val width=size.width
        val height=size.height
        val bottom=height*.92f
        repeat(4){ i ->
            val y=height*(i+1)/5f
            drawLine(Color(0xFF22344A),Offset(0f,y),
                Offset(width,y),strokeWidth=1.dp.toPx())
        }
        val barWidth=width/17f
        val heights=listOf(.25f,.41f,.37f,.63f,.56f,.84f)
        heights.forEachIndexed { i, h ->
            val x=width*(.055f+i*.164f)
            val bh=height*h*.65f*progress
            drawRoundRect(
                brush=Brush.verticalGradient(
                    listOf(if(i%2==0)a78Green else a78Blue,
                        (if(i%2==0)a78Green else a78Blue).copy(alpha=.1f))
                ),
                topLeft=Offset(x,bottom-bh),
                size=Size(barWidth,bh),
                cornerRadius=androidx.compose.ui.geometry.CornerRadius(8.dp.toPx())
            )
        }
        val path=Path()
        points.forEachIndexed { i, value ->
            val x=width*i/(points.size-1)
            val y=height*value*.74f
            if(i==0)path.moveTo(x,y) else path.lineTo(x,y)
        }
        clipRect(right=width*progress) {
            drawPath(path,
                color=a78Green.copy(alpha=.20f),
                style=Stroke(width=11.dp.toPx(),cap=StrokeCap.Round))
            drawPath(path,color=Color(0xFF35FFBE),
                style=Stroke(width=3.dp.toPx(),cap=StrokeCap.Round))
        }
    }
}

@Composable
private fun A78Tools(lang:Lang,active:Boolean) {
    Box(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=11.dp)
        .clip(RoundedCornerShape(26.dp))
        .background(Color(0xFF101B2B))) {
        AffiliateCinematicPhoto(
            AffiliateScene.MOBILE,Modifier.fillMaxSize().height(364.dp),
            active,showMark=false
        )
        Column(Modifier.fillMaxWidth()
            .background(Brush.verticalGradient(listOf(
                Color(0xEE091323),Color(0xE30A192B),Color(0xCC0E1E30))))
            .padding(17.dp)) {
            A78Eyebrow(tr(lang,"YOUR PARTNER TOOLS","ابزارهای همکاری"))
            Spacer(Modifier.height(10.dp))
            Text(tr(lang,"Everything in one place","همه‌چیز در یک پنل"),
                color=Color.White,fontSize=23.sp,fontWeight=FontWeight.Black)
            Spacer(Modifier.height(16.dp))
            listOf(
                Triple("1",tr(lang,"Product experiences","محصولات متنوع"),
                    Icons.Default.AutoAwesome),
                Triple("2",tr(lang,"Partnership models","مدل‌های همکاری"),
                    Icons.Default.Link),
                Triple("3",tr(lang,"Partner dashboard","داشبورد همکاری"),
                    Icons.Default.Settings)
            ).forEachIndexed { index, item ->
                AffiliateReveal(visible=active,delayMillis=index*125) {
                    Row(
                        Modifier.fillMaxWidth().padding(vertical=5.dp)
                            .clip(RoundedCornerShape(17.dp))
                            .background(Color(0xE0152944))
                            .padding(13.dp),
                        verticalAlignment=Alignment.CenterVertically
                    ) {
                        Text(item.first, color=Color.White,
                            fontSize=31.sp,fontWeight=FontWeight.Black)
                        Spacer(Modifier.width(15.dp))
                        Icon(item.third,null,tint=a78Green,
                            modifier=Modifier.size(25.dp))
                        Spacer(Modifier.width(13.dp))
                        Text(item.second,color=Color.White,fontSize=14.sp,
                            fontWeight=FontWeight.Bold,
                            modifier=Modifier.weight(1f))
                        Icon(Icons.Default.ChevronRight,null,tint=a78Muted)
                    }
                }
            }
        }
    }
}

@Composable
private fun A78Ecosystem(lang:Lang,active:Boolean) {
    Column(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=27.dp)) {
        A78Eyebrow(tr(lang,"BRAND EXPERIENCE","تجربه برند"))
        Spacer(Modifier.height(9.dp))
        Text(tr(lang,"Different moments. One BetVima.",
                "تجربه‌های متفاوت؛ یک BetVima"),
            color=Color.White,fontWeight=FontWeight.Black,
            fontSize=26.sp,lineHeight=32.sp)
        Spacer(Modifier.height(15.dp))
        AffiliateCinematicPhoto(
            scene=AffiliateScene.ECOSYSTEM,
            modifier=Modifier.fillMaxWidth().height(188.dp),
            active=active,showMark=true
        )
        Spacer(Modifier.height(10.dp))
        AffiliateCinematicPhoto(
            scene=AffiliateScene.GEOGRAPHY,
            modifier=Modifier.fillMaxWidth().height(138.dp),
            active=active,showMark=false
        ) {
            Column(Modifier.align(Alignment.BottomStart).padding(13.dp)) {
                Text(tr(lang,"Made for different audiences",
                    "برای مخاطبان متنوع"),
                    color=Color.White,fontWeight=FontWeight.Bold,
                    fontSize=15.sp)
                Text(tr(lang,"Territorial restrictions and approval apply.",
                    "خدمات و همکاری تابع قوانین هر منطقه است."),
                    color=a78Muted,fontSize=10.sp)
            }
        }
    }
}

@Composable
private fun A78Gallery(lang:Lang,active:Boolean) {
    Column(Modifier.fillMaxWidth().padding(horizontal=13.dp,vertical=25.dp)) {
        A78Eyebrow(tr(lang,"EXPLORE BETVIMA","بیشتر کشف کنید"))
        Spacer(Modifier.height(9.dp))
        Text(tr(lang,"Made to stand out","تجربه‌ای متمایز"),
            color=Color.White,fontSize=26.sp,fontWeight=FontWeight.Black)
        Spacer(Modifier.height(17.dp))
        val entries=listOf(
            Triple(AffiliateScene.JOIN,"Partner community","جامعه همکاران"),
            Triple(AffiliateScene.SPORTS,"Sports action","رویدادهای ورزشی"),
            Triple(AffiliateScene.FAQ,"Support","پشتیبانی"),
            Triple(AffiliateScene.NUMBERS,"Partner tools","ابزارهای همکاری")
        )
        entries.chunked(2).forEachIndexed { row, group ->
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                group.forEachIndexed { col, entry ->
                    AffiliateReveal(visible=active,
                        delayMillis=(row*2+col)*90,
                        modifier=Modifier.weight(1f)) {
                        AffiliateCinematicPhoto(
                            entry.first,Modifier.fillMaxWidth().height(157.dp),
                            active,corner=18,showMark=false
                        ) {
                            Text(tr(lang,entry.second,entry.third),
                                color=Color.White,fontWeight=FontWeight.Bold,
                                fontSize=13.sp,
                                modifier=Modifier.align(Alignment.BottomStart)
                                    .padding(13.dp))
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

private data class A78Question(val en:String,val fa:String,
                               val enAnswer:String,val faAnswer:String)
private val a78Questions = listOf(
    A78Question("How do I join?","چطور عضو شوم؟",
        "Open registration and create your separate partner account.",
        "فرم ثبت‌نام را باز کنید و حساب مجزای همکاری بسازید."),
    A78Question("How are commissions calculated?","کمیسیون چطور محاسبه می‌شود؟",
        "Your approved agreement governs eligible commissions. View actual figures in the signed-in dashboard.",
        "کمیسیون واجد شرایط مطابق قرارداد تأییدشده محاسبه می‌شود. مقادیر واقعی در پنل حساب نمایش داده می‌شود."),
    A78Question("Is CPA available?","آیا CPA فعال است؟",
        "CPA requires separate review and approval; registration does not activate it.",
        "CPA به بررسی و تأیید جداگانه نیاز دارد و با ثبت‌نام فعال نمی‌شود."),
    A78Question("Where do I see referrals?","ارجاع‌ها را کجا ببینم؟",
        "Sign in to your partner dashboard to review authorized referral reports.",
        "برای دیدن آمار ارجاع واقعی به داشبورد همکاری وارد شوید.")
)

@Composable
private fun A78Faq(lang:Lang) {
    Column(Modifier.fillMaxWidth().padding(horizontal=13.dp,vertical=26.dp)) {
        A78Eyebrow("FAQ")
        Spacer(Modifier.height(10.dp))
        Text(tr(lang,"Everything you need to know","سؤالات متداول"),
            color=Color.White,fontSize=27.sp,fontWeight=FontWeight.Black)
        Spacer(Modifier.height(16.dp))
        a78Questions.forEachIndexed { index, question ->
            var expanded by rememberSaveable(index) { mutableStateOf(false) }
            Column(Modifier.fillMaxWidth().padding(bottom=9.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(a78Panel)
                .animateContentSize()) {
                Row(Modifier.fillMaxWidth().clickable { expanded=!expanded }
                    .padding(15.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(
                        when(index) {
                            0 -> Icons.Default.PersonAdd
                            1 -> Icons.Default.PieChart
                            2 -> Icons.Default.Link
                            else -> Icons.Default.BarChart
                        },null,
                        tint=if(index%2==0)a78Green else a78Blue,
                        modifier=Modifier.size(22.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(tr(lang,question.en,question.fa),
                        color=Color.White,fontWeight=FontWeight.Bold,
                        fontSize=13.sp,modifier=Modifier.weight(1f))
                    Icon(if(expanded)Icons.Default.Remove else Icons.Default.Add,
                        null,tint=a78Muted)
                }
                if(expanded) {
                    Text(tr(lang,question.enAnswer,question.faAnswer),
                        color=a78Muted,fontSize=12.sp,lineHeight=19.sp,
                        modifier=Modifier.padding(start=15.dp,end=15.dp,bottom=16.dp))
                }
            }
        }
    }
}

@Composable
private fun A78Join(lang:Lang,active:Boolean,onRegister:()->Unit,
                    onLogin:()->Unit) {
    // Dedicated image and action regions: old 336dp overlay crammed the
    // photograph, headline and two actions into the same fixed-height box.
    Column(Modifier.fillMaxWidth().padding(12.dp)
        .clip(RoundedCornerShape(24.dp))
        .background(Color(0xFF10253A))) {
        AffiliateCinematicPhoto(
            scene = AffiliateScene.JOIN,
            modifier = Modifier.fillMaxWidth().height(205.dp),
            active = active, corner = 0, showMark = false
        )
        Column(Modifier.fillMaxWidth().padding(19.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            A78Eyebrow(tr(lang,"JOIN BETVIMA PARTNERS","به همکاران BetVima بپیوندید"))
            Text(tr(lang,"Grow together","با هم رشد کنیم"),
                color=Color.White,fontSize=28.sp,fontWeight=FontWeight.Black)
            Text(tr(lang,
                "Create your partner account and discover the tools available to you.",
                "حساب همکاری بسازید و ابزارهای قابل دسترس را بررسی کنید."),
                color=a78Muted,fontSize=12.sp,lineHeight=19.sp)
            Spacer(Modifier.height(2.dp))
            A78Action(tr(lang,"Become an affiliate","شروع همکاری"),
                onRegister,Modifier.fillMaxWidth())
            TextButton(onClick=onLogin,
                modifier=Modifier.align(Alignment.CenterHorizontally)) {
                Text(tr(lang,"Already a partner? Log in","حساب دارید؟ ورود"),
                    color=Color.White,fontSize=12.sp)
            }
        }
    }
}
