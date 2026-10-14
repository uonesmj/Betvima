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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch
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
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val uri = LocalUriHandler.current

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
            val overview = api.get("/api/v1/affiliate/overview", token)
            partner = overview.optJSONObject("affiliate")
            stats = overview.optJSONObject("stats")
            payable = overview.optJSONObject("payable")
            error = null
            kotlinx.coroutines.supervisorScope {
                val linksTask = kotlinx.coroutines.async {
                    runCatching { api.get("/api/v1/affiliate/links", token) }
                }
                val giftsTask = kotlinx.coroutines.async {
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
    LaunchedEffect(state.signedIn) {
        if (state.signedIn) reload()
        else {
            partner = null; stats = null; payable = null
            link = ""; gifts = emptyList(); error = null
        }
    }
    LazyColumn(contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "BETVIMA PARTNERS", "همکاران بت‌ویما"),
                title = tr(state.lang, "Your partner dashboard", "داشبورد همکاری شما"),
                subtitle = tr(state.lang,
                    "Track referrals and gift codes without leaving the native app.",
                    "گزارش زیرمجموعه‌ها و کدهای معرفی را در خود اپ ببینید."),
                icon = Icons.Default.Groups, accent = Palette.green
            )
        }
        item {
            SectionHeading(tr(state.lang, "Partner command center", "پنل مدیریت همکاری"),
                tr(state.lang, "Referrals, codes and results from your account",
                    "زیرمجموعه‌ها، کدهای هدیه و گزارش‌های واقعی"))
        }
        if (!state.signedIn) item {
            LockedFeature(state.lang,
                tr(state.lang, "Sign in with your partner account",
                    "با حساب همکار خود وارد شوید")) { model.showLogin(true) }
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
                        TextButton(onClick = { uri.openUri("https://betvima.com/affiliate") }) {
                            Text(tr(state.lang, "Partner portal", "پنل همکاران"),
                                color = Palette.blue)
                        }
                    }
                }
            }
            if (partner != null) {
                item {
                    Surface(color = Palette.ink, shape = RoundedCornerShape(22.dp)) {
                        Column(Modifier.padding(21.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Groups, null, tint = Palette.green)
                                Spacer(Modifier.width(10.dp))
                                Text(tr(state.lang, "BETVIMA PARTNERS", "همکاران بت‌ویما"),
                                    fontSize = 15.sp, fontWeight = FontWeight.Black,
                                    color = Color.White, modifier = Modifier.weight(1f))
                                SmallPill(partner?.str("status", "active") ?: "active",
                                    Palette.green.copy(alpha = .12f), Palette.green)
                            }
                            Spacer(Modifier.height(14.dp))
                            Text(tr(state.lang, "Your partner code", "کد همکاری شما"),
                                fontSize = 11.sp, color = Color(0xFFA9BDC6))
                            Text(partner?.str("code", "—") ?: "—", fontWeight = FontWeight.Black,
                                fontSize = 28.sp, color = Palette.green)
                            Spacer(Modifier.height(10.dp))
                            if (link.isNotBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(link, modifier = Modifier.weight(1f),
                                        color = Color(0xFFBED1D7), maxLines = 1,
                                        overflow = TextOverflow.Ellipsis, fontSize = 11.sp)
                                    IconButton(onClick = {
                                        clipboard.setText(AnnotatedString(link))
                                    }) {
                                        Icon(Icons.Default.ContentCopy, "Copy referral link",
                                            tint = Palette.green)
                                    }
                                }
                            }
                        }
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
                                    codeInput.matches(Regex("[A-Z0-9]{4,8}")),
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
                item(key = "native-affiliate-operations") {
                    AffiliateOperations(state, model, partner?.str("currency", "USD") ?: "USD")
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
            Text(value, color = tint, fontSize = 24.sp, fontWeight = FontWeight.Black)
        }
    }
}
