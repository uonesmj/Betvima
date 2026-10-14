package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.launch

@Composable
fun FeaturePage(state: AppState, model: AppViewModel) {
    val title = when (state.feature) {
        Feature.PROFILE -> tr(state.lang, "Your profile", "پروفایل کاربری")
        Feature.BONUSES -> tr(state.lang, "My Bonuses", "بونوس‌های من")
        Feature.VIP -> tr(state.lang, "VIP Club", "باشگاه VIP")
        Feature.SUPPORT -> tr(state.lang, "24/7 Support", "پشتیبانی ۲۴ ساعته")
        Feature.CASINO -> tr(state.lang, "Casino", "کازینو")
        Feature.AFFILIATE -> tr(state.lang, "Affiliate", "همکاری در فروش")
        Feature.NOTIFICATIONS -> tr(state.lang, "Notifications", "اعلان‌ها")
        else -> "BetVima"
    }
    Column {
        Surface(color = Color.White, shadowElevation = 1.dp) {
            Row(Modifier.fillMaxWidth().heightIn(min = 54.dp)
                .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { model.feature(Feature.NONE) }) {
                    Icon(Icons.Default.ArrowBack,
                        tr(state.lang, "Back", "بازگشت"), tint = Palette.text)
                }
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.Black,
                    color = Palette.text, modifier = Modifier.weight(1f))
                Surface(color = Palette.greenLight, shape = RoundedCornerShape(10.dp)) {
                    Icon(Icons.Default.VerifiedUser, null, tint = Palette.ink,
                        modifier = Modifier.padding(8.dp).size(19.dp))
                }
            }
        }
        when (state.feature) {
            Feature.PROFILE -> ProfilePage(state, model)
            Feature.VIP -> VipPage(state)
            Feature.BONUSES -> BonusPage(state, model)
            Feature.SUPPORT -> SupportPage(state, model)
            Feature.CASINO -> CasinoLobby(state.lang)
            Feature.AFFILIATE -> AffiliateDashboard(state, model)
            Feature.NOTIFICATIONS -> NotificationsPage(state, model)
            else -> Unit
        }
    }
}

@Composable
private fun VipPage(state: AppState) {
    val tiers = listOf(2000 to 3, 4000 to 5, 6000 to 6, 9000 to 8, 15000 to 11)
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "VIP CLUB", "باشگاه VIP"),
                title = tr(state.lang, "Loyalty has its rewards", "وفاداری شما ارزشمند است"),
                subtitle = tr(state.lang,
                    "Discover the weekly deposit tiers and eligible cashback percentages.",
                    "سطح‌های واریز هفتگی و درصد کش‌بک مربوط به هر سطح را بشناسید."),
                icon = Icons.Default.WorkspacePremium,
                accent = Palette.gold
            ) {
                Spacer(Modifier.height(5.dp))
                SmallPill(tr(state.lang, "Monday review", "بررسی روز دوشنبه"),
                    Palette.gold.copy(alpha = .17f), Palette.gold)
            }
        }
        item { SectionHeading(tr(state.lang, "Weekly cashback tiers", "سطوح کش‌بک هفتگی")) }
        items(tiers) { (deposit, percent) ->
            Surface(color = Color.White, shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Palette.border)) {
                Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Palette.greenLight, shape = RoundedCornerShape(12.dp)) {
                        Text(percent.toString() + "%", color = Palette.ink, fontSize = 24.sp,
                            fontWeight = FontWeight.Black, modifier = Modifier.padding(12.dp))
                    }
                    Spacer(Modifier.width(15.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(state.lang, "Weekly deposits", "واریز هفتگی"), color = Palette.muted, fontSize = 10.sp)
                        Text(if (deposit == 15000) "$15,000+" else "$" + "%,d".format(deposit),
                            color = Palette.text, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Text(tr(state.lang, "Of eligible weekly net losses", "از خالص باخت واجد شرایط هفتگی"),
                            color = Palette.muted, fontSize = 10.sp)
                    }
                }
            }
        }
        item {
            Text(tr(state.lang,
                "Cashback is subject to the site's eligibility rules and verified server-side payout engine. This screen does not authorize or execute credits.",
                "پرداخت کش‌بک تابع شرایط سایت و موتور پرداخت تأییدشده در سرور است. این صفحه هیچ مبلغی را تأیید یا واریز نمی‌کند."),
                fontSize = 11.sp, color = Palette.muted, modifier = Modifier.padding(8.dp))
        }
    }
}

