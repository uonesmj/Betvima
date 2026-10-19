package com.betvima.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import org.json.JSONObject
import java.math.BigDecimal
import java.net.URLEncoder
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val sBlack = Color(0xFF080B0A)
private val sNight = Color(0xFF111713)
private val sGreen = Color(0xFF43D68F)
private val sGreenDark = Color(0xFF17794E)
private val sWhite = Color(0xFFF8FAF8)
private val sGray = Color(0xFF818B85)
private val sLine = Color(0xFFE3EAE5)
private val sBg = Color(0xFFEDF1ED)

private data class SignupDay(val day: LocalDate, val count: Int)
private data class StudioGift(val code: String, val uses: Int, val active: Boolean)

@OptIn(ExperimentalAnimationApi::class)
@Composable
internal fun AffiliateStudio118(
    state: AppState,
    model: AppViewModel,
    destination: String,
    onNavigate: (String) -> Unit
) {
    val context = LocalContext.current
    val vault = remember(context) { SessionVault(context, "affiliate") }
    val api = remember { ApiClient() }
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var partner by remember { mutableStateOf<JSONObject?>(null) }
    var stats by remember { mutableStateOf<JSONObject?>(null) }
    var payable by remember { mutableStateOf<JSONObject?>(null) }
    var days by remember { mutableStateOf<List<SignupDay>>(emptyList()) }
    var hasDailyReport by remember { mutableStateOf(false) }
    var referralTotal by remember { mutableStateOf<Int?>(null) }
    var primaryUrl by remember { mutableStateOf("") }
    var gifts by remember { mutableStateOf<List<StudioGift>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var reportError by remember { mutableStateOf<String?>(null) }
    var giftCode by remember { mutableStateOf("") }
    var giftSaving by remember { mutableStateOf(false) }
    var giftError by remember { mutableStateOf<String?>(null) }
    var generation by remember { mutableIntStateOf(0) }
    val zone = remember(partner?.str("settlementTimezone")) {
        runCatching { ZoneId.of(partner?.str("settlementTimezone", "Asia/Tehran") ?: "Asia/Tehran") }
            .getOrDefault(ZoneId.of("Asia/Tehran"))
    }
    val today = LocalDate.now(zone)
    LaunchedEffect(generation, vault) {
        loading = true
        reportError = null
        try {
            val token = vault.accessToken(api) ?: error("Partner sign-in required")
            val now = LocalDate.now(zone)
            val from = URLEncoder.encode(
                now.minusDays(13).atStartOfDay(zone).toInstant().toString(), "UTF-8")
            val to = URLEncoder.encode(
                now.plusDays(1).atStartOfDay(zone).toInstant().toString(), "UTF-8")
            val overview = api.get("/api/v1/affiliate/overview?from=$from&to=$to", token)
            partner = overview.optJSONObject("affiliate")
            stats = overview.optJSONObject("stats")
            payable = overview.optJSONObject("payable")
            hasDailyReport = overview.has("dailyStats") && !overview.isNull("dailyStats")
            val rows = overview.arr("dailyStats").objects()
            val byDay = rows.mapNotNull { row ->
                parseStudioDay(row.str("day"))?.let { it to row.optInt("registrations", 0) }
            }.groupBy({ it.first }, { it.second }).mapValues { (_, values) -> values.sum() }
            days = (13 downTo 0).map { offset ->
                val d = now.minusDays(offset.toLong())
                SignupDay(d, byDay[d] ?: 0)
            }
            supervisorScope {
                val referralRequest = async { runCatching {
                    api.get("/api/v1/affiliate/referrals?pageSize=1&page=1", token)
                }.getOrNull() }
                val linksRequest = async { runCatching {
                    api.get("/api/v1/affiliate/links", token)
                }.getOrNull() }
                val giftsRequest = async { runCatching {
                    api.get("/api/v1/affiliate/gift-codes", token)
                }.getOrNull() }
                val referrals = referralRequest.await()
                referralTotal = if (referrals?.has("total") == true)
                    referrals.optInt("total", 0) else null
                primaryUrl = linksRequest.await()?.str("primaryUrl").orEmpty()
                gifts = giftsRequest.await()?.arr("items")?.objects()?.map {
                    StudioGift(it.str("code"), it.optInt("usageCount"),
                        it.optBoolean("isActive", false))
                } ?: emptyList()
            }
        } catch (ex: Exception) {
            reportError = ex.message ?: tr(state.lang,
                "Unable to load partner reports", "دریافت گزارش همکاری ممکن نیست")
            partner = null; stats = null; payable = null
            hasDailyReport = false; days = emptyList(); referralTotal = null
            primaryUrl = ""; gifts = emptyList()
        } finally { loading = false }
    }
    val currency = partner?.str("currency", "USD") ?: "USD"
    val rate = partner?.optInt("commissionRateBps", -1) ?: -1
    val rateText = if(rate < 0) "—" else
        BigDecimal(rate).movePointLeft(2).stripTrailingZeros().toPlainString() + "%"
    val page = if (destination in setOf("overview", "referrals", "ledger", "payouts",
            "links", "wallets", "gifts")) destination else "overview"

    Column(Modifier.fillMaxSize().background(sBg)) {
        Row(
            Modifier.fillMaxWidth().background(sBlack)
                .padding(horizontal=19.dp, vertical=10.dp),
            verticalAlignment=Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(studioTitle(state.lang,page),color=Color.White,
                    fontWeight=FontWeight.Black,fontSize=17.sp)
                Text(tr(state.lang,"AFFILIATE STUDIO","مدیریت همکاری"),
                    color=sGreen,fontSize=9.sp,fontWeight=FontWeight.Bold,
                    letterSpacing=1.3.sp)
            }
            IconButton(onClick={ generation++ }) {
                Icon(Icons.Default.Refresh,tr(state.lang,"Refresh","به‌روزرسانی"),
                    tint=sGreen)
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(),
            color=sGreen,trackColor=sNight)
        if (reportError != null) {
            Surface(Modifier.fillMaxWidth().padding(12.dp),
                color=Color(0xFFFFF0F0),shape=RoundedCornerShape(15.dp)) {
                Text(reportError.orEmpty(),color=Color(0xFFAD2634),
                    fontSize=12.sp,modifier=Modifier.padding(14.dp))
            }
        }
        AnimatedContent(
            targetState=page,
            transitionSpec={ fadeIn(tween(240)) togetherWith fadeOut(tween(120)) },
            label="affiliate-page",
            modifier=Modifier.fillMaxSize()
        ) { current ->
            LazyColumn(
                modifier=Modifier.fillMaxSize(),
                contentPadding=PaddingValues(bottom=35.dp),
                verticalArrangement=Arrangement.spacedBy(0.dp),
                flingBehavior=rememberPremiumFlingBehavior()
            ) {
                item(key="joined-stage") {
                    Column(Modifier.fillMaxWidth()) {
                        StudioHero118(state.lang,current,
                            when(current) {
                                "overview" -> tr(state.lang,
                                    "Earn from your referrals, with clear and verified reporting.",
                                    "درآمد زیرمجموعه‌ها با گزارش شفاف و تأییدشده")
                                "referrals" -> tr(state.lang,"Your referred accounts and activity.",
                                    "کاربران معرفی‌شده و فعالیت واقعی آن‌ها")
                                "ledger" -> tr(state.lang,"Every commission entry, in one place.",
                                    "تمام گردش‌های ثبت‌شده کمیسیون")
                                "payouts" -> tr(state.lang,"Manage weekly withdrawals securely.",
                                    "مدیریت امن درخواست‌های برداشت هفتگی")
                                "links" -> tr(state.lang,"Create campaigns and share your link.",
                                    "ساخت کمپین و اشتراک لینک‌های دعوت")
                                "wallets" -> tr(state.lang,"Manage your approved payout destinations.",
                                    "مدیریت آدرس‌های برداشت ثبت‌شده")
                                else -> tr(state.lang,"Create and distribute sign-up gift codes.",
                                    "ساخت و اشتراک کدهای هدیه ثبت‌نام")
                            }
                        )
                        Column(Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(topStart=33.dp,topEnd=33.dp))
                            .background(sWhite)
                            .padding(start=17.dp,end=17.dp,top=22.dp,bottom=30.dp),
                            verticalArrangement=Arrangement.spacedBy(16.dp)) {
                            if(partner == null && !loading && reportError == null) {
                                Text(tr(state.lang,"Partner profile unavailable",
                                    "پروفایل همکاری در دسترس نیست"),color=sGray)
                            }
                            when(current) {
                                "overview" -> {
                                    StudioRevenue118(state.lang,rateText,partner,payable,currency)
                                    StudioLink118(state.lang,primaryUrl,
                                        onCopy={
                                            if(primaryUrl.isNotBlank()) {
                                                clipboard.setText(AnnotatedString(primaryUrl))
                                                model.notice(tr(state.lang,"Link copied","لینک کپی شد"))
                                            }
                                        },
                                        onShare={
                                            if(primaryUrl.isNotBlank()) {
                                                context.startActivity(Intent.createChooser(
                                                    Intent(Intent.ACTION_SEND).apply {
                                                        type="text/plain"
                                                        putExtra(Intent.EXTRA_TEXT,primaryUrl)
                                                    },tr(state.lang,"Share referral link","اشتراک لینک")))
                                            }
                                        },
                                        onManage={onNavigate("links")})
                                    StudioAffiliateApp120(state.lang,
                                        partner?.str("code").orEmpty(),
                                        approved=partner?.str("status")=="approved",
                                        onDownload={ url ->
                                            context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url))
                                                .addCategory(Intent.CATEGORY_BROWSABLE))
                                        },
                                        onShare={ url ->
                                            context.startActivity(Intent.createChooser(
                                                Intent(Intent.ACTION_SEND).apply {
                                                    type="text/plain"
                                                    putExtra(Intent.EXTRA_TEXT,url)
                                                },tr(state.lang,"Share your partner app","اشتراک برنامه اختصاصی")))
                                        })
                                    val seven = days.takeLast(7)
                                    val previous = days.take(7)
                                    StudioStats118(state.lang,referralTotal,hasDailyReport,
                                        seven.lastOrNull()?.count,
                                        seven.getOrNull(5)?.count,
                                        previous.sumOf { it.count },
                                        seven.sumOf { it.count },
                                        stats?.optInt("activeUsers",0),
                                        stats?.optInt("firstDeposits",0))
                                    StudioChart118(state.lang,seven,hasDailyReport)
                                    StudioTerms118(state.lang,
                                        partner?.str("minPayoutMinor")?.takeIf(String::isNotBlank)
                                            ?.let { money(it,currency) } ?: "—",
                                        partner?.str("settlementTimezone","Asia/Tehran")
                                            ?: "Asia/Tehran",
                                        onPayouts={onNavigate("payouts")})
                                }
                                "gifts" -> {
                                    StudioSection118(tr(state.lang,"Registration gift codes",
                                        "کدهای هدیه ثبت‌نام"),
                                        tr(state.lang,"Up to 10 codes, 4–8 letters or digits",
                                            "حداکثر ۱۰ کد، هر کد ۴ تا ۸ حرف یا عدد"))
                                    Row(verticalAlignment=Alignment.CenterVertically) {
                                        OutlinedTextField(giftCode,
                                            { giftCode=it.uppercase().filter(Char::isLetterOrDigit).take(8) },
                                            label={Text(tr(state.lang,"New gift code","کد هدیه جدید"))},
                                            modifier=Modifier.weight(1f),singleLine=true,
                                            shape=RoundedCornerShape(15.dp))
                                        Spacer(Modifier.width(9.dp))
                                        Button(
                                            enabled=!giftSaving && gifts.size < 10 &&
                                                AffiliateInputRules.validGiftCode(giftCode),
                                            onClick={
                                                scope.launch {
                                                    giftSaving=true; giftError=null
                                                    try {
                                                        val token=vault.accessToken(api)
                                                            ?: error("Partner sign-in required")
                                                        api.post("/api/v1/affiliate/gift-codes",
                                                            JSONObject().put("code",giftCode),token)
                                                        giftCode=""
                                                        generation++
                                                    } catch(ex:Exception) {
                                                        giftError=ex.message
                                                    } finally { giftSaving=false }
                                                }
                                            },
                                            contentPadding=PaddingValues(13.dp),
                                            colors=ButtonDefaults.buttonColors(
                                                containerColor=sGreen),
                                            shape=RoundedCornerShape(15.dp)) {
                                            Icon(Icons.Default.Add,null,tint=sBlack)
                                        }
                                    }
                                    if(giftError!=null) Text(giftError.orEmpty(),
                                        color=Color(0xFFB32E36),fontSize=12.sp)
                                    if(gifts.isEmpty()) StudioEmpty118(state.lang)
                                    gifts.forEach { gift ->
                                        StudioGiftRow118(state.lang,gift) {
                                            clipboard.setText(AnnotatedString(gift.code))
                                            model.notice(tr(state.lang,"Code copied","کد کپی شد"))
                                        }
                                    }
                                }
                                else -> {
                                    if(current=="links") {
                                        StudioAffiliateApp120(state.lang,
                                            partner?.str("code").orEmpty(),
                                        approved=partner?.str("status")=="approved",
                                            onDownload={ url ->
                                                context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url))
                                                    .addCategory(Intent.CATEGORY_BROWSABLE))
                                            },
                                            onShare={ url ->
                                                context.startActivity(Intent.createChooser(
                                                    Intent(Intent.ACTION_SEND).apply {
                                                        type="text/plain"
                                                        putExtra(Intent.EXTRA_TEXT,url)
                                                    },tr(state.lang,"Share your partner app","اشتراک برنامه اختصاصی")))
                                            })
                                        StudioLink118(state.lang,primaryUrl,
                                            onCopy={
                                                if(primaryUrl.isNotBlank()) {
                                                    clipboard.setText(AnnotatedString(primaryUrl))
                                                    model.notice(tr(state.lang,"Link copied","لینک کپی شد"))
                                                }
                                            },onShare={
                                                if(primaryUrl.isNotBlank()) {
                                                    context.startActivity(Intent.createChooser(
                                                        Intent(Intent.ACTION_SEND).apply {
                                                            type="text/plain"
                                                            putExtra(Intent.EXTRA_TEXT,primaryUrl)
                                                        },tr(state.lang,"Share link","اشتراک لینک")))
                                                }
                                            },onManage={},showManage=false)
                                    }
                                    if(current=="payouts") StudioTerms118(state.lang,
                                        partner?.str("minPayoutMinor")?.takeIf(String::isNotBlank)
                                            ?.let { money(it,currency) } ?: "—",
                                        partner?.str("settlementTimezone","Asia/Tehran")
                                            ?: "Asia/Tehran", onPayouts=null)
                                    AffiliateOperations(
                                        state=state,model=model,currency=currency,
                                        minimumPayoutMinor=partner?.str("minPayoutMinor","0") ?: "0",
                                        requestedTab=current,
                                        navigationRevision=1,
                                        showNavigation=false,
                                        reportTimezone=partner?.str("settlementTimezone","Asia/Tehran")
                                            ?: "Asia/Tehran"
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun parseStudioDay(raw: String): LocalDate? {
    val iso = Regex("\\d{4}-\\d{2}-\\d{2}").find(raw)?.value
    if(iso!=null) return runCatching { LocalDate.parse(iso) }.getOrNull()
    val match = Regex("^[A-Za-z]{3} ([A-Za-z]{3})\\s+(\\d{1,2})\\s+(\\d{4})").find(raw)
        ?: return null
    return runCatching {
        LocalDate.parse("${match.groupValues[1]} ${match.groupValues[2]} ${match.groupValues[3]}",
            DateTimeFormatter.ofPattern("MMM d yyyy",Locale.ENGLISH))
    }.getOrNull()
}

private fun studioTitle(lang: Lang, page: String) = when(page) {
    "referrals" -> tr(lang,"Referrals","زیرمجموعه‌ها")
    "ledger" -> tr(lang,"Commission ledger","گردش کمیسیون")
    "payouts" -> tr(lang,"Payouts","برداشت‌ها")
    "links" -> tr(lang,"Referral links","لینک‌های دعوت")
    "wallets" -> tr(lang,"Payout wallets","کیف‌پول‌های برداشت")
    "gifts" -> tr(lang,"Gift codes","کدهای هدیه")
    else -> tr(lang,"Overview","داشبورد")
}

@Composable
private fun StudioHero118(lang:Lang,page:String,subtitle:String) {
    Box(Modifier.fillMaxWidth().heightIn(min=168.dp)
        .background(Brush.linearGradient(listOf(sBlack,Color(0xFF153826),sNight)))) {
        Box(Modifier.align(Alignment.TopEnd).offset(x=30.dp,y=(-58).dp)
            .size(172.dp).clip(CircleShape).background(sGreen.copy(alpha=.09f)))
        Box(Modifier.align(Alignment.BottomEnd).offset(x=(-54).dp,y=43.dp)
            .size(95.dp).clip(CircleShape).background(sGreen.copy(alpha=.14f)))
        Column(Modifier.fillMaxWidth().padding(start=24.dp,end=22.dp,top=23.dp,bottom=44.dp),
            verticalArrangement=Arrangement.spacedBy(11.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.AutoAwesome,null,tint=sGreen,
                    modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text("BETVIMA · PARTNERS",color=sGreen,fontWeight=FontWeight.Bold,
                    fontSize=10.sp,letterSpacing=1.3.sp)
            }
            Text(studioTitle(lang,page),color=Color.White,
                fontWeight=FontWeight.Black,fontSize=28.sp)
            Text(subtitle,color=Color(0xFFCFDCD2),fontSize=12.sp,lineHeight=19.sp)
        }
    }
}

@Composable
private fun StudioSection118(title:String,subtitle:String) {
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.width(42.dp).height(4.dp).clip(CircleShape).background(sGreen))
        Spacer(Modifier.height(8.dp))
        Text(title,color=sBlack,fontSize=19.sp,fontWeight=FontWeight.Black)
        Text(subtitle,color=sGray,fontSize=11.sp,lineHeight=18.sp)
    }
}

@Composable
private fun StudioRevenue118(lang:Lang,rate:String,partner:JSONObject?,
    payable:JSONObject?,currency:String) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(23.dp))
        .background(Brush.horizontalGradient(listOf(sNight,Color(0xFF1B3E2B))))
        .padding(19.dp),verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically) {
            Text(rate,color=sGreen,fontSize=42.sp,fontWeight=FontWeight.Black,
                modifier=Modifier.weight(1f))
            Icon(Icons.Default.TrendingUp,null,tint=sGreen,modifier=Modifier.size(30.dp))
        }
        Text(tr(lang,"YOUR VERIFIED COMMISSION RATE","نرخ کمیسیون ثبت‌شده شما"),
            color=Color.White,fontWeight=FontWeight.Bold,fontSize=12.sp)
        Text(tr(lang,
            "Your referral attribution is retained. Earnings continue under your approved affiliate agreement; the rate may vary by account or campaign.",
            "انتساب زیرمجموعه به حساب شما حفظ می‌شود. درآمد طبق قرارداد تأییدشده همکاری ادامه می‌یابد و نرخ می‌تواند بر اساس حساب یا کمپین متفاوت باشد."),
            fontSize=11.sp,lineHeight=18.sp,color=Color(0xFFC0D2C5))
        val available = payable?.str("payableMinor")?.takeIf(String::isNotBlank)
            ?.let { money(it,currency) } ?: "—"
        HorizontalDivider(color=Color.White.copy(alpha=.18f))
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Text(tr(lang,"Available to withdraw","موجودی قابل برداشت"),
                modifier=Modifier.weight(1f),color=Color(0xFFBFD4C5),fontSize=11.sp)
            Text(available,color=Color.White,fontSize=18.sp,
                fontWeight=FontWeight.Black)
        }
        if(partner != null) Text(
            tr(lang,"Status: ","وضعیت: ")+partner.str("status","—"),
            color=sGreen,fontSize=11.sp)
    }
}

