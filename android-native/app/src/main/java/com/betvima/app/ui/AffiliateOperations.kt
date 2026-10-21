package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import com.betvima.app.data.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID
import java.time.LocalDate
import java.time.ZoneId
import java.net.URLEncoder

/** Mirrors the native site's authenticated partner reporting, without invented financial figures. */
@Composable
fun AffiliateOperations(state: AppState, model: AppViewModel, currency: String,
    minimumPayoutMinor: String = "0",
    requestedTab: String = "referrals",
    navigationRevision: Int = 0,
    showNavigation: Boolean = true,
    reportTimezone: String = "Asia/Tehran") {
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context, "affiliate") }
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val tabs = listOf(
        "referrals" to tr(state.lang, "Referrals", "زیرمجموعه‌ها"),
        "ledger" to tr(state.lang, "Ledger", "گردش کمیسیون"),
        "payouts" to tr(state.lang, "Payouts", "برداشت‌ها"),
        "links" to tr(state.lang, "Links", "لینک‌ها"),
        "wallets" to tr(state.lang, "Wallets", "کیف‌پول‌ها")
    )
    var selected by rememberSaveable(requestedTab) { mutableStateOf(requestedTab) }
    var page by rememberSaveable { mutableIntStateOf(1) }
    var refresh by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var data by remember { mutableStateOf<JSONObject?>(null) }
    var more by remember { mutableStateOf(false) }
    var values by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var actionBusy by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var campaign by rememberSaveable { mutableStateOf("") }
    var walletAsset by rememberSaveable { mutableStateOf("USDT_TRC20") }
    var walletAddress by rememberSaveable { mutableStateOf("") }
    var payoutAsset by rememberSaveable { mutableStateOf("USDT_TRC20") }
    var payoutAmount by rememberSaveable { mutableStateOf("") }
    var payoutConfirm by remember { mutableStateOf(false) }
    var availableWalletAssets by remember { mutableStateOf<Set<String>>(emptySet()) }
    var payoutKey by remember { mutableStateOf(UUID.randomUUID().toString()) }
    var referralRange by rememberSaveable { mutableStateOf("7D") }
    var ledgerType by rememberSaveable { mutableStateOf("") }
    var customFrom by rememberSaveable { mutableStateOf("") }
    var customTo by rememberSaveable { mutableStateOf("") }
    var registeredOnly by rememberSaveable { mutableStateOf(false) }
    val zone = remember(reportTimezone) {
        runCatching { ZoneId.of(reportTimezone) }.getOrDefault(ZoneId.of("Asia/Tehran"))
    }
    val reportToday = LocalDate.now(zone)
    val reportStart = when(referralRange) {
        "1D" -> affiliatePresetStart159(1,reportToday).toString()
        "7D" -> affiliatePresetStart159(7,reportToday).toString()
        "30D" -> affiliatePresetStart159(30,reportToday).toString()
        "90D" -> affiliatePresetStart159(90,reportToday).toString()
        "180D" -> affiliatePresetStart159(180,reportToday).toString()
        "365D" -> affiliatePresetStart159(365,reportToday).toString()
        "CUSTOM" -> customFrom.ifBlank { affiliatePresetStart159(7,reportToday).toString() }
        else -> affiliatePresetStart159(7,reportToday).toString()
    }
    val reportEnd = if(referralRange=="CUSTOM") customTo.ifBlank {
        reportToday.toString()
    } else reportToday.toString()
    val rangeFrom = runCatching { LocalDate.parse(reportStart) }.getOrDefault(reportToday)
    val rangeTo = runCatching { LocalDate.parse(reportEnd) }.getOrDefault(reportToday)
    val validRange = affiliateRange159(rangeFrom,rangeTo,reportToday)
    val referralDateParams = "&from=" + URLEncoder.encode(reportStart, "UTF-8") +
        "&to=" + URLEncoder.encode(reportEnd, "UTF-8") +
        (if (registeredOnly) "&registeredOnly=true" else "")

    LaunchedEffect(selected, page, refresh, referralDateParams, ledgerType) {
        if (selected in listOf("referrals","ledger") && !validRange) {
            error = tr(state.lang,"Choose a valid 1–365-day range.",
                "بازه معتبر ۱ تا ۳۶۵ روز انتخاب کنید.")
            values=emptyList();data=null;busy=false
            return@LaunchedEffect
        }
        busy = true; error = null
        try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            val path = when (selected) {
                "referrals" -> "/api/v1/affiliate/referrals?pageSize=20&page=" +
                    page + referralDateParams
                "ledger" -> {
                    val from=rangeFrom.atStartOfDay(zone).toInstant().toString()
                    val to=rangeTo.plusDays(1).atStartOfDay(zone).toInstant()
                        .minusNanos(1).toString()
                    "/api/v1/affiliate/ledger?pageSize=20&page=" + page +
                        "&from=" + URLEncoder.encode(from,"UTF-8") +
                        "&to=" + URLEncoder.encode(to,"UTF-8") +
                        (if(ledgerType.isBlank())"" else "&type="+
                            URLEncoder.encode(ledgerType,"UTF-8"))
                }
                "payouts" -> "/api/v1/affiliate/payouts"
                "links" -> "/api/v1/affiliate/links"
                else -> "/api/v1/affiliate/wallets"
            }
            val response = api.get(path, token)
            if (selected == "payouts") {
                // Fail closed if wallet availability cannot be verified server-side.
                availableWalletAssets = emptySet()
                val wallets = api.get("/api/v1/affiliate/wallets", token)
                availableWalletAssets = wallets.arr("items").objects()
                    .map { it.str("asset") }.filter(String::isNotBlank).toSet()
            }
            val source = if (selected == "links") "links" else "items"
            val next = response.arr(source).objects()
            values = if (page == 1) next else (values + next).distinctBy {
                if(selected == "referrals") it.str("userId") else it.str("id",it.str("code"))
            }
            more = selected in setOf("referrals", "ledger") &&
                (response.optBoolean("hasMore", false) ||
                    (next.size == 20 && response.optInt("total", 0) > page * 20))
            data = response
        } catch (ex: Exception) {
            error = ex.message ?: tr(state.lang, "Unable to load partner data", "دریافت اطلاعات همکاری ممکن نشد")
        } finally { busy = false }
    }
    fun switch(tab: String) {
        if (tab != selected) {
            selected = tab; page = 1; values = emptyList(); data = null
            actionError = null; actionMessage = null
        }
    }
    LaunchedEffect(requestedTab, navigationRevision) {
        if (navigationRevision > 0 && tabs.any { it.first == requestedTab }) {
            switch(requestedTab)
        }
    }
    fun runAction(block: suspend (String) -> Unit) {
        scope.launch {
            actionBusy = true
            actionError = null; actionMessage = null
            try {
                val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
                block(token)
                refresh++
            } catch (ex: Exception) {
                actionError = ex.message ?: tr(state.lang, "Unable to save", "ثبت انجام نشد")
            } finally { actionBusy = false }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if(showNavigation) {
        Row(verticalAlignment=Alignment.CenterVertically,
            modifier=Modifier.fillMaxWidth().padding(top=5.dp)) {
            Surface(color=affiliateBlue.copy(alpha=.12f),shape=RoundedCornerShape(13.dp)) {
                Icon(Icons.Default.GridView,null,tint=affiliateBlue,
                    modifier=Modifier.padding(11.dp).size(22.dp))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(tr(state.lang,"Partner workspace","فضای کاری افیلیت"),
                    color=affiliateInk,fontSize=18.sp,fontWeight=FontWeight.Black)
                Text(tr(state.lang,"Your operational tools","ابزارهای مدیریت حساب"),
                    color=Palette.muted,fontSize=11.sp)
            }
        }
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding=PaddingValues(vertical=3.dp)
        ) {
            items(tabs, key = { it.first }) { tab ->
                val active = tab.first == selected
                val typeIcon = when(tab.first) {
                    "referrals" -> Icons.Default.Groups
                    "ledger" -> Icons.Default.ReceiptLong
                    "payouts" -> Icons.Default.Payments
                    "links" -> Icons.Default.Link
                    else -> Icons.Default.AccountBalanceWallet
                }
                Surface(shape = RoundedCornerShape(15.dp),
                    color = if(active) affiliateBlue else Color.White,
                    border = BorderStroke(1.dp,if(active) affiliateBlue else affiliateOutline),
                    shadowElevation=if(active)2.dp else 0.dp,
                    modifier = Modifier.clickable(enabled=!actionBusy) { switch(tab.first) }) {
                    Row(Modifier.padding(horizontal=13.dp,vertical=13.dp),
                        verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        Icon(typeIcon,null,
                            tint=if(active)Color.White else affiliatePink,
                            modifier=Modifier.size(17.dp))
                        Text(tab.second,
                            color=if(active)Color.White else affiliateInk,
                            fontSize=12.sp,fontWeight=FontWeight.Black)
                    }
                }
            }
        }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
        if (error != null) BvInformationStrip(error.orEmpty(), Icons.Default.WarningAmber,
            accent = Palette.red)
        if (selected == "referrals" && error != null) {
            OutlinedButton(onClick={refresh++},modifier=Modifier.fillMaxWidth(),
                border=BorderStroke(1.dp,Palette.green)) {
                Icon(Icons.Default.Refresh,null,modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(state.lang,"Retry loading referrals","تلاش دوباره برای دریافت زیرمجموعه‌ها"))
            }
        }
        if (actionError != null) BvInformationStrip(actionError.orEmpty(),
            Icons.Default.WarningAmber, accent = Palette.red)
        if (actionMessage != null) BvInformationStrip(actionMessage.orEmpty(),
            Icons.Default.CheckCircle, accent = Palette.green)
        if (!busy || values.isNotEmpty()) {
            when(selected) {
                "referrals" -> {
                    FinanceDateFilter159(state.lang,rangeFrom,rangeTo,reportToday,zone,
                        referralRange,
                        onPreset={ choice ->
                            referralRange=choice;page=1;values=emptyList();data=null
                        },
                        onDates={ from,to ->
                            customFrom=from.toString();customTo=to.toString()
                            referralRange="CUSTOM";page=1;values=emptyList();data=null
                        })
                    FinancePanel159(
                        title=tr(state.lang,"Referral reporting","گزارش زیرمجموعه‌ها"),
                        subtitle=tr(state.lang,
                            "Daily registration, deposits, withdrawals and credited commission.",
                            "ثبت‌نام، واریز، برداشت و کمیسیون ثبت‌شده در دوره")
                    ) {
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                            Text(tr(state.lang,"Only sign-ups in selected period",
                                "فقط ثبت‌نام‌های همین دوره"),
                                color=affiliateInk,fontSize=12.sp,
                                modifier=Modifier.weight(1f))
                            Switch(checked=registeredOnly,onCheckedChange={
                                registeredOnly=it;page=1;values=emptyList();data=null
                            })
                        }
                        val counts=data?.optJSONObject("statusCounts")
                        val period=data?.optJSONObject("periodSummary")
                        if(counts!=null) {
                            FinanceSectionRow159(
                                tr(state.lang,"All referred accounts","کل حساب‌های معرفی‌شده"),
                                counts.optInt("total").toString(),Icons.Default.Groups)
                            HorizontalDivider(color=Color(0xFFE0EAE4))
                            FinanceSectionRow159(
                                tr(state.lang,"Confirmed","تأییدشده"),
                                counts.optInt("confirmed").toString(),Icons.Default.Verified)
                            HorizontalDivider(color=Color(0xFFE0EAE4))
                            FinanceSectionRow159(
                                tr(state.lang,"Under review","در حال بررسی"),
                                (counts.optInt("pending")+counts.optInt("review")).toString(),
                                Icons.Default.HourglassTop)
                        }
                        if(period!=null) {
                            HorizontalDivider(color=Color(0xFFE0EAE4))
                            FinanceSectionRow159(
                                tr(state.lang,"Registered in period","ثبت‌نام در بازه"),
                                period.optInt("registrations").toString(),
                                Icons.Default.PersonAdd)
                        }
                    }
                    FinancePanel159(
                        title=tr(state.lang,"Period finance by currency","گزارش مالی دوره برحسب ارز"),
                        subtitle=tr(state.lang,
                            "Account-wide verified transactions, not estimates or page subtotals.",
                            "تراکنش‌های تأییدشده کل زیرمجموعه‌ها، نه برآورد صفحه")
                    ) {
                        val currencies=data?.optJSONObject("periodSummary")
                            ?.arr("byCurrency")?.objects() ?: emptyList()
                        if(currencies.isEmpty()) {
                            Text(tr(state.lang,
                                "No verified deposits, withdrawals or commissions in this period.",
                                "در این بازه واریز، برداشت یا کمیسیونی ثبت نشده است."),
                                fontSize=12.sp,color=Palette.muted)
                        }
                        currencies.forEach { AffiliateReferralPeriodSummary124(it,state.lang) }
                    }
                    FinancePanel159(
                        title=tr(state.lang,"Referred users","کاربران زیرمجموعه"),
                        subtitle=tr(state.lang,
                            "Tap an account for period and lifetime financial details.",
                            "برای مشاهده جزئیات دوره و کل فعالیت روی کاربر بزنید.")
                    ) {
                        if(values.isEmpty() && !busy && error==null)
                            PartnerEmpty(state.lang)
                        values.forEach { row -> FinanceReferralRow159(row,state.lang,zone.id) }
                    }
                }
                "ledger" -> {
                    FinanceDateFilter159(state.lang,rangeFrom,rangeTo,reportToday,zone,
                        referralRange,
                        onPreset={ choice ->
                            referralRange=choice;page=1;values=emptyList();data=null
                        },
                        onDates={ from,to ->
                            customFrom=from.toString();customTo=to.toString()
                            referralRange="CUSTOM";page=1;values=emptyList();data=null
                        })
                    FinancePanel159(
                        title=tr(state.lang,"Commission journal","دفتر کمیسیون"),
                        subtitle=tr(state.lang,
                            "Only posted ledger entries returned by the partner server.",
                            "فقط تراکنش‌های ثبت‌شده در دفتر مالی سرور")
                    ) {
                        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                            listOf(
                                "" to tr(state.lang,"All","همه"),
                                "user_loss_commission" to tr(state.lang,"Earnings","درآمد"),
                                "adjustment" to tr(state.lang,"Adjustments","اصلاحیه"),
                                "carry_forward_release" to tr(state.lang,"Carry forward","انتقال مانده")
                            ).forEach { (code,label) ->
                                FilterChip(selected=ledgerType==code,
                                    onClick={ledgerType=code;page=1;values=emptyList();data=null},
                                    label={Text(label,fontSize=11.sp)},
                                    colors=FilterChipDefaults.filterChipColors(
                                        selectedContainerColor=Color(0xFFD5F2E1),
                                        selectedLabelColor=Color(0xFF147B51)))
                            }
                        }
                        FinanceSectionRow159(
                            tr(state.lang,"Entries in selected period","تراکنش‌های بازه انتخاب‌شده"),
                            data?.optInt("total")?.toString() ?: "—",
                            Icons.Default.ReceiptLong)
                    }
                    FinancePanel159(
                        title=tr(state.lang,"Transaction activity","گردش تراکنش‌ها"),
                        subtitle=tr(state.lang,
                            "Open an entry to view the source, description and reference.",
                            "برای دیدن منبع، توضیح و شناسه تراکنش آن را باز کنید.")
                    ) {
                        if(values.isEmpty() && !busy && error==null)
                            PartnerEmpty(state.lang)
                        values.forEach { row -> FinanceLedgerRow159(row,state.lang,currency) }
                    }
                }
                "payouts" -> {
                    val payable = data?.optJSONObject("payable")
                    val usable = payable?.str("payableMinor")
                    if (usable != null) BvStatCard(
                        tr(state.lang, "Payable commission", "کمیسیون قابل برداشت"),
                        money(usable,currency), Icons.Default.AccountBalanceWallet, Palette.green)
                    if (values.isEmpty()) PartnerEmpty(state.lang)
                    values.forEach { row ->
                        PartnerRow(
                            title = row.str("publicId", row.str("id").take(8)),
                            subtitle = row.str("status") + " · " + row.str("requestedAt").take(10),
                            value = money(row.str("amountMinor", "0"),currency),
                            icon = Icons.Default.Payments
                        )
                    }
                    Surface(color = Color(0xFFF1F7F3), shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0xFFDCE9E0))) {
                        Column(Modifier.fillMaxWidth().padding(15.dp),
                            verticalArrangement = Arrangement.spacedBy(9.dp)) {
                            Text(tr(state.lang,"Request a payout","درخواست برداشت افیلیت"),
                                fontWeight = FontWeight.Black, fontSize = 15.sp)
                            Text(tr(state.lang,
                                "A saved payout wallet is required. Server validates funds, minimums and approval.",
                                "برای برداشت کیف پول ثبت‌شده لازم است. حداقل مبلغ، موجودی و تأیید پرداخت در سرور کنترل می‌شود."),
                                fontSize = 11.sp, color = Palette.muted)
                            PartnerAssetChooser(payoutAsset, state.lang) { payoutAsset = it }
                            OutlinedTextField(value=payoutAmount,
                                onValueChange={ payoutAmount=it.filter { ch ->
                                    ch.isDigit() || ch=='.' }.take(16) },
                                modifier=Modifier.fillMaxWidth(),singleLine=true,
                                label={Text(tr(state.lang,"Amount","مبلغ")+" ("+currency+")")},
                                keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal))
                            val minor = runCatching {
                                val decimals = if (currency in setOf("IRT","IRR")) 0 else 2
                                BigDecimal(payoutAmount).setScale(decimals,RoundingMode.UNNECESSARY)
                                    .movePointRight(decimals).toBigIntegerExact().toString()
                            }.getOrNull()
                            val payable = data?.optJSONObject("payable")?.str("payableMinor")
                                ?.toBigDecimalOrNull()
                            val meetsMinimum = minor?.toBigDecimalOrNull()?.let {
                                it >= (minimumPayoutMinor.toBigDecimalOrNull() ?: BigDecimal.ZERO)
                            } ?: false
                            val validBalance = minor?.toBigDecimalOrNull()?.let {
                                payable != null && it <= payable
                            } ?: false
                            val walletReady = availableWalletAssets.contains(payoutAsset)
                            if (!walletReady) Text(tr(state.lang,
                                "Save a wallet for the chosen network before requesting a payout.",
                                "قبل از برداشت، کیف پول شبکه انتخاب‌شده را ثبت کنید."),
                                color=Palette.red,fontSize=11.sp)
                            if (minimumPayoutMinor != "0") Text(tr(state.lang,
                                "Minimum payout: ","حداقل برداشت: ") +
                                money(minimumPayoutMinor,currency),
                                color=Palette.muted,fontSize=11.sp)
                            Button(onClick={payoutConfirm=true},
                                enabled=!actionBusy && minor!=null && minor.toBigDecimal()>BigDecimal.ZERO &&
                                    meetsMinimum && validBalance && walletReady,
                                modifier=Modifier.fillMaxWidth(),
                                colors=ButtonDefaults.buttonColors(containerColor=Palette.green)) {
                                Text(tr(state.lang,"Review payout request","بررسی درخواست برداشت"),
                                    color=Palette.ink,fontWeight=FontWeight.Bold)
                            }
                            if (payoutConfirm && minor!=null) {
                                AlertDialog(onDismissRequest={payoutConfirm=false},
                                    title={Text(tr(state.lang,"Confirm payout","تأیید درخواست برداشت"))},
                                    text={Text(tr(state.lang,
                                        "Submit payout request for approval? This is not an instant transfer.",
                                        "درخواست برداشت برای بررسی ثبت شود؟ انتقال وجه آنی نیست.") +
                                        "\n" + money(minor,currency) + " · " + payoutAsset)},
                                    confirmButton={
                                        TextButton(onClick={
                                            payoutConfirm=false
                                            runAction { token ->
                                                api.payoutRequest(JSONObject()
                                                    .put("amountMinor",minor)
                                                    .put("method","crypto")
                                                    .put("payoutAsset",payoutAsset), token, payoutKey)
                                                payoutKey=UUID.randomUUID().toString()
                                                actionMessage=tr(state.lang,"Request submitted","درخواست ثبت شد")
                                            }
                                        },enabled=!actionBusy) {
                                            Text(tr(state.lang,"Submit request","ثبت درخواست"))
                                        }
                                    },dismissButton={TextButton(onClick={payoutConfirm=false}) {
                                        Text(tr(state.lang,"Cancel","انصراف"))
                                    }})
                            }
                        }
                    }
                }
                "links" -> {
                    values.forEach { row ->
                        val destination = row.str("url")
                        Column(verticalArrangement=Arrangement.spacedBy(5.dp)) {
                            PartnerRow(
                                title=row.str("campaign",row.str("code")),
                                subtitle=destination,
                                value=row.optInt("clicks").toString()+" "+tr(state.lang,"clicks","کلیک"),
                                icon=Icons.Default.Link
                            )
                            if(destination.startsWith("https://")) {
                                OutlinedButton(onClick={
                                    clipboard.setText(AnnotatedString(destination))
                                    actionMessage=tr(state.lang,"Campaign URL copied","لینک کمپین کپی شد")
                                },modifier=Modifier.fillMaxWidth(),
                                    border=BorderStroke(1.dp,affiliateOutline),
                                    shape=RoundedCornerShape(11.dp)) {
                                    Icon(Icons.Default.ContentCopy,null,
                                        modifier=Modifier.size(16.dp),tint=affiliateBlue)
                                    Spacer(Modifier.width(6.dp))
                                    Text(tr(state.lang,"Copy campaign link","کپی لینک کمپین"),
                                        color=affiliateBlue,fontWeight=FontWeight.Bold)
                                }
                            }
                        }
                    }
                    Surface(color=Color(0xFFF1F7F3),shape=RoundedCornerShape(12.dp),
                        border=BorderStroke(1.dp,Color(0xFFDCE9E0))) {
                        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                            Text(tr(state.lang,"Create a campaign link","ساخت لینک کمپین"),
                                fontWeight=FontWeight.Black)
                            OutlinedTextField(campaign,{campaign=it.take(60)},
                                label={Text(tr(state.lang,"Campaign name","نام کمپین"))},
                                singleLine=true,modifier=Modifier.fillMaxWidth())
                            Button(enabled=!actionBusy && AffiliateInputRules.validCampaign(campaign),
                                onClick={
                                    runAction { token ->
                                        api.post("/api/v1/affiliate/links",
                                            JSONObject().put("campaign",campaign.trim()),token)
                                        campaign=""
                                        actionMessage=tr(state.lang,"Link created","لینک ساخته شد")
                                    }
                                }, colors=ButtonDefaults.buttonColors(containerColor=Palette.green)) {
                                Text(tr(state.lang,"Create link","ساخت لینک"),color=Palette.ink)
                            }
                        }
                    }
                }
                "wallets" -> {
                    values.forEach { row ->
                        PartnerRow(
                            title = row.str("asset"),
                            subtitle = if (row.optBoolean("addressHidden"))
                                tr(state.lang, "Address hidden for security", "آدرس برای امنیت مخفی است")
                            else row.str("addressMasked", "—"),
                            value = tr(state.lang, "Saved", "ثبت‌شده"),
                            icon = Icons.Default.AccountBalanceWallet
                        )
                    }
                    Surface(color=Color(0xFFF1F7F3),shape=RoundedCornerShape(12.dp),
                        border=BorderStroke(1.dp,Color(0xFFDCE9E0))) {
                        Column(Modifier.padding(15.dp),
                            verticalArrangement=Arrangement.spacedBy(9.dp)) {
                            Text(tr(state.lang,"Save payout wallet","ثبت کیف پول برداشت"),
                                fontWeight=FontWeight.Black)
                            PartnerAssetChooser(walletAsset,state.lang) { walletAsset=it }
                            OutlinedTextField(walletAddress,{walletAddress=it.trim().take(128)},
                                label={Text(tr(state.lang,"Wallet address","آدرس کیف پول"))},
                                modifier=Modifier.fillMaxWidth(),singleLine=true)
                            val regex=if(walletAsset=="DOGE")
                                Regex("^D[1-9A-HJ-NP-Za-km-z]{33}$")
                                else Regex("^T[1-9A-HJ-NP-Za-km-z]{33}$")
                            Text(tr(state.lang,
                                "Verify the network before saving. An incorrect address may cause loss of funds.",
                                "شبکه را قبل از ثبت بررسی کنید. آدرس اشتباه می‌تواند باعث از دست رفتن وجه شود."),
                                color=Palette.red,fontSize=11.sp)
                            Button(onClick={
                                runAction { token ->
                                    api.post("/api/v1/affiliate/wallets",
                                        JSONObject().put("asset",walletAsset)
                                            .put("address",walletAddress), token)
                                    walletAddress=""
                                    actionMessage=tr(state.lang,"Wallet saved","کیف پول ثبت شد")
                                }
                            }, enabled=!actionBusy && regex.matches(walletAddress),
                                colors=ButtonDefaults.buttonColors(containerColor=Palette.green)) {
                                Text(tr(state.lang,"Save wallet","ثبت کیف پول"),color=Palette.ink)
                            }
                        }
                    }
                }
            }
        }
        if (more && !busy) OutlinedButton(onClick={page++},
            modifier=Modifier.fillMaxWidth()) {
            Text(tr(state.lang,"Load more","بیشتر"),color=Palette.blue)
        }
        TextButton(onClick={refresh++},enabled=!busy) {
            Icon(Icons.Default.Refresh,null,tint=Palette.blue)
            Spacer(Modifier.width(5.dp))
            Text(tr(state.lang,"Refresh partner data","تازه‌سازی اطلاعات افیلیت"),
                color=Palette.blue)
        }
    }
}