@Composable
private fun BonusPage(state: AppState, model: AppViewModel) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "REWARDS", "پاداش‌ها"),
                title = tr(state.lang, "Your bonuses", "پاداش‌های حساب شما"),
                subtitle = tr(state.lang,
                    "Every shown grant and balance comes from the BetVima server.",
                    "همه بونوس‌ها و مانده‌ها مستقیماً از سرور بت‌ویما نمایش داده می‌شوند."),
                icon = Icons.Default.CardGiftcard,
                accent = Palette.gold
            )
        }
        item { SectionHeading(tr(state.lang, "Deposit rewards", "پاداش واریز"),
            tr(state.lang, "Your account's current bonus grants", "بونوس‌های ثبت‌شده حساب شما")) }
        if (!state.signedIn) item {
            LockedFeature(state.lang, tr(state.lang, "Sign in to view your rewards",
                "برای مشاهده پاداش‌ها وارد شوید")) { model.showLogin(true) }
        } else {
            if (state.bonuses.isEmpty()) item {
                EmptyPanel(tr(state.lang, "No bonuses available", "بونوسی موجود نیست"),
                    tr(state.lang, "Rewards will appear here after server issuance.",
                        "بونوس‌ها پس از صدور توسط سرور اینجا نمایش داده می‌شوند.")) { model.refreshAccount() }
            }
            items(state.bonuses) { bonus ->
                Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
                    border = BorderStroke(1.dp, Palette.border), shadowElevation = 1.dp) {
                    Column(Modifier.fillMaxWidth().padding(19.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = Palette.greenLight, shape = RoundedCornerShape(11.dp)) {
                                Icon(Icons.Default.CardGiftcard, null, tint = Palette.ink,
                                    modifier = Modifier.padding(10.dp).size(21.dp))
                            }
                            Spacer(Modifier.width(9.dp))
                            Text(bonus.title, color = Palette.text, fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f))
                            SmallPill(bonus.status, Palette.greenLight, Palette.ink)
                        }
                        Spacer(Modifier.height(20.dp))
                        HorizontalDivider(color = Palette.border)
                        Spacer(Modifier.height(10.dp))
                        Text(tr(state.lang, "Remaining bonus", "مانده بونوس"),
                            color = Palette.muted, fontSize = 11.sp)
                        Text(money(bonus.remainingMinor, bonus.currency),
                            color = Palette.blue, fontWeight = FontWeight.Black, fontSize = 24.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SupportPage(state: AppState, model: AppViewModel) {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    var tickets by remember { mutableStateOf<List<SupportTicket>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var busy by remember { mutableStateOf(false) }
    var selectedTicket by remember { mutableStateOf<SupportTicket?>(null) }

    suspend fun reload() {
        try {
            val token = vault.accessToken(api) ?: return
            tickets = api.tickets(token)
        } catch (ex: Exception) { error = ex.message ?: "Support unavailable" }
    }
    LaunchedEffect(state.signedIn) { if (state.signedIn) reload() }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            BvPageBanner(
                eyebrow = tr(state.lang, "HELP CENTER", "مرکز پشتیبانی"),
                title = tr(state.lang, "We're here to help", "همیشه در کنار شما"),
                subtitle = tr(state.lang,
                    "Create a ticket, follow its status and continue the conversation.",
                    "درخواست ثبت کنید، وضعیت را ببینید و گفتگو را ادامه دهید."),
                icon = Icons.Default.SupportAgent, accent = Palette.green
            )
        }
        item { SectionHeading(tr(state.lang, "Customer support", "پشتیبانی مشتریان"),
            tr(state.lang, "Create a ticket and track replies", "ثبت درخواست و پیگیری پاسخ")) }
        if (!state.signedIn) item {
            LockedFeature(state.lang, tr(state.lang, "Please sign in to contact support",
                "برای ارتباط با پشتیبانی وارد شوید")) { model.showLogin(true) }
        } else {
            item {
                Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
                    border = BorderStroke(1.dp, Palette.border)) {
                    Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(tr(state.lang, "New support ticket", "درخواست پشتیبانی جدید"),
                            fontWeight = FontWeight.Black, fontSize = 15.sp)
                        OutlinedTextField(subject, { subject = it.take(160) },
                            label = { Text(tr(state.lang, "Subject", "موضوع")) },
                            modifier = Modifier.fillMaxWidth(), singleLine = true)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("general", "deposit", "withdrawal", "bet").forEach { c ->
                                FilterChip(selected = category == c, onClick = { category = c },
                                    label = { Text(if (state.lang == Lang.FA) when(c) {
                                        "general" -> "عمومی"
                                        "deposit" -> "واریز"
                                        "withdrawal" -> "برداشت"
                                        "bet" -> "شرط"
                                        else -> c
                                    } else c, fontSize = 10.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Palette.greenLight))
                            }
                        }
                        OutlinedTextField(body, { body = it.take(5000) },
                            label = { Text(tr(state.lang, "Message", "پیام")) },
                            minLines = 3, maxLines = 6, modifier = Modifier.fillMaxWidth())
                        Button(enabled = !busy && subject.trim().length >= 3 && body.isNotBlank(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
                            onClick = {
                                scope.launch {
                                    busy = true
                                    try {
                                        val token = vault.accessToken(api)
                                            ?: throw IllegalStateException("Sign in required")
                                        api.createTicket(token, category, subject.trim(), body.trim())
                                        subject = ""; body = ""; error = null
                                        reload()
                                    } catch (ex: Exception) { error = ex.message }
                                    finally { busy = false }
                                }
                            }) {
                            Text(tr(state.lang, "Send ticket", "ارسال درخواست"), color = Palette.ink)
                        }
                    }
                }
            }
            if (error != null) item { Text(error.orEmpty(), color = Palette.red) }
            item { SectionHeading(tr(state.lang, "Your tickets", "درخواست‌های شما")) }
            if (tickets.isEmpty()) item {
                EmptyPanel(tr(state.lang, "No support tickets", "درخواستی ثبت نشده"),
                    tr(state.lang, "Created tickets will appear here.",
                        "درخواست‌های ثبت‌شده در اینجا نمایش داده می‌شوند.")) { scope.launch { reload() } }
            }
            items(tickets, key = { it.id }) { ticket ->
                Surface(modifier = Modifier.fillMaxWidth().clickable { selectedTicket = ticket },
                    color = Color.White, shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Palette.border)) {
                    Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.SupportAgent, null, tint = Palette.blue)
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(ticket.subject, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(ticket.category, color = Palette.muted, fontSize = 10.sp)
                        }
                        SmallPill(ticket.status.replace("_", " "), Palette.greenLight, Palette.ink)
                    }
                }
            }
        }
    }
    selectedTicket?.let { ticket ->
        TicketThreadSheet(ticket, state.lang) { selectedTicket = null }
    }
}