@Composable
private fun StudioLink118(lang:Lang,link:String,onCopy:()->Unit,
    onShare:()->Unit,onManage:()->Unit,showManage:Boolean=true) {
    Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(9.dp)) {
        StudioSection118(tr(lang,"Your referral link","لینک اختصاصی شما"),
            tr(lang,"Share or create a tracked campaign","اشتراک لینک یا ساخت کمپین رهگیری‌شده"))
        Surface(color=Color(0xFFEDF6EF),shape=RoundedCornerShape(15.dp)) {
            Text(if(link.isBlank())"—" else link,color=sNight,fontSize=12.sp,
                maxLines=2,overflow=TextOverflow.Ellipsis,
                modifier=Modifier.fillMaxWidth().padding(14.dp))
        }
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Button(onClick=onCopy,enabled=link.isNotBlank(),
                modifier=Modifier.weight(1f),shape=RoundedCornerShape(12.dp),
                colors=ButtonDefaults.buttonColors(containerColor=sGreen)) {
                Icon(Icons.Default.ContentCopy,null,tint=sBlack,modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang,"Copy","کپی"),color=sBlack,fontWeight=FontWeight.Bold)
            }
            OutlinedButton(onClick=onShare,enabled=link.isNotBlank(),
                modifier=Modifier.weight(1f),shape=RoundedCornerShape(12.dp)) {
                Icon(Icons.Default.Share,null,tint=sGreenDark,modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp))
                Text(tr(lang,"Share","اشتراک"),color=sGreenDark)
            }

        }
        if(showManage) {
            TextButton(onClick=onManage,modifier=Modifier.fillMaxWidth()) {
                Text(tr(lang,"Manage campaigns","مدیریت کمپین‌ها"),
                    color=sGreenDark,fontWeight=FontWeight.Bold)
                Icon(Icons.Default.ArrowForward,null,tint=sGreenDark,
                    modifier=Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun StudioStats118(lang:Lang,total:Int?,available:Boolean,
    today:Int?,yesterday:Int?,lastWeek:Int,seven:Int,active:Int?,first:Int?) {
    Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(9.dp)) {
        StudioSection118(tr(lang,"Registrations","آمار ثبت‌نام"),
            tr(lang,"Verified server reporting","گزارش‌های واقعی سرور"))
        val metrics=listOf(
            tr(lang,"All sign-ups","کل ثبت‌نام‌ها") to (total?.toString() ?: "—"),
            tr(lang,"Today","امروز") to (if(available)today?.toString() ?: "0" else "—"),
            tr(lang,"Yesterday","دیروز") to (if(available)yesterday?.toString() ?: "0" else "—"),
            tr(lang,"Previous 7 days","هفته قبل") to (if(available)lastWeek.toString() else "—"),
            tr(lang,"Last 7 days","۷ روز اخیر") to (if(available)seven.toString() else "—"),
            tr(lang,"Active users","کاربران فعال") to (active?.toString() ?: "—"),
            tr(lang,"First deposits","اولین واریز") to (first?.toString() ?: "—"),
            tr(lang,"Data","وضعیت داده") to
                (if(available) tr(lang,"Verified","تأیید شده") else "—")
        )
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(sLine)) {
            metrics.chunked(2).forEachIndexed { index, row ->
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(1.dp)) {
                    row.forEach { (label,value) ->
                        Column(Modifier.weight(1f).background(Color.White)
                            .padding(horizontal=15.dp,vertical=17.dp)) {
                            Text(label,fontSize=11.sp,color=sGray,maxLines=2)
                            Spacer(Modifier.height(8.dp))
                            Text(value,fontSize=25.sp,color=sNight,fontWeight=FontWeight.Black,
                                maxLines=1)
                        }
                    }
                }
                if(index<metrics.chunked(2).lastIndex) Spacer(Modifier.height(1.dp))
            }
        }
    }
}