@Composable
private fun PartnerEmpty(lang: Lang) {
    Column(Modifier.fillMaxWidth()
        .background(Color(0xFFF5F8F6),RoundedCornerShape(12.dp))
        .padding(20.dp),
        verticalArrangement=Arrangement.spacedBy(7.dp),
        horizontalAlignment=Alignment.CenterHorizontally) {
        Icon(Icons.Default.Inbox,null,tint=Color(0xFF799487),
            modifier=Modifier.size(24.dp))
        Text(tr(lang,"No verified entries in this period",
            "در این بازه تراکنش تأییدشده‌ای موجود نیست"),
            color=Color(0xFF65796C),fontWeight=FontWeight.Medium,
            fontSize=12.sp)
        Text(tr(lang,"Try another date range or refresh your partner data.",
            "بازه زمانی دیگری را بررسی یا اطلاعات حساب را تازه‌سازی کنید."),
            color=Color(0xFF809287),fontSize=10.sp)
    }
}

@Composable
private fun PartnerAssetChooser(
    selected: String,lang: Lang,onChange: (String)->Unit
) {
    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
        listOf("USDT_TRC20","TRX","DOGE").forEach { asset ->
            val selectedNow=selected==asset
            Surface(shape=RoundedCornerShape(10.dp),
                color=if(selectedNow) Palette.ink else Palette.paper,
                modifier=Modifier.clickable { onChange(asset) }) {
                Text(asset,color=if(selectedNow) Color.White else Palette.text,
                    fontSize=10.sp,fontWeight=FontWeight.Bold,
                    modifier=Modifier.padding(horizontal=9.dp,vertical=12.dp))
            }
        }
    }
}

@Composable
private fun PartnerRow(
    title:String, subtitle:String, value:String,
    icon:androidx.compose.ui.graphics.vector.ImageVector
) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(vertical=12.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Surface(color=Color(0xFFE6F6EC),shape=RoundedCornerShape(11.dp)) {
                Icon(icon,null,tint=Color(0xFF13794C),
                    modifier=Modifier.padding(10.dp).size(18.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title,color=Color(0xFF14261C),fontSize=12.sp,
                    fontWeight=FontWeight.Bold,maxLines=2,
                    overflow=TextOverflow.Ellipsis)
                Text(subtitle,color=Color(0xFF73827A),fontSize=10.sp,
                    maxLines=2,overflow=TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(7.dp))
            Text(value,color=Color(0xFF147C55),fontWeight=FontWeight.Black,
                fontSize=11.sp,maxLines=2)
        }
        HorizontalDivider(color=Color(0xFFE0EAE4))
    }
}
