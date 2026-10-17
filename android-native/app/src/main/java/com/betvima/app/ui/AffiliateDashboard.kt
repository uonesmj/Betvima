package com.betvima.app.ui

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
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
import java.math.BigInteger
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class GiftCode(val code: String, val uses: Int, val active: Boolean)

private data class PartnerNav(val id: String, val en: String, val fa: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val partnerNavigation = listOf(
    PartnerNav("overview", "Dashboard", "داشبورد", Icons.Default.SpaceDashboard),
    PartnerNav("referrals", "Referrals", "زیرمجموعه‌ها", Icons.Default.Groups),
    PartnerNav("links", "Referral links", "لینک‌های معرفی", Icons.Default.Link),
    PartnerNav("gifts", "Gift codes", "کدهای هدیه", Icons.Default.CardGiftcard),
    PartnerNav("ledger", "Commission ledger", "گردش کمیسیون", Icons.Default.ReceiptLong),
    PartnerNav("payouts", "Payouts", "پرداخت‌ها", Icons.Default.Payments),
    PartnerNav("wallets", "Payout wallets", "کیف پول‌ها", Icons.Default.AccountBalanceWallet)
)

/** Mobile-only workspace. Every number is supplied by the authorized partner API. */
@Composable
fun AffiliateDashboard(state: AppState, model: AppViewModel) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context, "affiliate") }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    var authenticated by remember { mutableStateOf(vault.signedIn()) }
    var page by rememberSaveable { mutableStateOf("overview") }
    var menuOpen by remember { mutableStateOf(false) }
    var refresh by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var partner by remember { mutableStateOf<JSONObject?>(null) }
    var stats by remember { mutableStateOf<JSONObject?>(null) }
    var daily by remember { mutableStateOf<List<PartnerDailyStat>>(emptyList()) }
    var dailyReliable by remember { mutableStateOf(false) }
    var link by remember { mutableStateOf("") }
    var gifts by remember { mutableStateOf<List<GiftCode>>(emptyList()) }
    var codeInput by remember { mutableStateOf("") }
    var giftSaving by remember { mutableStateOf(false) }
    var giftError by remember { mutableStateOf<String?>(null) }

    fun signOut() {
        vault.clear()
        authenticated = false
        page = "overview"
        menuOpen = false
        partner = null; stats = null; daily = emptyList()
        dailyReliable = false; gifts = emptyList(); link = ""; error = null
    }

    suspend fun reload() {
        loading = true
        try {
            val token = vault.accessToken(api)
                ?: throw IllegalStateException("Sign in required")
            // Unbounded history is needed to make the "All" P/L genuinely all-time.
            // It is scoped by withAffiliate and affiliate_id in the server API.
            val overview = api.get(
                "/api/v1/affiliate/overview?from=" +
                    java.net.URLEncoder.encode(Instant.EPOCH.toString(), "UTF-8"), token
            )
            val info = overview.optJSONObject("affiliate")
                ?: throw IllegalStateException("Partner overview is unavailable")
            val figures = overview.optJSONObject("stats")
            val rows = parsePartnerDailyStats(overview, info.str("currency", "USD"))
            partner = info
            stats = figures
            daily = rows
            dailyReliable = overview.has("dailyStats") && (
                rows.isNotEmpty() ||
                    validatedPartnerTotal(figures, "registrations") == BigInteger.ZERO)
            error = null
            supervisorScope {
                val linksTask = async { runCatching { api.get("/api/v1/affiliate/links", token) } }
                val codesTask = async { runCatching { api.get("/api/v1/affiliate/gift-codes", token) } }
                linksTask.await().getOrNull()?.let { link = it.str("primaryUrl") }
                codesTask.await().getOrNull()?.let { payload ->
                    gifts = payload.arr("items").objects().map {
                        GiftCode(it.str("code"), it.optInt("usageCount"),
                            it.optBoolean("isActive", false))
                    }
                }
            }
        } catch (ex: Exception) {
            partner = null; stats = null; daily = emptyList()
            dailyReliable = false
            error = ex.message ?: tr(state.lang, "Unable to load partner data",
                "دریافت اطلاعات همکاری ممکن نیست")
        } finally { loading = false }
    }

    fun createGift() {
        val code = codeInput.trim().uppercase()
        if (!AffiliateInputRules.validGiftCode(code) || gifts.size >= 10 || giftSaving)
            return
        scope.launch {
            giftSaving = true
            giftError = null
            try {
                val token = vault.accessToken(api)
                    ?: throw IllegalStateException("Sign in required")
                api.post("/api/v1/affiliate/gift-codes",
                    JSONObject().put("code", code), token)
                codeInput = ""
                refresh++
                model.notice(tr(state.lang, "Gift code created", "کد هدیه ایجاد شد"))
            } catch (ex: Exception) {
                giftError = ex.message ?: tr(state.lang,
                    "Unable to create gift code", "ساخت کد هدیه ناموفق بود")
            } finally { giftSaving = false }
        }
    }

    LaunchedEffect(authenticated, refresh) {
        if (authenticated) reload()
        else {
            partner = null; stats = null; daily = emptyList()
            dailyReliable = false; error = null
        }
    }

    val lang = state.lang
    val timezone = remember(partner) {
        runCatching {
            ZoneId.of(partner?.str("settlementTimezone", "Asia/Tehran")
                .orEmpty().ifBlank { "Asia/Tehran" })
        }.getOrDefault(ZoneId.of("Asia/Tehran"))
    }
    val today = LocalDate.now(timezone)
    val yesterday = today.minusDays(1)
    val currency = partner?.str("currency", "USD") ?: "USD"
    val signupPeriods = listOf(
        Triple(tr(lang, "Today", "امروز"), today, today),
        Triple(tr(lang, "Yesterday", "دیروز"), yesterday, yesterday),
        Triple(tr(lang, "7 days", "۷ روز"), today.minusDays(6), today),
        Triple(tr(lang, "Month", "ماه"), today.withDayOfMonth(1), today),
        Triple(tr(lang, "Year", "سال"), today.withDayOfYear(1), today)
    )
    val playerPeriods = listOf(
        Triple(tr(lang, "Today", "امروز"), today, today),
        Triple(tr(lang, "Yesterday", "دیروز"), yesterday, yesterday),
        Triple(tr(lang, "Previous week", "هفته قبل"), today.minusDays(13), today.minusDays(7)),
        Triple(tr(lang, "All time", "کل دوره"), LocalDate.of(1970, 1, 1), today)
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(affiliateCanvas),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 106.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
        flingBehavior = rememberPremiumFlingBehavior()
    ) {
        if (!authenticated) {
            item(key="partner-guest-hero") {
                AffiliateHeroBanner(lang, authenticated = false)
            }
            item(key="partner-login") {
                AffiliateAccessPanel(lang, api, vault) {
                    authenticated = true
                    page = "overview"
                }
            }
        } else {
            item(key="partner-header") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang, "PARTNERS · BETVIMA", "همکاران · بت‌ویما"),
                            fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                            color = affiliateBlue, letterSpacing = .8.sp)
                        Text(if (page == "overview")
                            tr(lang, "Partner dashboard", "داشبورد همکاری")
                        else partnerNavigation.firstOrNull { it.id == page }?.let { tr(lang, it.en, it.fa) }
                            ?: tr(lang, "Partner workspace", "فضای کاری"),
                            fontSize = 22.sp, color = affiliateInk, fontWeight = FontWeight.Black)
                    }
                    IconButton(onClick = { refresh++ }, enabled = !loading) {
                        Icon(Icons.Default.Refresh, tr(lang,"Refresh", "تازه‌سازی"),
                            tint = affiliateBlue)
                    }
                    val rotation by animateFloatAsState(
                        if (menuOpen) 90f else 0f,
                        animationSpec = tween(280), label = "partner-menu-rotation")
                    Surface(
                        shape = RoundedCornerShape(15.dp),
                        color = if (menuOpen) affiliateBlue else Color.White,
                        border = BorderStroke(1.dp, if (menuOpen) affiliateBlue else affiliateOutline),
                        modifier = Modifier.size(48.dp)
                            .clickable { menuOpen = !menuOpen }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(if (menuOpen) Icons.Default.Close else Icons.Default.Menu,
                                tr(lang, "Partner navigation", "منوی همکاری"),
                                modifier = Modifier.size(24.dp).rotate(rotation),
                                tint = if (menuOpen) Color.White else affiliateInk)
                        }
                    }
                }
            }
            item(key="partner-menu") {
                AnimatedVisibility(
                    visible = menuOpen,
                    enter = expandVertically(animationSpec = tween(340)) + fadeIn(tween(230)),
                    exit = shrinkVertically(animationSpec = tween(280)) + fadeOut(tween(200))
                ) {
                    Surface(
                        shape = RoundedCornerShape(21.dp), color = Color.White,
                        border = BorderStroke(1.dp, affiliateOutline),
                        shadowElevation = 4.dp
                    ) {
                        Column(Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            partnerNavigation.chunked(2).forEach { pair ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    pair.forEach { tab ->
                                        val selected = page == tab.id
                                        Surface(
                                            modifier = Modifier.weight(1f).clickable {
                                                page = tab.id; menuOpen = false
                                            },
                                            shape = RoundedCornerShape(13.dp),
                                            color = if (selected) Color(0xFFEAF3FF) else Color(0xFFF8FAFD)
                                        ) {
                                            Row(Modifier.padding(horizontal = 10.dp, vertical = 13.dp),
                                                verticalAlignment = Alignment.CenterVertically) {
                                                Icon(tab.icon, null, tint = if (selected)
                                                    affiliateBlue else affiliatePink,
                                                    modifier = Modifier.size(18.dp))
                                                Spacer(Modifier.width(7.dp))
                                                Text(tr(lang,tab.en,tab.fa), fontSize = 11.sp,
                                                    color = affiliateInk,
                                                    fontWeight = FontWeight.Bold,
                                                    maxLines = 2)
                                            }
                                        }
                                    }
                                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                            Divider(color = Color(0xFFEBEEF4))
                            TextButton(onClick = ::signOut) {
                                Icon(Icons.Default.Logout, null, tint = affiliatePink,
                                    modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(tr(lang, "Sign out of partner account", "خروج از حساب افیلیت"),
                                    color = affiliatePink, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            if (loading) item(key="partner-loading") {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = affiliateBlue)
            }
            if (error != null) item(key="partner-error") {
                Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                    border = BorderStroke(1.dp, affiliateOutline)) {
                    Column(Modifier.padding(15.dp)) {
                        Text(error.orEmpty(), color = Palette.red, fontSize = 12.sp)
                        TextButton(onClick = { refresh++ }) {
                            Text(tr(lang,"Retry","تلاش مجدد"),color=affiliateBlue)
                        }
                        TextButton(onClick = ::signOut) {
                            Text(tr(lang,"Sign in again","ورود مجدد"),color=affiliatePink)
                        }
                    }
                }
            }
            if (partner != null && page == "overview") {
                item(key="partner-tools") {
                    Surface(color = affiliateInk, shape = RoundedCornerShape(24.dp),
                        shadowElevation = 3.dp) {
                        Column(Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(13.dp)) {
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Icon(Icons.Default.Hub, null, tint=Color(0xFF9BD1FF),
                                    modifier=Modifier.size(20.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(tr(lang,"YOUR REFERRAL HUB","مرکز معرفی شما"),
                                    color=Color.White, fontWeight=FontWeight.Black,
                                    fontSize=13.sp, modifier=Modifier.weight(1f))
                                SmallPill(partner?.str("status", "—") ?: "—",
                                    Color(0xFF243A51), Color(0xFF8EDDFF))
                            }
                            Text(tr(lang, "Referral link", "لینک معرفی"),
                                color=Color(0xFFB6C3D2),fontSize=10.sp)
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Text(link.ifBlank { tr(lang,"Link unavailable","لینک در دسترس نیست") },
                                    color=Color.White,modifier=Modifier.weight(1f),
                                    maxLines=2,overflow=TextOverflow.Ellipsis,fontSize=12.sp)
                                IconButton(onClick={
                                    if (link.isNotBlank()) {
                                        clipboard.setText(AnnotatedString(link))
                                        model.notice(tr(lang,"Link copied","لینک کپی شد"))
                                    }
                                },enabled=link.isNotBlank()) {
                                    Icon(Icons.Default.ContentCopy,
                                        tr(lang,"Copy link","کپی لینک"),tint=Color(0xFF9BD1FF))
                                }
                                IconButton(onClick={
                                    if (link.isNotBlank()) {
                                        val share = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, link)
                                        }
                                        context.startActivity(Intent.createChooser(share,
                                            tr(lang,"Share referral link","اشتراک لینک")))
                                    }
                                },enabled=link.isNotBlank()) {
                                    Icon(Icons.Default.Share,
                                        tr(lang,"Share link","اشتراک لینک"),
                                        tint=Color(0xFFFFA9D9))
                                }
                            }
                            Divider(color=Color.White.copy(alpha=.13f))
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Icon(Icons.Default.CardGiftcard, null,
                                    tint=Color(0xFFFFA9D9),modifier=Modifier.size(20.dp))
                                Spacer(Modifier.width(8.dp))
                                Text(tr(lang,"Create registration gift code",
                                    "ساخت کد هدیه ثبت‌نام"),
                                    color=Color.White,fontSize=12.sp,
                                    fontWeight=FontWeight.Black,
                                    modifier=Modifier.weight(1f))
                                Text("${gifts.size}/10",color=Color(0xFF9BD1FF),
                                    fontSize=11.sp,fontWeight=FontWeight.Bold)
                            }
                            Row(verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value=codeInput,
                                    onValueChange={
                                        codeInput=it.uppercase().filter { c ->
                                            c in 'A'..'Z' || c in '0'..'9'
                                        }.take(8)
                                        giftError=null
                                    },singleLine=true,
                                    placeholder={Text(tr(lang,"4–8 letters or numbers",
                                        "۴ تا ۸ حرف یا عدد"),fontSize=11.sp)},
                                    modifier=Modifier.weight(1f),
                                    colors=OutlinedTextFieldDefaults.colors(
                                        focusedTextColor=Color.White,
                                        unfocusedTextColor=Color.White,
                                        focusedBorderColor=Color(0xFF9BD1FF),
                                        unfocusedBorderColor=Color(0xFF586B85),
                                        focusedPlaceholderColor=Color(0xFF93A8BB),
                                        unfocusedPlaceholderColor=Color(0xFF93A8BB)
                                    ),
                                    shape=RoundedCornerShape(13.dp)
                                )
                                Button(onClick=::createGift,
                                    enabled=!giftSaving && gifts.size<10 &&
                                        AffiliateInputRules.validGiftCode(codeInput),
                                    contentPadding=PaddingValues(0.dp),
                                    modifier=Modifier.size(56.dp),
                                    shape=RoundedCornerShape(14.dp),
                                    colors=ButtonDefaults.buttonColors(containerColor=affiliateBlue)) {
                                    if (giftSaving) CircularProgressIndicator(
                                        Modifier.size(20.dp),color=Color.White,strokeWidth=2.dp)
                                    else Icon(Icons.Default.Add,
                                        tr(lang,"Create gift code","ساخت کد"),
                                        tint=Color.White)
                                }
                            }
                            if (giftError != null)
                                Text(giftError.orEmpty(),color=Color(0xFFFFA4BB),fontSize=11.sp)
                            TextButton(
                                onClick={page="gifts"},
                                contentPadding=PaddingValues(0.dp)
                            ) {
                                Text(tr(lang,"Manage gift codes","مدیریت کدهای هدیه"),
                                    color=Color(0xFF9BD1FF),fontSize=11.sp)
                                Icon(Icons.Default.ChevronRight,null,
                                    tint=Color(0xFF9BD1FF),modifier=Modifier.size(16.dp))
                            }
                        }
                    }
                }
                item(key="partner-real-chart") {
                    AffiliateProfitChart(daily,today,lang,dailyReliable)
                }
                item(key="partner-registrations") {
                    PartnerOverviewPanel(tr(lang,"Registrations","ثبت‌نام کاربران"),
                        tr(lang,"Verified affiliate registrations by period",
                            "تعداد ثبت‌نام‌های منتسب به لینک همکاری"),
                        Icons.Default.PersonAdd) {
                        signupPeriods.forEach { (label,start,end) ->
                            PartnerOverviewLine(label,
                                if (dailyReliable) partnerRegistrations(daily,start,end).toString()
                                else "—",affiliateBlue)
                        }
                    }
                }
                item(key="partner-profit-loss") {
                    PartnerOverviewPanel(tr(lang,"Player profit / loss","سود و زیان کاربران"),
                        tr(lang,"Settled player net result, not your commission",
                            "نتیجه خالص کاربران پس از تسویه، نه کمیسیون افیلیت"),
                        Icons.Default.AccountBalance) {
                        playerPeriods.forEachIndexed { index, (label,start,end) ->
                            val net = if (index==3)
                                validatedPartnerTotal(stats, "playerNetResultMinor")
                            else if (dailyReliable) partnerPlayerNet(daily,start,end)
                            else null
                            PartnerOverviewLine(label,net?.let { money(it.toString(), currency) }
                                ?: "—",if (net != null && net.signum() < 0) affiliatePink
                                else affiliateBlue)
                        }
                    }
                }
                item(key="partner-active") {
                    Surface(color=Color.White,shape=RoundedCornerShape(18.dp),
                        border=BorderStroke(1.dp,affiliateOutline)) {
                        Row(Modifier.fillMaxWidth().padding(17.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Surface(color=Color(0xFFE8F9F1),shape=RoundedCornerShape(13.dp)) {
                                Icon(Icons.Default.Groups,null,
                                    tint=Color(0xFF07BA72),
                                    modifier=Modifier.padding(10.dp).size(22.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(tr(lang,"Active referred users","کاربران زیرمجموعه فعال"),
                                    color=affiliateInk,fontSize=13.sp,fontWeight=FontWeight.Black)
                                Text(tr(lang,"Today · activity recorded by the server",
                                    "فعالیت ثبت‌شده در امروز"),
                                    color=Palette.muted,fontSize=10.sp)
                            }
                            Text(if (dailyReliable)
                                (daily.firstOrNull { it.day==today }?.activeUsers ?: 0).toString()
                                else "—",color=Color(0xFF07BA72),fontSize=24.sp,
                                fontWeight=FontWeight.Black)
                        }
                    }
                }
            } else if (partner != null && page == "gifts") {
                item(key="partner-gifts-heading") {
                    SectionHeading(tr(lang,"Registration gift codes","کدهای هدیه ثبت‌نام"),
                        tr(lang,"Up to 10 codes · 4–8 letters or numbers",
                            "حداکثر ۱۰ کد · هر کد ۴ تا ۸ حرف یا عدد"))
                }
                item(key="partner-gifts-create") {
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        OutlinedTextField(codeInput,{
                            codeInput=it.uppercase().filter { c ->
                                c in 'A'..'Z'||c in '0'..'9'
                            }.take(8);giftError=null
                        },singleLine=true,
                            label={Text(tr(lang,"Gift code","کد هدیه"))},
                            modifier=Modifier.weight(1f))
                        Button(onClick=::createGift,
                            enabled=!giftSaving&&gifts.size<10&&
                                AffiliateInputRules.validGiftCode(codeInput)) {
                            Icon(Icons.Default.Add,null)
                        }
                    }
                    if (giftError!=null) Text(giftError.orEmpty(),
                        color=Palette.red,fontSize=12.sp)
                }
                if (gifts.isEmpty()) item {
                    Text(tr(lang,"No gift codes yet","هنوز کد هدیه‌ای ساخته نشده است"),
                        modifier=Modifier.padding(18.dp),color=Palette.muted)
                }
                items(gifts,key={it.code}) { gift ->
                    Surface(color=Color.White,shape=RoundedCornerShape(15.dp),
                        border=BorderStroke(1.dp,affiliateOutline)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.CardGiftcard,null,tint=affiliatePink)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(gift.code,color=affiliateInk,fontSize=15.sp,
                                    fontWeight=FontWeight.Black)
                                Text(tr(lang,"Uses: ","دفعات استفاده: ")+gift.uses,
                                    color=Palette.muted,fontSize=10.sp)
                            }
                            SmallPill(if(gift.active)tr(lang,"Active","فعال")
                                else tr(lang,"Inactive","غیرفعال"),
                                Color(0xFFF1F7FF),affiliateBlue)
                            IconButton(onClick={
                                clipboard.setText(AnnotatedString(gift.code))
                                model.notice(tr(lang,"Code copied","کد کپی شد"))
                            }) { Icon(Icons.Default.ContentCopy,null,tint=affiliateBlue) }
                        }
                    }
                }
            } else if (partner != null && page != "overview") {
                item(key="partner-secondary-$page") {
                    AffiliateOperations(
                        state,model,currency,
                        partner?.str("minPayoutMinor","0") ?: "0",
                        initialTab=page,showNavigation=false,
                        onNavigate={ destination -> page=destination; menuOpen=false }
                    )
                }
            }
        }
    }
}

@Composable
private fun PartnerOverviewPanel(
    title:String,subtitle:String,icon:androidx.compose.ui.graphics.vector.ImageVector,
    content:@Composable ColumnScope.() -> Unit
) {
    Surface(color=Color.White,shape=RoundedCornerShape(21.dp),
        border=BorderStroke(1.dp,affiliateOutline)) {
        Column(Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(icon,null,tint=affiliateBlue,modifier=Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Column {
                    Text(title,color=affiliateInk,fontSize=15.sp,fontWeight=FontWeight.Black)
                    Text(subtitle,color=Palette.muted,fontSize=10.sp)
                }
            }
            Divider(color=Color(0xFFEDF0F5))
            content()
        }
    }
}

@Composable
private fun PartnerOverviewLine(label:String,value:String,tint:Color) {
    Row(Modifier.fillMaxWidth().padding(vertical=4.dp),
        verticalAlignment=Alignment.CenterVertically) {
        Text(label,color=Color(0xFF718096),fontSize=12.sp,
            modifier=Modifier.weight(1f))
        Text(value,color=tint,fontSize=14.sp,fontWeight=FontWeight.Black,
            maxLines=1,overflow=TextOverflow.Ellipsis)
    }
}
