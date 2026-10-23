package com.betvima.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.BonusPromotion

private val premiumNight=Color(0xFF111216)
private val premiumDark=Color(0xFF1E1F26)
private val premiumEmerald=Color(0xFF7DBBFF)
private val premiumBlue=Color(0xFF087FF5)
private val premiumMuted=Color(0xFFAEB3C0)
private val premiumOutline=Color(0xFF3A3C46)
private val premiumInk=Color(0xFFF6F7FB)

/** Marketing display only: bonus creation, attribution and settlement remain
 * strictly controlled by the authenticated backend.
 */
@Composable
internal fun BonusHero80(
    lang:Lang, campaign:BonusPromotion?, registeredCurrency:String?,
    onWallet:()->Unit, onRules:()->Unit
) {
    val enabled=campaign?.active==true
    val value=when {
        campaign==null -> "100"
        !enabled -> "—"
        else -> (campaign.percentageBps/100).toString()
    }
    var entered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entered=true }
    val rise by animateFloatAsState(if(entered)1f else 0f,
        animationSpec=tween(890,easing=FastOutSlowInEasing),label="bonus-hero-enter")
    Surface(
        modifier=Modifier.fillMaxWidth(),
        shape=RoundedCornerShape(28.dp),
        color=premiumNight,
        shadowElevation=10.dp
    ) {
        Box(Modifier.background(Brush.linearGradient(listOf(
            Color(0xFF15161B),Color(0xFF22222A),Color(0xFF111217))))) {
            Box(Modifier.align(Alignment.TopEnd)
                .offset(x=89.dp,y=(-78).dp)
                .size(248.dp).clip(CircleShape)
                .background(premiumEmerald.copy(alpha=.075f)))
            Box(Modifier.align(Alignment.BottomStart)
                .offset(x=(-110).dp,y=84.dp)
                .size(200.dp).clip(CircleShape)
                .background(premiumBlue.copy(alpha=.12f)))
            Column(Modifier.fillMaxWidth().padding(19.dp),
                verticalArrangement=Arrangement.spacedBy(17.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Surface(
                        color=premiumEmerald.copy(alpha=.12f),
                        border=BorderStroke(1.dp,premiumEmerald.copy(alpha=.34f)),
                        shape=RoundedCornerShape(40.dp)
                    ) {
                        Row(Modifier.padding(horizontal=12.dp,vertical=8.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.AutoAwesome,null,tint=premiumEmerald,
                                modifier=Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("BETVIMA REWARDS",color=Color(0xFFDEE8FF),
                                fontWeight=FontWeight.Black,letterSpacing=.7.sp,
                                fontSize=10.sp)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    Surface(color=Color.White.copy(alpha=.075f),
                        shape=RoundedCornerShape(12.dp)) {
                        Icon(Icons.Default.VerifiedUser,null,tint=premiumEmerald,
                            modifier=Modifier.padding(10.dp).size(21.dp))
                    }
                }
                Text(tr(lang,"Your next deposit. More possibilities.",
                    "با هر واریز، فرصت‌های بیشتر."),
                    color=Color.White,fontWeight=FontWeight.Black,
                    fontSize=25.sp,lineHeight=31.sp,
                    modifier=Modifier.graphicsLayer { alpha=rise
                        translationY=(1f-rise)*20f })
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang,"MATCHING DEPOSIT BONUS","بونوس معادل واریز"),
                            color=Color(0xFFB9CCD4),fontSize=10.sp,
                            fontWeight=FontWeight.Bold,letterSpacing=.8.sp)
                        Row(verticalAlignment=Alignment.Bottom) {
                            Text(value,color=Color.White,fontSize=71.sp,
                                lineHeight=80.sp,fontWeight=FontWeight.Black,
                                modifier=Modifier.graphicsLayer {
                                    alpha=rise;translationY=(1f-rise)*27f })
                            if(value!="—") Text("%",color=premiumEmerald,fontSize=44.sp,
                                fontWeight=FontWeight.Black,
                                modifier=Modifier.padding(bottom=12.dp))
                        }
                    }
                    BonusRing80(rise)
                }
                Text(
                    if(campaign!=null && !campaign.active)
                        tr(lang,"Promotion currently unavailable.",
                            "این طرح در حال حاضر غیرفعال است.")
                    else tr(lang,
                        "Eligible completed deposits may receive an equivalent bonus. Issuance and settlement are verified by the server.",
                        "واریزهای موفق واجد شرایط می‌توانند بونوس معادل دریافت کنند؛ صدور و تسویه فقط توسط سرور تأیید می‌شود."),
                    color=Color(0xFFD3E3E5),fontSize=12.sp,lineHeight=19.sp)
                if(registeredCurrency!=null) {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Icon(Icons.Default.Lock,null,tint=premiumEmerald,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(tr(lang,"Your registered currency: ",
                            "ارز ثابت حساب هنگام ثبت‌نام: ")+registeredCurrency,
                            color=Color(0xFFD0D7EA),fontSize=11.sp,
                            fontWeight=FontWeight.SemiBold)
                    }
                }
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                    Button(
                        onClick=onWallet,
                        modifier=Modifier.weight(1f).height(49.dp),
                        colors=ButtonDefaults.buttonColors(
                            containerColor=premiumEmerald,
                            contentColor=premiumNight),
                        shape=RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.AccountBalanceWallet,null,
                            modifier=Modifier.size(17.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(lang,"Deposit wallet","کیف پول واریز"),
                            fontWeight=FontWeight.Black,fontSize=12.sp,
                            maxLines=1)
                    }
                    OutlinedButton(
                        onClick=onRules,
                        modifier=Modifier.weight(1f).height(49.dp),
                        border=BorderStroke(1.dp,Color(0xFF555765)),
                        shape=RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Rule,null,tint=Color.White,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(tr(lang,"Full rules","شرایط کامل"),
                            color=Color.White,fontWeight=FontWeight.Bold,
                            fontSize=12.sp)
                    }
                }
                Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                    listOf(
                        Triple(Icons.Default.Schedule,"24h",
                            tr(lang,"Validity","اعتبار")),
                        Triple(Icons.Default.Layers,"4",
                            tr(lang,"Picks","انتخاب")),
                        Triple(Icons.Default.TrendingUp,"1.60+",
                            tr(lang,"Per pick","هر ضریب"))
                    ).forEach { (icon,v,label) ->
                        Surface(
                            modifier=Modifier.weight(1f),
                            shape=RoundedCornerShape(15.dp),
                            border=BorderStroke(1.dp,Color.White.copy(alpha=.13f)),
                            color=Color.White.copy(alpha=.07f)
                        ) {
                            Column(Modifier.padding(11.dp),
                                verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                Icon(icon,null,tint=premiumEmerald,
                                    modifier=Modifier.size(19.dp))
                                Text(v,color=Color.White,fontWeight=FontWeight.Black,
                                    fontSize=21.sp)
                                Text(label,color=Color(0xFFCCDDDE),fontSize=10.sp,
                                    maxLines=1,overflow=TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BonusRing80(progress:Float) {
    val lang = LocalNativeLanguage176.current
    Box(Modifier.size(95.dp),contentAlignment=Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val sw=8.dp.toPx()
            val r=(size.minDimension-sw)/2
            drawArc(Color.White.copy(alpha=.12f),-90f,360f,false,
                topLeft=Offset(sw/2,sw/2),
                size=androidx.compose.ui.geometry.Size(r*2,r*2),
                style=Stroke(sw,cap=StrokeCap.Round))
            drawArc(Brush.sweepGradient(
                listOf(premiumEmerald,Color(0xFF65F9D6),premiumBlue,premiumEmerald)),
                -90f,360f*progress,false,
                topLeft=Offset(sw/2,sw/2),
                size=androidx.compose.ui.geometry.Size(r*2,r*2),
                style=Stroke(sw,cap=StrokeCap.Round))
        }
        Column(horizontalAlignment=Alignment.CenterHorizontally) {
            Icon(Icons.Default.CardGiftcard,null,tint=premiumEmerald,
                modifier=Modifier.size(29.dp))
            Text(tr(lang, "BONUS", "بونوس"),color=Color.White,fontSize=9.sp,
                fontWeight=FontWeight.Bold,letterSpacing=1.sp)
        }
    }
}

@Composable
internal fun BonusCurrencyIdentity80(lang:Lang,registeredCurrency:String?) {
    Surface(
        modifier=Modifier.fillMaxWidth(),
        color=Color(0xFF1F2027),
        shape=RoundedCornerShape(20.dp),
        border=BorderStroke(1.dp,premiumOutline)
    ) {
        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
            Surface(color=Color(0xFF2B2B36),
                shape=RoundedCornerShape(15.dp)) {
                Icon(Icons.Default.Lock,null,tint=Color(0xFF9CCBFF),
                    modifier=Modifier.padding(12.dp).size(22.dp))
            }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(tr(lang,"Registered bonus currency","ارز ثابت بونوس"),
                    color=premiumMuted,fontSize=11.sp)
                Spacer(Modifier.height(3.dp))
                Text(when(registeredCurrency) {
                    "USD"->tr(lang,"US Dollar · USD","دلار آمریکا · USD")
                    "IRR","IRT"->tr(lang,"Iranian Rial · IRR","ریال ایران · IRR")
                    else->tr(lang,"Verifying account…","در حال تأیید حساب…")
                },color=premiumInk,fontSize=14.sp,fontWeight=FontWeight.Black)
                Text(tr(lang,"Set at sign-up · cannot be changed here",
                    "تعیین‌شده هنگام ثبت‌نام · غیرقابل‌تغییر"),
                    color=premiumMuted,fontSize=10.sp)
            }
            Icon(Icons.Default.VerifiedUser,null,tint=Color(0xFF8FBFFF))
        }
    }
}

@Composable
internal fun BonusStatCard80(
    label:String,value:String,
    icon:androidx.compose.ui.graphics.vector.ImageVector,tint:Color,
    modifier:Modifier=Modifier
) {
    Surface(
        modifier=modifier.height(137.dp),
        color=Color(0xFF1F2027),
        border=BorderStroke(1.dp,premiumOutline),
        shape=RoundedCornerShape(19.dp)
    ) {
        Column(Modifier.padding(13.dp)) {
            Surface(color=tint.copy(alpha=.12f),shape=RoundedCornerShape(11.dp)) {
                Icon(icon,null,tint=tint,modifier=Modifier.padding(7.dp).size(21.dp))
            }
            Spacer(Modifier.height(13.dp))
            Text(value,color=premiumInk,fontWeight=FontWeight.Black,
                fontSize=14.sp,maxLines=1,overflow=TextOverflow.Ellipsis)
            Spacer(Modifier.height(7.dp))
            Text(label,color=premiumMuted,fontSize=10.sp,maxLines=2,
                lineHeight=13.sp,overflow=TextOverflow.Ellipsis)
        }
    }
}

@Composable
internal fun BonusEmpty80(lang:Lang) {
    Surface(
        color=Color(0xFF1F2027),
        border=BorderStroke(1.dp,premiumOutline),
        shape=RoundedCornerShape(25.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment=Alignment.CenterHorizontally) {
            Box(Modifier.size(105.dp)
                .clip(CircleShape)
                .background(Brush.radialGradient(listOf(
                    premiumEmerald.copy(alpha=.20f),Color(0xFF252630)))),
                contentAlignment=Alignment.Center) {
                Surface(color=Color(0xFF1F2027),shape=RoundedCornerShape(20.dp),
                    shadowElevation=7.dp) {
                    Icon(Icons.Default.CardGiftcard,null,tint=Color(0xFF93C2FF),
                        modifier=Modifier.padding(15.dp).size(39.dp))
                }
            }
            Spacer(Modifier.height(15.dp))
            Text(tr(lang,"Your next reward starts here",
                "پاداش بعدی شما از اینجا شروع می‌شود"),
                color=premiumInk,fontSize=17.sp,
                fontWeight=FontWeight.Black,textAlign=TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(tr(lang,
                "No bonus is active yet. After an eligible confirmed deposit, your reward will appear here with its own live countdown.",
                "هنوز بونوس فعالی ندارید. پس از واریز موفق واجد شرایط، پاداش شما همراه با شمارش معکوس اختصاصی در همین بخش نمایش داده می‌شود."),
                color=premiumMuted,fontSize=12.sp,lineHeight=19.sp,
                textAlign=TextAlign.Center)
            Spacer(Modifier.height(14.dp))
            Surface(
                color=Color(0xFF292A34),shape=RoundedCornerShape(30.dp)
            ) {
                Row(Modifier.padding(horizontal=13.dp,vertical=9.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Shield,null,tint=Color(0xFF9CCBFF),
                        modifier=Modifier.size(17.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(tr(lang,"Verified by BetVima",
                        "با تأیید سرور BetVima"),
                        fontSize=11.sp,fontWeight=FontWeight.Bold,
                        color=Color(0xFF9CCBFF))
                }
            }
        }
    }
}
