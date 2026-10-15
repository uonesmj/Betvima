package com.betvima.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant

private val deep = Color(0xFF0D202B)
private val accent = Color(0xFF00D47A)
private val blue = Color(0xFF087FF5)
private val ink = Color(0xFF1A2A34)
private val muted = Color(0xFF70848D)
private val outline = Color(0xFFDDE6E7)
private val surface = Color(0xFFF2F5F5)

internal fun bonusStatusLabel(status: String, lang: Lang): String = when (status) {
    "active" -> tr(lang, "Available", "آماده استفاده")
    "locked" -> tr(lang, "In use", "در حال استفاده")
    "won" -> tr(lang, "Won", "برنده")
    "lost" -> tr(lang, "Lost", "بازنده")
    "expired" -> tr(lang, "Expired", "منقضی‌شده")
    "cancelled" -> tr(lang, "Cancelled", "لغوشده")
    else -> tr(lang, "Under review", "در حال بررسی")
}
private fun bonusStatusColor(status: String): Color = when (status) {
    "active" -> Color(0xFF008855)
    "locked" -> Color(0xFFB77719)
    "won" -> blue
    "lost" -> Color(0xFFC44D61)
    else -> Color(0xFF7C8A96)
}
private fun bonusFlag(code: String): String = if (code == "USD") "🇺🇸" else "🇮🇷"
private fun bonusDate(iso: String): String =
    runCatching { Instant.parse(iso).toString().take(16).replace('T',' ') }
        .getOrDefault(iso.take(16))

@Composable private fun StatusLabel(status: String, lang: Lang) {
    val color = bonusStatusColor(status)
    Surface(color = color.copy(alpha = .10f),
        border = BorderStroke(1.dp,color.copy(alpha = .2f)),
        shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal=8.dp, vertical=6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(5.dp))
            Text(bonusStatusLabel(status,lang),color=color,
                fontSize=10.sp,fontWeight=FontWeight.Bold,maxLines=1)
        }
    }
}

