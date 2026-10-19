package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val drawerNight = Color(0xFF111827)
private val drawerMuted = Color(0xFF9CAFC9)
private val drawerCyan = Color(0xFF80C9FF)
private val drawerPink = Color(0xFFF17BC9)
private val drawerRows = Color(0xFF1D2B40)

/**
 * Presentation-only, native navigation over the existing affiliate API.
 * Keys refer to existing dashboard sections; there are no new requests or writes.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PremiumAffiliateDrawer117(
    lang: Lang,
    selected: String,
    onNavigate: (String) -> Unit,
    onClose: () -> Unit
) {
    ModalDrawerSheet(
        modifier = Modifier.fillMaxHeight().width(318.dp),
        drawerContainerColor = drawerNight,
        drawerShape = RoundedCornerShape(topEnd = 28.dp, bottomEnd = 28.dp)
    ) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomEnd = 26.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF1B3156),
                        Color(0xFF27234D), Color(0xFF151923))))
            ) {
                Box(Modifier.align(Alignment.TopEnd).offset(x = 45.dp, y = (-42).dp)
                    .size(160.dp).clip(CircleShape)
                    .background(drawerPink.copy(alpha = .12f)))
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(shape = RoundedCornerShape(14.dp),
                            color = Color.White.copy(alpha = .10f)) {
                            Icon(Icons.Default.Hub, null, tint = drawerCyan,
                                modifier = Modifier.padding(11.dp).size(25.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("BETVIMA", color = Color.White, fontSize = 19.sp,
                                fontWeight = FontWeight.Black)
                            Text("PARTNERS", color = drawerCyan, fontSize = 10.sp,
                                fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                        }
                        IconButton(onClick = onClose) {
                            Icon(Icons.Default.Close,
                                tr(lang,"Close menu","بستن منو"),tint = Color.White)
                        }
                    }
                    Spacer(Modifier.height(23.dp))
                    Text(tr(lang,"Your partner workspace","فضای اختصاصی همکاران"),
                        fontWeight = FontWeight.Black, fontSize = 20.sp,
                        color = Color.White)
                    Text(tr(lang,"Navigate performance, links and payouts.",
                        "مدیریت آمار، لینک‌ها و برداشت‌ها در یک مکان"),
                        fontSize = 12.sp, lineHeight = 19.sp,
                        color = Color(0xFFC6D3E8),
                        modifier = Modifier.padding(top = 6.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
            DrawerCaption117(tr(lang,"WORKSPACE","بخش‌های اصلی"))
            DrawerDestination117(lang,selected,"overview",Icons.Default.SpaceDashboard,
                tr(lang,"Overview","داشبورد"),
                tr(lang,"Performance at a glance","نمای کلی عملکرد"),onNavigate)
            DrawerDestination117(lang,selected,"referrals",Icons.Default.Groups,
                tr(lang,"Referrals","زیرمجموعه‌ها"),
                tr(lang,"Referred accounts & activity","کاربران و فعالیت‌ها"),onNavigate)
            DrawerDestination117(lang,selected,"ledger",Icons.Default.ReceiptLong,
                tr(lang,"Commission ledger","گردش کمیسیون"),
                tr(lang,"Recorded commission entries","ریز تراکنش‌های کمیسیون"),onNavigate)
            DrawerCaption117(tr(lang,"TOOLS & PAYMENTS","ابزارها و پرداخت‌ها"))
            DrawerDestination117(lang,selected,"payouts",Icons.Default.Payments,
                tr(lang,"Payouts","برداشت‌ها"),
                tr(lang,"Requests and history","درخواست‌ها و سوابق"),onNavigate)
            DrawerDestination117(lang,selected,"links",Icons.Default.Link,
                tr(lang,"Referral links","لینک‌های دعوت"),
                tr(lang,"Share your campaigns","اشتراک‌گذاری کمپین‌ها"),onNavigate)
            DrawerDestination117(lang,selected,"wallets",Icons.Default.AccountBalanceWallet,
                tr(lang,"Payout wallets","کیف‌پول‌های برداشت"),
                tr(lang,"Saved receiving addresses","آدرس‌های دریافت ثبت‌شده"),onNavigate)
            DrawerDestination117(lang,selected,"gifts",Icons.Default.CardGiftcard,
                tr(lang,"Gift codes","کدهای هدیه"),
                tr(lang,"Registration gift codes","کدهای هدیه ثبت‌نام"),onNavigate)
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color=Color.White.copy(alpha=.10f),
                modifier=Modifier.padding(horizontal=18.dp))
            Row(Modifier.fillMaxWidth().padding(20.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.VerifiedUser,null,tint=drawerCyan,
                    modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(9.dp))
                Text(tr(lang,"Secure partner workspace","محیط امن همکاری"),
                    color=drawerMuted,fontSize=11.sp)
            }
        }
    }
}

@Composable
private fun DrawerCaption117(text: String) {
    Text(text, color=drawerMuted,fontSize=10.sp,
        fontWeight=FontWeight.Bold,letterSpacing=1.sp,
        modifier=Modifier.padding(start=22.dp,end=22.dp,top=15.dp,bottom=6.dp))
}

@Composable
private fun DrawerDestination117(
    lang: Lang,
    selected: String,
    key: String,
    icon: ImageVector,
    label: String,
    subtitle: String,
    onNavigate: (String) -> Unit
) {
    val active=selected==key
    Surface(
        modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp)
            .clickable { onNavigate(key) },
        color=if(active) drawerRows else Color.Transparent,
        shape=RoundedCornerShape(16.dp),
        border=if(active) BorderStroke(1.dp,drawerCyan.copy(alpha=.24f)) else null
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal=11.dp,vertical=10.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Surface(color=if(active)drawerCyan.copy(alpha=.17f)
                else Color.White.copy(alpha=.06f),
                shape=RoundedCornerShape(12.dp)) {
                Icon(icon,null,tint=if(active)drawerCyan else drawerPink,
                    modifier=Modifier.padding(10.dp).size(20.dp))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(label,color=Color.White,fontSize=13.sp,
                    fontWeight=FontWeight.Bold)
                Text(subtitle,color=drawerMuted,fontSize=10.sp,
                    lineHeight=14.sp,modifier=Modifier.padding(top=2.dp))
            }
            if(active) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(drawerCyan))
            } else {
                Icon(Icons.Default.ChevronRight,null,tint=drawerMuted,
                    modifier=Modifier.size(18.dp))
            }
        }
    }
}
