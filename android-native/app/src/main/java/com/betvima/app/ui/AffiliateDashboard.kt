package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import android.content.Intent
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.net.URLEncoder
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope
import org.json.JSONObject

data class GiftCode(val code: String, val uses: Int, val active: Boolean)

/**
 * Read-only affiliate reporting plus server-authorized gift code creation.
 * Commissions and financial state are never computed on-device.
 */
@Composable
fun AffiliateDashboard(state: AppState, model: AppViewModel) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context, "affiliate") }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val uri = LocalUriHandler.current

    var affiliateAuthenticated by remember { mutableStateOf(vault.signedIn()) }
    var selectedDays by remember { mutableIntStateOf(7) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var partner by remember { mutableStateOf<JSONObject?>(null) }
    var stats by remember { mutableStateOf<JSONObject?>(null) }
    var payable by remember { mutableStateOf<JSONObject?>(null) }
    var link by remember { mutableStateOf("") }
    var gifts by remember { mutableStateOf<List<GiftCode>>(emptyList()) }
    var codeInput by remember { mutableStateOf("") }
    var giftSaving by remember { mutableStateOf(false) }

    suspend fun reload() {
        busy = true
        try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            // Overview controls partner authorization. Optional widgets must not blank it out.
            val from = URLEncoder.encode(
                Instant.now().minus(selectedDays.toLong(), ChronoUnit.DAYS).toString(), "UTF-8")
            val overview = api.get("/api/v1/affiliate/overview?from=" + from, token)
            partner = overview.optJSONObject("affiliate")
            stats = overview.optJSONObject("stats")
            payable = overview.optJSONObject("payable")
            error = null
            supervisorScope {
                val linksTask = async {
                    runCatching { api.get("/api/v1/affiliate/links", token) }
                }
                val giftsTask = async {
                    runCatching { api.get("/api/v1/affiliate/gift-codes", token) }
                }
                val urls = linksTask.await().getOrNull()
                if (urls != null) link = urls.str("primaryUrl")
                val codes = giftsTask.await().getOrNull()
                if (codes != null) gifts = codes.arr("items").objects().map {
                    GiftCode(it.str("code"), it.optInt("usageCount"),
                        it.optBoolean("isActive", false))
                }
            }
        } catch (ex: Exception) {
            partner = null
            stats = null
            payable = null
            gifts = emptyList()
            link = ""
            error = ex.message ?: tr(state.lang,
                "Affiliate access unavailable", "دسترسی به پنل افیلیت ممکن نیست")
        } finally { busy = false }
    }
    LaunchedEffect(affiliateAuthenticated, selectedDays) {
        if (affiliateAuthenticated) reload()
        else {
            partner = null; stats = null; payable = null
            link = ""; gifts = emptyList(); error = null
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(affiliateCanvas),
        contentPadding = PaddingValues(start = 14.dp,end = 14.dp,top = 14.dp,bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
        flingBehavior = rememberPremiumFlingBehavior()
    ) {
        item(key = "affiliate-hero") {
            AffiliateHeroBanner(state.lang, authenticated = affiliateAuthenticated)
        }
        if (!affiliateAuthenticated) item(key="affiliate-authentication") {
            AffiliateAccessPanel(state.lang, api, vault) {
                affiliateAuthenticated = true
            }
        } else {
            if (busy) item {
                LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
            }
            if (error != null) item {
                Surface(color = Color.White, shape = RoundedCornerShape(17.dp),
                    border = BorderStroke(1.dp, Palette.border)) {
                    Column(Modifier.padding(18.dp)) {
                        Text(error.orEmpty(), color = Palette.red, fontSize = 12.sp)
                        Text(tr(state.lang,
                            "The account may need partner approval. Open the partner portal for registration or verification.",
                            "ممکن است حساب به تأیید همکار نیاز داشته باشد. برای ثبت‌نام یا بررسی وضعیت به پنل همکاران بروید."),
                            color = Palette.muted, fontSize = 12.sp,
                            modifier = Modifier.padding(top = 8.dp))
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick={
                                vault.clear()
                                affiliateAuthenticated=false
                                partner=null;stats=null;payable=null
                            },shape=RoundedCornerShape(12.dp)) {
                                Icon(Icons.Default.LockReset,null,
                                    tint=affiliateBlue,modifier=Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(tr(state.lang,"Sign in again","ورود مجدد"),
                                    color=affiliateBlue,fontWeight=FontWeight.Bold)
                            }
                            TextButton(onClick = { scope.launch { reload() } }) {
                                Icon(Icons.Default.Refresh,null,tint=affiliateBlue,
                                    modifier=Modifier.size(16.dp))
                                Text(tr(state.lang,"Retry","تلاش مجدد"),color=affiliateBlue)
                            }
                        }
                    }
                }
            }
            if (partner != null) {
                item(key="affiliate-toolbar") {
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                        Text(tr(state.lang,"Partner command center","مرکز مدیریت همکاری"),
                            fontSize=17.sp,fontWeight=FontWeight.Black,
                            color=affiliateInk,modifier=Modifier.weight(1f))
                        IconButton(onClick={scope.launch { reload() }},enabled=!busy) {
                            Icon(Icons.Default.Refresh,
                                tr(state.lang,"Refresh","تازه‌سازی"),tint=affiliateBlue)
                        }
                        IconButton(onClick={
                            vault.clear()
                            affiliateAuthenticated=false
                            partner=null;stats=null;payable=null;gifts=emptyList();link=""
                        }) {
                            Icon(Icons.Default.Logout,
                                tr(state.lang,"Sign out partner","خروج از حساب همکار"),tint=affiliatePink)
                        }
                    }
                }
                item(key="affiliate-period") {
                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        listOf(1,7,30).forEach { days ->
                            val on=selectedDays==days
                            Surface(modifier=Modifier.weight(1f)
                                .clickable { selectedDays=days },
                                shape=RoundedCornerShape(12.dp),
                                color=if(on)affiliateBlue else Color.White,
                                border=BorderStroke(1.dp,
                                    if(on)affiliateBlue else affiliateOutline)) {
                                Box(Modifier.padding(vertical=11.dp),
                                    contentAlignment=Alignment.Center) {
                                    Text(if(days==1)tr(state.lang,"Today","امروز")
                                        else tr(state.lang,"$days days","$days روز"),
                                        color=if(on)Color.White else affiliateInk,
                                        fontSize=11.sp,fontWeight=FontWeight.Black)
                                }
                            }
                        }
                    }
                }
                item(key="affiliate-primary") {
                    Surface(color = affiliateInk, shape = RoundedCornerShape(23.dp)) {
                        Column(Modifier.padding(21.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Hub, null, tint = Color(0xFF95D6FF))
                                Spacer(Modifier.width(10.dp))
                                Text(tr(state.lang, "BETVIMA PARTNERS", "همکاران بت‌ویما"),
                                    fontSize = 15.sp, fontWeight = FontWeight.Black,
                                    color = Color.White, modifier = Modifier.weight(1f))
                                SmallPill(partner?.str("status", "—") ?: "—",
                                    Color(0xFF243A51),Color(0xFF8EDDFF))
                            }
                            Spacer(Modifier.height(14.dp))
                            Text(tr(state.lang, "Your partner code", "کد همکاری شما"),
                                fontSize = 11.sp, color = Color(0xFFA9BDC6))
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Text(partner?.str("code", "—") ?: "—",
                                    fontWeight=FontWeight.Black, fontSize=26.sp,
                                    color=Color(0xFF9BD1FF),
                                    modifier=Modifier.weight(1f),maxLines=1)
                                IconButton(onClick={
                                    clipboard.setText(AnnotatedString(partner?.str("code") ?: ""))
                                    model.notice(tr(state.lang,"Partner code copied","کد همکاری کپی شد"))
                                }) {
                                    Icon(Icons.Default.ContentCopy,
                                        tr(state.lang,"Copy partner code","کپی کد همکاری"),
                                        tint=Color(0xFFFFA9D9))
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            if (link.isNotBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(link, modifier = Modifier.weight(1f),
                                        color = Color(0xFFBED1D7), maxLines = 1,
                                        overflow = TextOverflow.Ellipsis, fontSize = 11.sp)
                                    IconButton(onClick = {
                                        clipboard.setText(AnnotatedString(link))
                                        model.notice(tr(state.lang,"Link copied","لینک کپی شد"))
                                    }) {
                                        Icon(Icons.Default.ContentCopy,
                                            tr(state.lang,"Copy link","کپی لینک"),tint=Color(0xFF9BD1FF))
                                    }
                                    IconButton(onClick = {
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type="text/plain"
                                            putExtra(Intent.EXTRA_TEXT, link)
                                        }
                                        context.startActivity(Intent.createChooser(intent,
                                            tr(state.lang,"Share referral link","اشتراک لینک")))
                                    }) {
                                        Icon(Icons.Default.Share,
                                            tr(state.lang,"Share link","اشتراک لینک"),
                                            tint=Color(0xFFFFA9D9))
                                    }
                                }
                            }
                        }
                    }
                }
                item(key="partner-terms") {
                    Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                        val commissionBps=partner?.optInt("commissionRateBps", -1) ?: -1
                        val rate=if(commissionBps>=0) {
                            java.math.BigDecimal(commissionBps)
                                .movePointLeft(2).stripTrailingZeros()
                                .toPlainString() + "%"
                        } else "—"
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang,"Your commission rate","نرخ کمیسیون شما"),
                            rate,affiliateBlue)
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang,"Min. payout","حداقل برداشت"),
                            partner?.str("minPayoutMinor")?.takeIf { it.isNotBlank() }
                                ?.let { money(it,partner?.str("currency","USD") ?: "USD") }
                                ?: "—",affiliatePink)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Clicks", "کلیک‌ها"),
                            if (stats?.has("clicks") == true) stats?.optInt("clicks").toString() else "—",
                            Palette.blue)
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Signups", "ثبت‌نام‌ها"),
                            if (stats?.has("registrations") == true) stats?.optInt("registrations").toString() else "—",
                            Palette.green)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "First deposits", "اولین واریز"),
                            if (stats?.has("firstDeposits") == true) stats?.optInt("firstDeposits").toString() else "—",
                            Palette.green)
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Active users", "کاربران فعال"),
                            if (stats?.has("activeUsers") == true) stats?.optInt("activeUsers").toString() else "—",
                            Palette.blue)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Total deposits", "کل واریز زیرمجموعه‌ها"),
                            stats?.str("totalDepositMinor")?.takeIf { it.isNotBlank() }
                                ?.let { money(it, partner?.str("currency", "USD") ?: "USD") } ?: "—",
                            Palette.blue)
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Payable", "کمیسیون قابل برداشت"),
                            payable?.str("payableMinor")?.takeIf { it.isNotBlank() }
                                ?.let { money(it, partner?.str("currency", "USD") ?: "USD") } ?: "—",
                            Palette.green)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Your share", "سهم همکاری"),
                            stats?.str("panelShareMinor")?.takeIf { it.isNotBlank() }
                                ?.let { money(it, partner?.str("currency", "USD") ?: "USD") } ?: "—",
                            Palette.green)
                        AffiliateMetric(Modifier.weight(1f),
                            tr(state.lang, "Player P/L", "سود و زیان کاربران"),
                            stats?.str("playerNetResultMinor")?.takeIf { it.isNotBlank() }
                                ?.let { money(it, partner?.str("currency", "USD") ?: "USD") } ?: "—",
                            Palette.blue)
                    }
                }
                item(key = "native-affiliate-operations") {
                    AffiliateOperations(state, model,
                        partner?.str("currency", "USD") ?: "USD",
                        partner?.str("minPayoutMinor", "0") ?: "0")
                }
                item {
                    SectionHeading(tr(state.lang, "Registration gift codes", "کدهای هدیه ثبت‌نام"),
                        tr(state.lang, "Maximum 10 codes, 4–8 letters or digits",
                            "حداکثر ۱۰ کد، هر کدام ۴ تا ۸ حرف یا عدد"))
                }
                item {
                    Surface(color = Color.White, shape = RoundedCornerShape(17.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                OutlinedTextField(codeInput,
                                    { codeInput = it.uppercase().filter(Char::isLetterOrDigit).take(8) },
                                    label = { Text(tr(state.lang, "Gift code", "کد هدیه")) },
                                    singleLine = true, modifier = Modifier.weight(1f))
                                Spacer(Modifier.width(9.dp))
                                Button(enabled = !giftSaving && gifts.size < 10 &&
                                    AffiliateInputRules.validGiftCode(codeInput),
                                    onClick = {
                                        scope.launch {
                                            giftSaving = true
                                            try {
                                                val jwt = vault.accessToken(api)
                                                    ?: throw IllegalStateException("Sign in required")
                                                api.post("/api/v1/affiliate/gift-codes",
                                                    JSONObject().put("code", codeInput), jwt)
                                                codeInput = ""
                                                reload()
                                            } catch (ex: Exception) {
                                                error = ex.message ?: "Unable to create code"
                                            } finally { giftSaving = false }
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Palette.green)) {
                                    Icon(Icons.Default.Add, null, tint = Palette.ink)
                                }
                            }
                            Text(tr(state.lang, "Codes are issued and validated by the server.",
                                "ساخت و اعتبارسنجی کدها فقط توسط سرور انجام می‌شود."),
                                color = Palette.muted, fontSize = 10.sp,
                                modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
                items(gifts, key = { it.code }) { gift ->
                    Surface(color = Color.White, shape = RoundedCornerShape(15.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CardGiftcard, null, tint = Palette.blue)
                            Spacer(Modifier.width(11.dp))
                            Column(Modifier.weight(1f)) {
                                Text(gift.code, fontSize = 15.sp, fontWeight = FontWeight.Black)
                                Text(tr(state.lang, "Uses: ", "تعداد استفاده: ") + gift.uses,
                                    color = Palette.muted, fontSize = 10.sp)
                            }
                            SmallPill(
                                if (gift.active) tr(state.lang, "Active", "فعال")
                                else tr(state.lang, "Inactive", "غیرفعال"),
                                if (gift.active) Palette.greenLight else Palette.paper,
                                if (gift.active) Palette.ink else Palette.muted)
                            IconButton(onClick = {
                                clipboard.setText(AnnotatedString(gift.code))
                            }) {
                                Icon(Icons.Default.ContentCopy, "Copy gift code", tint = Palette.blue)
                            }
                        }
                    }
                }

            }
        }
    }
}
@Composable
private fun AffiliateMetric(modifier: Modifier, label: String, value: String, tint: Color) {
    Surface(modifier = modifier, color = Color.White, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Palette.border)) {
        Column(Modifier.padding(15.dp)) {
            Text(label, color = Palette.muted, fontSize = 11.sp, maxLines = 1)
            Spacer(Modifier.height(8.dp))
            Text(value, color = tint, fontSize = 19.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
    }
}