@Composable private fun BonusHero(lang: Lang, campaign: BonusPromotion?,
    onWallet: () -> Unit, onRules: () -> Unit) {
    val percentage = if (campaign == null) "100"
        else if (campaign.active) (campaign.percentageBps / 100).toString()
        else "—"
    Surface(shape=RoundedCornerShape(27.dp),color=deep,shadowElevation=6.dp) {
        Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(
            Color(0xFF071922),Color(0xFF102B2B),Color(0xFF0D263F))))) {
            Box(Modifier.align(Alignment.TopEnd).offset(x=67.dp,y=(-79).dp)
                .size(220.dp).clip(CircleShape).background(accent.copy(alpha=.09f)))
            Box(Modifier.align(Alignment.BottomStart).offset(x=(-60).dp,y=85.dp)
                .size(160.dp).clip(CircleShape).background(blue.copy(alpha=.08f)))
            Column(Modifier.fillMaxWidth().padding(19.dp),
                verticalArrangement=Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Surface(color=accent.copy(alpha=.12f),shape=RoundedCornerShape(50),
                        border=BorderStroke(1.dp,accent.copy(alpha=.3f))) {
                        Row(Modifier.padding(horizontal=11.dp,vertical=7.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.AutoAwesome,null,tint=accent,
                                modifier=Modifier.size(15.dp))
                            Spacer(Modifier.width(7.dp))
                            Text("BETVIMA REWARDS",color=Color(0xFFC6FFE3),
                                fontSize=10.sp,fontWeight=FontWeight.Black)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Default.Shield,null,tint=accent,
                        modifier=Modifier.size(23.dp))
                }
                Text(tr(lang,"More value. Every deposit.","ارزش بیشتر، با هر واریز."),
                    color=Color.White,fontSize=23.sp,
                    fontWeight=FontWeight.Black,lineHeight=30.sp)
                Row(verticalAlignment=Alignment.Bottom) {
                    Text(percentage,color=Color.White,fontWeight=FontWeight.Black,
                        fontSize=76.sp,lineHeight=78.sp)
                    Text("%",color=accent,fontSize=45.sp,
                        fontWeight=FontWeight.Black,
                        modifier=Modifier.padding(bottom=7.dp))
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Default.CardGiftcard,null,tint=accent,
                        modifier=Modifier.size(37.dp))
                }
                Text(if (campaign != null && !campaign.active)
                    tr(lang,"This campaign is currently unavailable.",
                        "این طرح در حال حاضر غیرفعال است.")
                    else tr(lang,
                        "Each eligible successful deposit can receive a matching reward. Issuance and eligibility are determined by the server.",
                        "هر واریز موفق واجد شرایط می‌تواند بونوس معادل داشته باشد؛ صدور و احراز شرایط در سرور انجام می‌شود."),
                    color=Color(0xFFB9CDD0),fontSize=12.sp,lineHeight=20.sp)
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    Button(onClick=onWallet,
                        modifier=Modifier.weight(1f).height(47.dp),
                        shape=RoundedCornerShape(13.dp),
                        colors=ButtonDefaults.buttonColors(
                            containerColor=accent,contentColor=deep)) {
                        Icon(Icons.Default.AccountBalanceWallet,null,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(lang,"Wallet","کیف پول"),
                            fontSize=12.sp,fontWeight=FontWeight.Black)
                    }
                    OutlinedButton(onClick=onRules,
                        modifier=Modifier.weight(1f).height(47.dp),
                        shape=RoundedCornerShape(13.dp),
                        border=BorderStroke(1.dp,Color(0xFF43615A))) {
                        Icon(Icons.Default.Rule,null,tint=Color.White,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(7.dp))
                        Text(tr(lang,"Rules","شرایط"),
                            color=Color.White,fontWeight=FontWeight.Bold,
                            fontSize=12.sp)
                    }
                }
                Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                    listOf(
                        Triple("24h",tr(lang,"Validity","اعتبار"),Icons.Default.Schedule),
                        Triple("04",tr(lang,"Selections","انتخاب"),Icons.Default.Layers),
                        Triple("1.60+",tr(lang,"Each odds","ضریب هرکدام"),Icons.Default.TrendingUp)
                    ).forEach { (number,label,icon) ->
                        Surface(color=Color.White.copy(alpha=.07f),
                            border=BorderStroke(1.dp,Color.White.copy(alpha=.1f)),
                            shape=RoundedCornerShape(13.dp),
                            modifier=Modifier.weight(1f)) {
                            Column(Modifier.padding(10.dp),
                                verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                Icon(icon,null,tint=accent,
                                    modifier=Modifier.size(17.dp))
                                Text(number,color=Color.White,
                                    fontWeight=FontWeight.Black,fontSize=17.sp)
                                Text(label,color=Color(0xFFB7C8C8),
                                    fontSize=9.sp,maxLines=1)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun StatCard(label: String, value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color,
    modifier: Modifier=Modifier) {
    Surface(shape=RoundedCornerShape(17.dp),color=Color.White,
        border=BorderStroke(1.dp,outline),modifier=modifier) {
        Column(Modifier.padding(11.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Icon(icon,null,tint=tint,modifier=Modifier.size(20.dp))
            Text(value,color=ink,fontWeight=FontWeight.Black,
                fontSize=15.sp,maxLines=1,overflow=TextOverflow.Ellipsis)
            Text(label,color=muted,fontSize=10.sp,
                maxLines=1,overflow=TextOverflow.Ellipsis)
        }
    }
}

@Composable private fun RewardCard(item: BonusReward, lang: Lang, now: Long,
    onDetail: () -> Unit, onMatches: () -> Unit) {
    val left=bonusMillisecondsLeft(item.expiresAt,now)
    val urgent=left in 1..(6L*3600*1000)
    val original=item.amountMinor.toBigDecimalOrNull()
    val available=item.remainingMinor.toBigDecimalOrNull()
    val fraction=if(original != null && original.signum()>0 && available!=null)
        (available.toDouble()/original.toDouble()).coerceIn(0.0,1.0).toFloat()
    else 0f
    Surface(color=Color(0xFF0D242B),shape=RoundedCornerShape(22.dp),
        border=BorderStroke(1.dp,Color(0xFF31524B)),
        shadowElevation=2.dp) {
        Column(Modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(
                Color(0xFF122D30),Color(0xFF0B1C2A))))
            .padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Surface(color=accent.copy(alpha=.12f),
                    shape=RoundedCornerShape(13.dp)) {
                    Icon(Icons.Default.CardGiftcard,null,tint=accent,
                        modifier=Modifier.padding(11.dp).size(21.dp))
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang,"DEPOSIT REWARD","پاداش واریز"),
                        color=Color.White,fontSize=11.sp,
                        fontWeight=FontWeight.Black)
                    Text(bonusDate(item.grantedAt),
                        color=Color(0xFFB3C9C8),fontSize=10.sp)
                }
                StatusLabel(item.status,lang)
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang,"Bonus amount","مبلغ بونوس"),
                        color=Color(0xFFADC7C6),fontSize=10.sp)
                    Text(money(item.amountMinor,item.currency),
                        color=Color.White,fontSize=18.sp,
                        maxLines=1,overflow=TextOverflow.Ellipsis,
                        fontWeight=FontWeight.Black)
                }
                Column(Modifier.weight(1f)) {
                    Text(tr(lang,"Remaining","باقی‌مانده"),
                        color=Color(0xFFADC7C6),fontSize=10.sp)
                    Text(money(item.remainingMinor,item.currency),
                        color=Color(0xFF75F1BE),fontSize=18.sp,
                        maxLines=1,overflow=TextOverflow.Ellipsis,
                        fontWeight=FontWeight.Black)
                }
            }
            LinearProgressIndicator(
                progress={fraction},
                modifier=Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                color=accent,trackColor=Color.White.copy(alpha=.12f))
            Surface(color=if(urgent)Color(0xFF49351F)
                else Color.White.copy(alpha=.055f),
                shape=RoundedCornerShape(13.dp)) {
                Row(Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Timer,null,
                        tint=if(urgent)Color(0xFFFFD18C) else accent,
                        modifier=Modifier.size(19.dp))
                    Spacer(Modifier.width(9.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang,"Time remaining","زمان باقی‌مانده"),
                            color=Color.White,fontSize=11.sp,
                            fontWeight=FontWeight.Bold)
                        Text(tr(lang,"24 hours from issuance","۲۴ ساعت پس از اعطا"),
                            color=Color(0xFFC6CBCD),fontSize=9.sp)
                    }
                    Text(bonusClockLabel(left),color=Color.White,
                        fontSize=14.sp,fontWeight=FontWeight.Black)
                }
            }
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(tr(lang,"4 picks · 1.60+ each","۴ انتخاب · ضریب هرکدام ۱٫۶۰+"),
                    color=Color(0xFFB2E4C8),fontSize=11.sp,
                    modifier=Modifier.weight(1f))
                TextButton(onClick=onDetail) {
                    Text(tr(lang,"Details","جزئیات"),
                        color=Color.White,fontWeight=FontWeight.Bold)
                    Icon(Icons.Default.ChevronRight,null,tint=Color.White)
                }
            }
            if(item.status=="active" && left>0L) {
                Button(onClick=onMatches,
                    shape=RoundedCornerShape(13.dp),
                    modifier=Modifier.fillMaxWidth(),
                    colors=ButtonDefaults.buttonColors(
                        containerColor=accent,contentColor=deep)) {
                    Icon(Icons.Default.SportsSoccer,null,
                        modifier=Modifier.size(18.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(tr(lang,"Explore football matches","مشاهده مسابقات فوتبال"),
                        fontWeight=FontWeight.Black,fontSize=12.sp)
                }
            }
        }
    }
}