@Composable
private fun StudioChart118(lang:Lang,days:List<SignupDay>,available:Boolean) {
    var appear by remember(days) { mutableStateOf(false) }
    LaunchedEffect(days) { appear=true }
    val progress by animateFloatAsState(if(appear)1f else 0f,
        animationSpec=tween(durationMillis=850),label="signup-chart-progress")
    Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        StudioSection118(tr(lang,"Weekly registration activity","نمودار ثبت‌نام هفتگی"),
            tr(lang,"Daily verified registrations · last 7 days",
                "ثبت‌نام روزانه تأییدشده · ۷ روز اخیر"))
        if(!available || days.size!=7) {
            StudioEmpty118(lang)
        } else {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(21.dp))
                .background(sNight).padding(14.dp)) {
                val max = (days.maxOfOrNull { it.count } ?: 0).coerceAtLeast(1)
                Canvas(Modifier.fillMaxWidth().height(164.dp)) {
                    val gap = size.width / 7f
                    val bar = gap * .50f
                    val base = size.height - 11.dp.toPx()
                    val usable = size.height - 27.dp.toPx()
                    days.forEachIndexed { i, item ->
                        val x = gap * i + (gap-bar)/2
                        val height = (item.count.toFloat()/max)*usable*progress
                        if(item.count>0) {
                            drawRoundRect(
                                brush=Brush.verticalGradient(listOf(sGreen,Color(0xFF19895A))),
                                topLeft=Offset(x,base-height),
                                size=Size(bar,height.coerceAtLeast(3.dp.toPx())),
                                cornerRadius=CornerRadius(7.dp.toPx())
                            )
                        } else {
                            drawCircle(color=Color(0xFF3E624C),radius=2.5.dp.toPx(),
                                center=Offset(gap*(i+.5f),base))
                        }
                    }
                }
                Row(Modifier.fillMaxWidth()) {
                    days.forEach { data ->
                        Column(Modifier.weight(1f),
                            horizontalAlignment=Alignment.CenterHorizontally) {
                            Text(data.count.toString(),fontSize=11.sp,color=Color.White,
                                fontWeight=FontWeight.Bold)
                            Text(data.day.dayOfMonth.toString(),
                                fontSize=10.sp,color=Color(0xFFAEC7B7),
                                modifier=Modifier.padding(top=4.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioTerms118(lang:Lang,minimum:String,timezone:String,onPayouts:(()->Unit)?) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
        .background(Color(0xFFEAF3ED)).padding(18.dp),
        verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically) {
            Icon(Icons.Default.EventRepeat,null,tint=sGreenDark)
            Spacer(Modifier.width(9.dp))
            Text(tr(lang,"Weekly settlement & withdrawals","تسویه و برداشت هفتگی"),
                fontSize=17.sp,fontWeight=FontWeight.Black,color=sNight)
        }
        Text(tr(lang,
            "Commission is settled weekly according to the affiliate agreement. After settlement, check your payable balance, register a payout wallet and submit a withdrawal request. Payment is subject to review and approval.",
            "کمیسیون مطابق قرارداد همکاری به‌صورت هفتگی تسویه می‌شود. پس از تسویه، موجودی قابل برداشت را بررسی کنید، کیف پول برداشت ثبت کنید و درخواست برداشت بدهید. پرداخت نهایی پس از بررسی و تأیید انجام می‌شود."),
            fontSize=12.sp,lineHeight=20.sp,color=Color(0xFF355042))
        Text(tr(lang,"Minimum withdrawal: ","حداقل برداشت: ")+minimum,
            color=sGreenDark,fontWeight=FontWeight.Bold,fontSize=12.sp)
        Text(tr(lang,"Settlement timezone: ","منطقه زمانی تسویه: ")+timezone,
            fontSize=11.sp,color=sGray)
        Text(tr(lang,
            "The attributable relationship may remain on record long-term, but lifetime earnings and a fixed rate are not guaranteed independently of account terms.",
            "انتساب زیرمجموعه در سوابق حفظ می‌شود؛ اما درآمد مادام‌العمر و نرخ ثابت، مستقل از شرایط قرارداد تضمین نمی‌شود."),
            fontSize=10.sp,lineHeight=17.sp,color=sGray)
        if(onPayouts != null) TextButton(onClick=onPayouts,modifier=Modifier.align(Alignment.End)) {
            Text(tr(lang,"Payout details","جزئیات برداشت"),
                color=sGreenDark,fontWeight=FontWeight.Bold)
            Icon(Icons.Default.ArrowForward,null,tint=sGreenDark)
        }
    }
}

@Composable
private fun StudioGiftRow118(lang:Lang,gift:StudioGift,onCopy:()->Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
        .background(Color(0xFFEAF3ED)).padding(13.dp),
        verticalAlignment=Alignment.CenterVertically) {
        Icon(Icons.Default.CardGiftcard,null,tint=sGreenDark)
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(gift.code,color=sBlack,fontWeight=FontWeight.Black,fontSize=15.sp)
            Text(tr(lang,"Uses: ","استفاده: ")+gift.uses +
                "  ·  " + if(gift.active) tr(lang,"Active","فعال")
                    else tr(lang,"Inactive","غیرفعال"),color=sGray,fontSize=11.sp)
        }
        IconButton(onClick=onCopy) {
            Icon(Icons.Default.ContentCopy,tr(lang,"Copy gift code","کپی کد هدیه"),
                tint=sGreenDark)
        }
    }
}

@Composable
private fun StudioEmpty118(lang: Lang) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp))
        .background(Color(0xFFEAF3ED)).padding(16.dp),
        verticalAlignment=Alignment.CenterVertically) {
        Icon(Icons.Default.Info,null,tint=sGreenDark,modifier=Modifier.size(18.dp))
        Spacer(Modifier.width(9.dp))
        Text(tr(lang,"No verified data for this period","داده تأییدشده‌ای برای این بازه موجود نیست"),
            color=Color(0xFF426450),fontSize=12.sp)
    }
}

