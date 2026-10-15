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

/** Mirrors the native site's authenticated partner reporting, without invented financial figures. */
@Composable
fun AffiliateOperations(state: AppState, model: AppViewModel, currency: String,
    minimumPayoutMinor: String = "0") {
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
    var selected by rememberSaveable { mutableStateOf("referrals") }
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

    LaunchedEffect(selected, page, refresh) {
        busy = true; error = null
        try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            val path = when (selected) {
                "referrals" -> "/api/v1/affiliate/referrals?pageSize=20&page=" + page
                "ledger" -> "/api/v1/affiliate/ledger?pageSize=20&page=" + page
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
            values = if (page == 1) next else (values + next).distinctBy { it.str("id", it.str("code")) }
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
        SectionHeading(tr(state.lang, "Partner workspace", "فضای کاری افیلیت"),
            tr(state.lang, "Secure referrals, statements and payout actions", "زیرمجموعه‌ها، صورتحساب و درخواست برداشت امن"))
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
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Palette.green)
        if (error != null) BvInformationStrip(error.orEmpty(), Icons.Default.WarningAmber,
            accent = Palette.red)
        if (actionError != null) BvInformationStrip(actionError.orEmpty(),
            Icons.Default.WarningAmber, accent = Palette.red)
        if (actionMessage != null) BvInformationStrip(actionMessage.orEmpty(),
            Icons.Default.CheckCircle, accent = Palette.green)
        if (!busy || values.isNotEmpty()) {
            when(selected) {
                "referrals" -> {
                    if (values.isEmpty()) PartnerEmpty(state.lang)
                    values.forEach { row ->
                        PartnerRow(
                            title = row.str("code", row.str("userId").take(10)),
                            subtitle = tr(state.lang, "Status", "وضعیت") + ": " +
                                row.str("status", "—"),
                            value = row.str("wageredMinor").takeIf { it.isNotBlank() }
                                ?.let { money(it, currency) } ?: "—",
                            icon = Icons.Default.Groups
                        )
                    }
                }
                "ledger" -> {
                    if (values.isEmpty()) PartnerEmpty(state.lang)
                    values.forEach { row ->
                        PartnerRow(
                            title = row.str("type").replace("_", " "),
                            subtitle = row.str("createdAt").take(16).replace("T", " · "),
                            value = row.str("amountMinor").takeIf { it.isNotBlank() }
                                ?.let { money(it, currency) } ?: "—",
                            icon = Icons.Default.ReceiptLong
                        )
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
                    Surface(color = Color.White, shape = RoundedCornerShape(19.dp),
                        border = BorderStroke(1.dp, Palette.border)) {
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
                    Surface(color=Color.White,shape=RoundedCornerShape(18.dp),
                        border=BorderStroke(1.dp,Palette.border)) {
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
                    Surface(color=Color.White,shape=RoundedCornerShape(19.dp),
                        border=BorderStroke(1.dp,Palette.border)) {
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
    Text(tr(lang,"No records returned by your partner account.",
        "هنوز رکوردی برای این بخش در حساب همکار ثبت نشده است."),
        color=Palette.muted,fontSize=12.sp,modifier=Modifier.padding(12.dp))
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
private fun PartnerRow(title:String,subtitle:String,value:String,
    icon:androidx.compose.ui.graphics.vector.ImageVector) {
    Surface(color=Color.White,shape=RoundedCornerShape(17.dp),
        border=BorderStroke(1.dp,Palette.border),shadowElevation=1.dp) {
        Row(Modifier.fillMaxWidth().padding(13.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Surface(color=Palette.greenLight,shape=RoundedCornerShape(11.dp)) {
                Icon(icon,null,tint=Palette.blue,
                    modifier=Modifier.padding(9.dp).size(19.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title,color=Palette.text,fontSize=12.sp,
                    fontWeight=FontWeight.Black,maxLines=1,overflow=TextOverflow.Ellipsis)
                Text(subtitle,color=Palette.muted,fontSize=10.sp,
                    maxLines=2,overflow=TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(7.dp))
            Text(value,color=Palette.blue,fontWeight=FontWeight.Bold,
                fontSize=11.sp,maxLines=2)
        }
    }
}