private data class RuleInfo(val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val enTitle:String,val faTitle:String,val enBody:String,val faBody:String)
private val rules=listOf(
    RuleInfo(Icons.Default.AccountBalanceWallet,"100% deposit match","بونوس معادل واریز",
        "Each eligible successful deposit produces a separate matching reward after provider confirmation.",
        "هر واریز موفق واجد شرایط پس از تأیید درگاه، پاداش مستقل و معادل می‌گیرد."),
    RuleInfo(Icons.Default.Schedule,"24-hour limit","مهلت ۲۴ساعته",
        "The bonus expires 24 hours after its actual issuance time. Unused amounts do not carry forward.",
        "بونوس دقیقاً ۲۴ ساعت پس از زمان صدور منقضی می‌شود؛ مبلغ استفاده‌نشده منتقل نمی‌شود."),
    RuleInfo(Icons.Default.Layers,"Exactly four picks","دقیقاً چهار انتخاب",
        "One accumulator of exactly four selections. Every selection must have odds at least 1.60.",
        "یک شرط ترکیبی با دقیقاً چهار انتخاب؛ ضریب هر انتخاب به‌صورت جداگانه حداقل ۱٫۶۰ باشد."),
    RuleInfo(Icons.Default.Shield,"Full bonus stake","استفاده از کل مبلغ بونوس",
        "The stake must equal the full bonus balance and use the Bonus Account only. Cash cannot be combined.",
        "مبلغ شرط باید برابر کل مبلغ بونوس باشد و فقط از حساب بونوس استفاده شود؛ موجودی نقدی قابل ترکیب نیست."),
    RuleInfo(Icons.Default.EmojiEvents,"Win and loss policy","قانون برد و باخت",
        "A qualifying win credits only the original bonus to the Main Account, not the full accumulator payout. A loss does not credit cash.",
        "در صورت برد واجد شرایط، فقط اصل مبلغ بونوس به حساب اصلی می‌رود، نه کل برد میکس. باخت اعتبار نقدی ایجاد نمی‌کند.")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun RulesSheet(lang: Lang,onClose:()->Unit) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded=true)
    val scope = rememberCoroutineScope()
    val smoothClose: () -> Unit = { scope.launch { sheet.hide(); onClose() } }
    ModalBottomSheet(onDismissRequest=smoothClose,containerColor=Color(0xFFF8FAFA),
        sheetState=sheet) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
            .padding(horizontal=16.dp,vertical=17.dp),
            verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Rule,null,tint=blue,
                    modifier=Modifier.size(25.dp))
                Spacer(Modifier.width(10.dp))
                Text(tr(lang,"Complete bonus rules","شرایط کامل بونوس"),
                    color=ink,fontSize=20.sp,fontWeight=FontWeight.Black,
                    modifier=Modifier.weight(1f))
                IconButton(onClick=onClose) {
                    Icon(Icons.Default.Close,tr(lang,"Close","بستن"))
                }
            }
            rules.forEachIndexed { index,rule ->
                Surface(color=Color.White,shape=RoundedCornerShape(15.dp),
                    border=BorderStroke(1.dp,outline)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp),
                        verticalAlignment=Alignment.Top) {
                        Icon(rule.icon,null,tint=Color(0xFF098958),
                            modifier=Modifier.size(23.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f),
                            verticalArrangement=Arrangement.spacedBy(6.dp)) {
                            Text((index+1).toString()+". "+
                                tr(lang,rule.enTitle,rule.faTitle),
                                color=ink,fontWeight=FontWeight.Black,fontSize=13.sp)
                            Text(tr(lang,rule.enBody,rule.faBody),color=muted,
                                fontSize=12.sp,lineHeight=20.sp)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun BonusReceipt(item:BonusReward,lang:Lang,
    now:Long,onClose:()->Unit,onRules:()->Unit) {
    val clipboard=LocalClipboardManager.current
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded=true)
    val scope = rememberCoroutineScope()
    val smoothClose: () -> Unit = { scope.launch { sheet.hide(); onClose() } }
    ModalBottomSheet(onDismissRequest=smoothClose,containerColor=Color.White,
        sheetState=sheet) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
            .padding(horizontal=17.dp,vertical=16.dp),
            verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.ReceiptLong,null,tint=blue,
                    modifier=Modifier.size(24.dp))
                Spacer(Modifier.width(9.dp))
                Text(tr(lang,"Bonus receipt","رسید بونوس"),
                    color=ink,fontWeight=FontWeight.Black,
                    fontSize=19.sp,modifier=Modifier.weight(1f))
                StatusLabel(item.status,lang)
            }
            Surface(color=surface,shape=RoundedCornerShape(17.dp)) {
                Column(Modifier.fillMaxWidth().padding(14.dp),
                    verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    listOf(
                        tr(lang,"Original bonus","اصل بونوس") to money(item.amountMinor,item.currency),
                        tr(lang,"Remaining","مانده") to money(item.remainingMinor,item.currency),
                        tr(lang,"Issued","صدور") to bonusDate(item.grantedAt),
                        tr(lang,"Expires","انقضا") to bonusDate(item.expiresAt)
                    ).forEach { (label,value) ->
                        Row {
                            Text(label,color=muted,fontSize=11.sp,
                                modifier=Modifier.weight(1f))
                            Text(value,color=ink,fontSize=11.sp,
                                fontWeight=FontWeight.Black)
                        }
                    }
                }
            }
            if(item.isActive)
                Text(tr(lang,"Remaining time: ","زمان باقی‌مانده: ")+
                    bonusClockLabel(bonusMillisecondsLeft(item.expiresAt,now)),
                    color=Color(0xFF098958),fontWeight=FontWeight.Black,
                    fontSize=12.sp)
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(item.id.take(19)+"…",color=muted,
                    fontSize=11.sp,modifier=Modifier.weight(1f))
                TextButton(onClick={
                    clipboard.setText(AnnotatedString(item.id))
                }) {
                    Icon(Icons.Default.ContentCopy,null,modifier=Modifier.size(17.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(tr(lang,"Copy ID","کپی شناسه"))
                }
            }
            OutlinedButton(onClick=onRules,modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(13.dp)) {
                Icon(Icons.Default.Rule,null,modifier=Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp))
                Text(tr(lang,"Read all requirements","مشاهده همه شرایط"))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun PremiumBonusesPage(state:AppState,model:AppViewModel) {
    val lang=state.lang
    val context=LocalContext.current
    val api=remember { ApiClient() }
    val vault=remember { SessionVault(context) }
    val scope=rememberCoroutineScope()
    val accountCurrency=state.wallet?.currency
    val supported=remember(accountCurrency) {
        listOf(accountCurrency ?: "USD","USD","IRR").distinct()
            .filter { it in setOf("USD","IRR","IRT") }
    }
    var currency by rememberSaveable { mutableStateOf("USD") }
    var picked by rememberSaveable { mutableStateOf(false) }
    var pages by remember { mutableStateOf<Map<String,BonusCurrencyPage>>(emptyMap()) }
    var busy by remember { mutableStateOf(false) }
    var moreBusy by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var popupCurrency by remember { mutableStateOf(false) }
    var popupRules by remember { mutableStateOf(false) }
    var popupGrant by remember { mutableStateOf<BonusReward?>(null) }
    var historyStatus by rememberSaveable { mutableStateOf("all") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(accountCurrency,picked) {
        if(!picked) currency=supported.firstOrNull() ?: "USD"
    }
    suspend fun reload() {
        if(!state.signedIn) return
        busy=true
        errorMessage=null
        try {
            val jwt=vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            val result=mutableMapOf<String,BonusCurrencyPage>()
            supported.forEach { c -> result[c]=api.bonusCurrencyPage(jwt,c) }
            pages=result
        } catch (_:Exception) {
            errorMessage=tr(lang,
                "Could not fetch verified bonus balances. Please refresh.",
                "دریافت بونوس‌های تأییدشده ممکن نشد. دوباره تلاش کنید.")
        } finally { busy=false }
    }
    LaunchedEffect(state.signedIn,accountCurrency) {
        if(state.signedIn) reload()
        else { pages=emptyMap();errorMessage=null }
    }
    LaunchedEffect(Unit) {
        while(true) {
            now=System.currentTimeMillis()
            delay(1000L)
        }
    }
    val current=pages[currency]
    val active=current?.items?.filter { it.isActive }.orEmpty()
    val history=current?.items?.filter { !it.isActive && (historyStatus=="all" ||
        it.status==historyStatus) }.orEmpty()
    val soon=active.count {
        val left=bonusMillisecondsLeft(it.expiresAt,now)
        left in 1..(6L*3600*1000)
    }
    val promotion=current?.promotion ?: pages.values.firstOrNull()?.promotion
    LazyColumn(Modifier.fillMaxSize().background(surface),
        contentPadding=PaddingValues(horizontal=14.dp,vertical=14.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp), flingBehavior = rememberPremiumFlingBehavior()) {
        item {
            BonusHero(lang,promotion,onWallet={
                if(state.signedIn) model.tab(Tab.WALLET)
                else model.showLogin(true)
            },onRules={popupRules=true})
        }
        item {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(tr(lang,"Your bonus account","حساب بونوس شما"),
                        color=ink,fontSize=19.sp,fontWeight=FontWeight.Black)
                    Text(tr(lang,"Live grants and history","پاداش‌ها و تاریخچه واقعی"),
                        color=muted,fontSize=11.sp)
                }
                IconButton(onClick={scope.launch{reload()}},
                    enabled=state.signedIn && !busy) {
                    Icon(Icons.Default.Refresh,tr(lang,"Refresh","تازه‌سازی"),
                        tint=blue)
                }
            }
        }
        if(!state.signedIn) {
            item {
                LockedFeature(lang,
                    tr(lang,"Sign in to view your rewards",
                        "برای دیدن پاداش‌های حساب وارد شوید")) {
                    model.showLogin(true)
                }
            }
        } else {
            item {
                Surface(color=Color.White,shape=RoundedCornerShape(16.dp),
                    border=BorderStroke(1.dp,outline),
                    modifier=Modifier.fillMaxWidth().clickable { popupCurrency=true }) {
                    Row(Modifier.fillMaxWidth().padding(13.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Text(bonusFlag(currency),fontSize=24.sp)
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(tr(lang,"Bonus currency","ارز حساب بونوس"),
                                fontSize=10.sp,color=muted)
                            Text(if(currency=="USD") tr(lang,"US Dollar","دلار آمریکا")
                                else tr(lang,"Iranian Rial","ریال ایران"),
                                fontWeight=FontWeight.Black,color=ink,fontSize=13.sp)
                        }
                        Icon(Icons.Default.KeyboardArrowDown,null,tint=blue)
                    }
                }
            }
            if(busy) item {
                LinearProgressIndicator(Modifier.fillMaxWidth(),color=accent)
            }
            if(errorMessage!=null) item {
                Surface(color=Color(0xFFFFF0E9),shape=RoundedCornerShape(14.dp)) {
                    Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically) {
                        Text(errorMessage.orEmpty(),color=Color(0xFFAD5340),
                            fontSize=11.sp,modifier=Modifier.weight(1f))
                        TextButton(onClick={scope.launch{reload()}}) {
                            Text(tr(lang,"Retry","دوباره"))
                        }
                    }
                }
            }
            if(current!=null) {
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        StatCard(tr(lang,"Active","فعال"),
                            (current.summary.active+current.summary.locked).toString(),
                            Icons.Default.CardGiftcard,Color(0xFF06865B),
                            modifier=Modifier.weight(1f))
                        StatCard(tr(lang,"Available","مبلغ فعال"),
                            money(current.summary.activeAmountMinor,currency),
                            Icons.Default.AccountBalanceWallet,blue,
                            modifier=Modifier.weight(1f))
                        StatCard(tr(lang,"Expiring soon","نزدیک انقضا"),
                            soon.toString(),Icons.Default.HourglassBottom,
                            Color(0xFFD28F33),modifier=Modifier.weight(1f))
                    }
                }
                item {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Text(tr(lang,"Active rewards","پاداش‌های فعال"),
                            color=ink,fontSize=19.sp,fontWeight=FontWeight.Black,
                            modifier=Modifier.weight(1f))
                        Text((current.summary.active+current.summary.locked).toString(),
                            color=Color(0xFF008855),fontWeight=FontWeight.Black)
                    }
                }
                if(active.isEmpty()) item {
                    Surface(color=Color.White,shape=RoundedCornerShape(19.dp),
                        border=BorderStroke(1.dp,outline)) {
                        Column(Modifier.fillMaxWidth().padding(22.dp),
                            horizontalAlignment=Alignment.CenterHorizontally,
                            verticalArrangement=Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.CardGiftcard,null,tint=Color(0xFF0F9864),
                                modifier=Modifier.size(32.dp))
                            Text(tr(lang,"No active bonuses","فعلاً بونوس فعالی ندارید"),
                                color=ink,fontWeight=FontWeight.Black)
                            Text(tr(lang,"A new eligible deposit can unlock a separate reward.",
                                "واریز واجد شرایط بعدی می‌تواند بونوس مستقل فعال کند."),
                                color=muted,fontSize=11.sp,textAlign=TextAlign.Center)
                        }
                    }
                }
                items(active,key={it.id}) { reward ->
                    RewardCard(reward,lang,now,
                        onDetail={popupGrant=reward},
                        onMatches={model.tab(Tab.SPORTS)})
                }
                item {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Text(tr(lang,"Bonus history","تاریخچه بونوس‌ها"),
                            color=ink,fontSize=18.sp,fontWeight=FontWeight.Black,
                            modifier=Modifier.weight(1f))
                        Icon(Icons.Default.History,null,tint=blue)
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        listOf("all","won","lost","expired").forEach { f ->
                            FilterChip(selected=historyStatus==f,
                                onClick={historyStatus=f},shape=RoundedCornerShape(11.dp),
                                label={Text(when(f) {
                                    "won"->tr(lang,"Won","برد")
                                    "lost"->tr(lang,"Lost","باخت")
                                    "expired"->tr(lang,"Expired","منقضی")
                                    else->tr(lang,"All","همه")
                                },fontSize=10.sp)})
                        }
                    }
                }
                if(history.isEmpty()) item {
                    Surface(color=Color.White,shape=RoundedCornerShape(15.dp),
                        border=BorderStroke(1.dp,outline)) {
                        Text(tr(lang,"No recorded bonuses in this filter.",
                            "سابقه‌ای برای این فیلتر ثبت نشده است."),
                            color=muted,fontSize=12.sp,modifier=Modifier.padding(16.dp))
                    }
                }
                items(history,key={it.id}) { reward ->
                    Surface(color=Color.White,shape=RoundedCornerShape(16.dp),
                        border=BorderStroke(1.dp,outline),
                        modifier=Modifier.fillMaxWidth().clickable {popupGrant=reward}) {
                        Row(Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.ReceiptLong,null,tint=blue)
                            Spacer(Modifier.width(9.dp))
                            Column(Modifier.weight(1f)) {
                                Text(money(reward.amountMinor,reward.currency),
                                    color=ink,fontWeight=FontWeight.Black,fontSize=12.sp)
                                Text(bonusDate(reward.grantedAt),
                                    color=muted,fontSize=10.sp)
                            }
                            StatusLabel(reward.status,lang)
                        }
                    }
                }
                if(current.hasMore) item {
                    OutlinedButton(onClick={
                        if(!moreBusy) scope.launch {
                            moreBusy=true
                            try {
                                val token=vault.accessToken(api) ?:
                                    throw IllegalStateException("Sign in required")
                                val more=api.bonusCurrencyPage(token,currency,current.page+1)
                                pages=pages+(currency to more.copy(
                                    items=(current.items+more.items).distinctBy { it.id }))
                            } catch (_:Exception) {
                                errorMessage=tr(lang,"Older bonuses could not be loaded",
                                    "دریافت بونوس‌های قدیمی‌تر ممکن نشد")
                            } finally {moreBusy=false}
                        }
                    },modifier=Modifier.fillMaxWidth(),
                        enabled=!moreBusy,shape=RoundedCornerShape(14.dp)) {
                        if(moreBusy)
                            CircularProgressIndicator(Modifier.size(17.dp),strokeWidth=2.dp)
                        else Text(tr(lang,"Load more history","تاریخچه بیشتر"))
                    }
                }
            }
        }
        item {
            Surface(color=Color(0xFF142D36),shape=RoundedCornerShape(18.dp),
                modifier=Modifier.fillMaxWidth().clickable {popupRules=true}) {
                Row(Modifier.fillMaxWidth().padding(15.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Rule,null,tint=accent)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(tr(lang,"How the bonus works","قوانین بونوس"),
                            color=Color.White,fontWeight=FontWeight.Black,fontSize=13.sp)
                        Text(tr(lang,"4 picks · 1.60+ each · 24 hours",
                            "۴ انتخاب · هرکدام ۱٫۶۰+ · ۲۴ ساعت"),
                            color=Color(0xFFC3D3D4),fontSize=10.sp)
                    }
                    Icon(Icons.Default.ChevronRight,null,tint=accent)
                }
            }
        }
    }
    if(popupCurrency) {
        ModalBottomSheet(onDismissRequest={popupCurrency=false},
            containerColor=Color.White,
            sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true)) {
            Column(Modifier.fillMaxWidth().padding(horizontal=16.dp)
                .padding(bottom=24.dp),
                verticalArrangement=Arrangement.spacedBy(10.dp)) {
                Text(tr(lang,"Choose bonus currency","انتخاب ارز بونوس"),
                    color=ink,fontSize=19.sp,fontWeight=FontWeight.Black)
                supported.forEach { c ->
                    Surface(color=if(currency==c)Color(0xFFE9F8F0) else surface,
                        border=BorderStroke(1.dp,if(currency==c)accent else outline),
                        shape=RoundedCornerShape(14.dp),
                        modifier=Modifier.fillMaxWidth().clickable {
                            currency=c;picked=true;popupCurrency=false
                        }) {
                        Row(Modifier.fillMaxWidth().padding(14.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Text(bonusFlag(c),fontSize=24.sp)
                            Spacer(Modifier.width(10.dp))
                            Text(if(c=="USD")tr(lang,"US Dollar","دلار آمریکا")
                                else tr(lang,"Iranian Rial","ریال ایران"),
                                color=ink,fontWeight=FontWeight.Bold,
                                modifier=Modifier.weight(1f))
                            if(currency==c) Icon(Icons.Default.CheckCircle,null,tint=accent)
                        }
                    }
                }
            }
        }
    }
    popupGrant?.let { reward ->
        BonusReceipt(reward,lang,now,onClose={popupGrant=null},
            onRules={popupGrant=null;popupRules=true})
    }
    if(popupRules) RulesSheet(lang,onClose={popupRules=false})
}