@Composable
private fun AffiliatePage(state: AppState) {
    val uri = LocalUriHandler.current
    Column(Modifier.verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Surface(color = Palette.ink, shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(22.dp)) {
                Icon(Icons.Default.Groups, null, tint = Palette.green, modifier = Modifier.size(34.dp))
                Text(tr(state.lang, "BetVima Partners", "همکاران بت‌ویما"), color = Color.White,
                    fontSize = 23.sp, fontWeight = FontWeight.Black)
                Text(tr(state.lang, "Referral links, codes, commissions and payout statements.",
                    "لینک‌ها و کدهای معرفی، کمیسیون و گزارش پرداخت‌ها."),
                    color = Color(0xFFACC3C8), fontSize = 12.sp)
            }
        }
        Text(tr(state.lang,
            "Partner onboarding remains protected by the existing web authentication flow.",
            "ثبت‌نام همکاران فعلاً از طریق مسیر احراز هویت امن سایت انجام می‌شود."),
            color = Palette.muted, fontSize = 12.sp)
        Button(onClick = { uri.openUri("https://betvima.com/affiliate") },
            colors = ButtonDefaults.buttonColors(containerColor = Palette.green),
            modifier = Modifier.fillMaxWidth()) {
            Text(tr(state.lang, "Open partner portal", "ورود به پنل همکاران"), color = Palette.ink)
        }
    }
}

@Composable
private fun SimpleFeaturePage(title: String, detail: String, lang: Lang) {
    Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(60.dp))
        Icon(Icons.Default.Shield, null, tint = Palette.blue, modifier = Modifier.size(52.dp))
        Spacer(Modifier.height(16.dp))
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(12.dp))
        Text(detail, textAlign = TextAlign.Center, fontSize = 13.sp,
            lineHeight = 21.sp, color = Palette.muted)
        ResponsibleNote(lang)
    }
}