/** Distribution link maps to a signed, versioned APK built for this affiliate. */
@Composable
private fun StudioAffiliateApp120(
    lang: Lang,
    partnerCode: String,
    approved: Boolean,
    onDownload: (String) -> Unit,
    onShare: (String) -> Unit
) {
    val code = partnerCode.trim().uppercase(java.util.Locale.ROOT)
    val allowed = approved && Regex("^[A-Z0-9_-]{3,64}$").matches(code)
    val url = if(allowed) "https://betvima.com/app/affiliate/$code" else ""
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
        .background(Brush.horizontalGradient(listOf(sNight,Color(0xFF153C29))))
        .padding(18.dp),verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically) {
            Icon(Icons.Default.Android,null,tint=sGreen,modifier=Modifier.size(29.dp))
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(tr(lang,"Your branded Android app","اپ اندروید اختصاصی شما"),
                    color=Color.White,fontSize=16.sp,fontWeight=FontWeight.Black)
                Text(tr(lang,"Latest available native BetVima build",
                    "آخرین نسخه نیتیو موجود بت‌ویما"),
                    color=Color(0xFFBAD2C3),fontSize=11.sp)
            }
        }
        Text(tr(lang,
            "Share this installation link. The approved partner attribution is embedded in the APK; new players are linked during account creation without entering a referral code in the gift field.",
            "این لینک نصب را به زیرمجموعه‌ها بدهید. کد همکاری تأییدشده داخل APK قرار می‌گیرد و هنگام ثبت‌نام خودکار اعمال می‌شود، بدون نمایش در فیلد هدیه."),
            color=Color(0xFFD3E1D7),fontSize=11.sp,lineHeight=19.sp)
        Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
            Button(onClick={onDownload(url)},enabled=allowed,
                modifier=Modifier.weight(1f),shape=RoundedCornerShape(12.dp),
                colors=ButtonDefaults.buttonColors(containerColor=sGreen)) {
                Icon(Icons.Default.Download,null,tint=sBlack,
                    modifier=Modifier.size(16.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang,"Download APK","دانلود APK"),color=sBlack,
                    fontSize=12.sp,fontWeight=FontWeight.Black)
            }
            OutlinedButton(onClick={onShare(url)},enabled=allowed,
                modifier=Modifier.weight(1f),shape=RoundedCornerShape(12.dp),
                border=BorderStroke(1.dp,sGreen.copy(alpha=.65f))) {
                Icon(Icons.Default.Share,null,tint=sGreen,
                    modifier=Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(tr(lang,"Share link","اشتراک لینک"),color=sGreen,fontSize=12.sp)
            }
        }
        if(!allowed) Text(tr(lang,"Your affiliate account must be approved before a partner APK can be downloaded.",
            "برای دریافت APK اختصاصی باید حساب همکاری شما تأیید شده باشد."),
            color=Color(0xFFFFD68D),fontSize=11.sp)
    }
}
