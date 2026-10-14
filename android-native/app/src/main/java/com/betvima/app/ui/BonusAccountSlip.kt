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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import com.betvima.app.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

private val slipPurple = Color(0xFF8E39BA)
private val slipGreen = Color(0xFF00D47A)
private val slipInk = Color(0xFF182637)
private val slipMuted = Color(0xFF758299)

internal fun bonusSlipMessage(reason: String, lang: Lang): String = when(reason) {
    "select_bonus" -> tr(lang,"Choose an available bonus.","یک بونوس فعال انتخاب کنید.")
    "bonus_not_active" -> tr(lang,"This bonus is no longer available.","این بونوس دیگر فعال نیست.")
    "currency_mismatch" -> tr(lang,"The bonus currency must match your account.","ارز بونوس با ارز حساب یکسان نیست.")
    "bonus_empty" -> tr(lang,"This bonus has no available balance.","بونوس مانده قابل استفاده ندارد.")
    "bonus_expired" -> tr(lang,"This bonus has expired.","مهلت بونوس به پایان رسیده است.")
    "exact_four" -> tr(lang,"Choose exactly four picks from four different matches.",
        "دقیقاً چهار انتخاب از چهار مسابقه متفاوت لازم است.")
    "min_odds", "min_odds_or_invalid_change" -> tr(lang,
        "Each pick must have odds of at least 1.60. Review changed odds.",
        "ضریب هر انتخاب باید حداقل ۱٫۶۰ باشد. ضرایب تغییرکرده را بررسی کنید.")
    "stake_changed" -> tr(lang,"Bonus balance changed. Refresh and quote again.",
        "مانده بونوس تغییر کرده؛ تازه‌سازی و استعلام مجدد لازم است.")
    "quote_expired" -> tr(lang,"This quote expired. Request a new one.",
        "اعتبار استعلام تمام شده؛ مجدداً استعلام بگیرید.")
    else -> tr(lang,"Refresh the bonus and verify your selections.",
        "بونوس را تازه‌سازی و انتخاب‌ها را بررسی کنید.")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BonusAccountSlip(state: AppState, model: AppViewModel) {
    val lang = state.lang
    val context = LocalContext.current
    val api = remember { ApiClient() }
    val vault = remember { SessionVault(context) }
    val scope = rememberCoroutineScope()
    val currency = state.wallet?.currency?.takeIf { it in listOf("USD","IRR","IRT") }
    var grants by remember(currency) { mutableStateOf<List<BonusReward>>(emptyList()) }
    var chosenId by remember(currency) { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var review by remember { mutableStateOf<BonusPlacementQuote?>(null) }
    var reviewContext by remember { mutableStateOf<String?>(null) }
    var picker by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var ambiguous by remember { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    // The server currency must match the customer's actual wallet currency.
    // Never silently convert a wager's stake, quote, or bonus grant.
    suspend fun refreshGrants(): List<BonusReward> {
        if (currency == null) {
            loading = false
            return emptyList()
        }
        loading = true
        return try {
            val token = vault.accessToken(api) ?: throw IllegalStateException("Sign in required")
            val page = api.bonusCurrencyPage(token, currency)
            val fresh = page.items.filter {
                it.currency == currency && it.status == "active" &&
                    (it.remainingMinor.toLongOrNull() ?: 0L) > 0 &&
                    bonusMillisecondsLeft(it.expiresAt, System.currentTimeMillis()) > 0
            }
            grants = fresh
            if (fresh.none { it.id == chosenId }) chosenId = fresh.firstOrNull()?.id
            errorMessage = null
            fresh
        } catch (_: Exception) {
            errorMessage = tr(lang,
                "Cannot verify available bonuses. Check your connection and retry.",
                "بونوس‌های قابل استفاده تأیید نشدند؛ اتصال را بررسی و دوباره تلاش کنید.")
            grants = emptyList()
            chosenId = null
            emptyList()
        } finally { loading = false }
    }
    LaunchedEffect(state.signedIn,currency) {
        grants = emptyList()
        chosenId = null
        review = null
        ambiguous = false
        if (state.signedIn) refreshGrants()
        else loading = false
    }
    LaunchedEffect(Unit) {
        while(true) { delay(1000); now = System.currentTimeMillis() }
    }

    val grant = grants.firstOrNull { it.id == chosenId }
    val fingerprint = grant?.let { bonusSlipIdentity(state.picks,it) }
    LaunchedEffect(fingerprint) {
        if (reviewContext != null && fingerprint != reviewContext) {
            review = null
            reviewContext = null
        }
    }
    val invalid = validateBonusSlip(state.picks,grant,currency ?: "",now)

    Column(Modifier.fillMaxWidth(), verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically) {
            Icon(Icons.Default.CardGiftcard,null,tint=slipPurple,
                modifier=Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(tr(lang,"Bonus Account","حساب بونوس"),
                color=slipInk,fontSize=13.sp,fontWeight=FontWeight.Black,
                modifier=Modifier.weight(1f))
            TextButton(onClick={scope.launch{refreshGrants()}},enabled=!loading && !busy) {
                Icon(Icons.Default.Refresh,null,modifier=Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(tr(lang,"Refresh","تازه‌سازی"),fontSize=10.sp)
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(),
            color=slipPurple)
        Surface(shape=RoundedCornerShape(14.dp),
            color=Color(0xFFF8F2FC),
            border=BorderStroke(1.dp,Color(0xFFE5CFED)),
            modifier=Modifier.fillMaxWidth().clickable(enabled=!busy && !loading) {
                picker=true
            }) {
            Row(Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.AccountBalanceWallet,null,tint=slipPurple,
                    modifier=Modifier.size(21.dp))
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(tr(lang,"Select available bonus","انتخاب بونوس قابل استفاده"),
                        fontSize=10.sp,color=slipMuted)
                    Text(if(grant!=null) money(grant.remainingMinor,grant.currency)
                        else tr(lang,"No verified bonus","بونوس تأییدشده موجود نیست"),
                        fontSize=15.sp,fontWeight=FontWeight.Black,color=slipInk)
                    if(grant!=null)
                        Text(
                            tr(lang,"Expires in ","مهلت باقی‌مانده: ")+
                                bonusClockLabel(bonusMillisecondsLeft(grant.expiresAt,now)),
                            color=slipPurple,fontSize=10.sp)
                }
                Icon(Icons.Default.KeyboardArrowDown,null,tint=slipPurple)
            }
        }
        Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFF6F7FA),
            border=BorderStroke(1.dp,Color(0xFFE1E6EB))) {
            Text(tr(lang,
                "Accumulator only · exactly 4 matches · odds 1.60+ each · stake equals the entire bonus. A win credits only the original bonus amount, not the full odds payout.",
                "فقط میکس ۴ مسابقه متفاوت · ضریب هر انتخاب حداقل ۱٫۶۰ · مبلغ شرط برابر تمام بونوس. در صورت برد فقط اصل بونوس به حساب اصلی می‌رود، نه کل پرداخت میکس."),
                modifier=Modifier.fillMaxWidth().padding(10.dp),
                fontSize=10.sp,lineHeight=16.sp,color=slipMuted)
        }
        if(invalid!=null && state.picks.isNotEmpty()) {
            Text(bonusSlipMessage(invalid,lang),color=Color(0xFFC44659),
                fontSize=11.sp,fontWeight=FontWeight.Bold)
        }
        if(errorMessage!=null || ambiguous) {
            Surface(color=Color(0xFFFFF1ED),shape=RoundedCornerShape(11.dp)) {
                Text(errorMessage ?: tr(lang,
                    "Bet result uncertain. Check My Bets before any new submission.",
                    "نتیجه شرط نامشخص است؛ پیش از هر ارسال جدید، My Bets را بررسی کنید."),
                    modifier=Modifier.padding(11.dp),fontSize=11.sp,
                    color=Color(0xFFAA4A38))
            }
        }
        Button(
            onClick={
                if(busy || ambiguous || invalid!=null || grant==null) return@Button
                scope.launch {
                    busy=true
                    review=null
                    errorMessage=null
                    try {
                        // Recheck the same server grant immediately before pricing.
                        val refreshed = refreshGrants().firstOrNull { it.id==grant.id }
                        if(refreshed==null) {
                            errorMessage=bonusSlipMessage("bonus_not_active",lang)
                        } else {
                            val reason=validateBonusSlip(state.picks,refreshed,
                                currency ?: "",System.currentTimeMillis())
                            if(reason!=null) errorMessage=bonusSlipMessage(reason,lang)
                            else {
                                val token=vault.accessToken(api)
                                    ?: throw IllegalStateException("Session expired")
                                val picks=state.picks.toList()
                                val signed=api.bonusBetQuote(token,picks,refreshed)
                                val quoteError=validateBonusQuote(
                                    signed,picks,refreshed,System.currentTimeMillis())
                                if(quoteError!=null)
                                    errorMessage=bonusSlipMessage(quoteError,lang)
                                else if(picks!=state.picks)
                                    errorMessage=tr(lang,
                                        "Selections changed during pricing. Request a fresh quote.",
                                        "انتخاب‌ها هنگام استعلام تغییر کردند؛ استعلام جدید بگیرید.")
                                else {
                                    reviewContext=bonusSlipIdentity(picks,refreshed)
                                    review=signed
                                }
                            }
                        }
                    } catch(e:Exception) {
                        errorMessage=tr(lang,
                            "Official quote unavailable. Please retry.",
                            "دریافت استعلام معتبر ممکن نشد؛ دوباره تلاش کنید.")
                    } finally { busy=false }
                }
            },
            enabled=invalid==null && !busy && !loading && !ambiguous &&
                state.signedIn && grant!=null,
            modifier=Modifier.fillMaxWidth().height(47.dp),
            shape=RoundedCornerShape(13.dp),
            colors=ButtonDefaults.buttonColors(
                containerColor=slipPurple,contentColor=Color.White)
        ) {
            if(busy) CircularProgressIndicator(Modifier.size(17.dp),
                strokeWidth=2.dp,color=Color.White)
            else Icon(Icons.Default.FactCheck,null,modifier=Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
            Text(tr(lang,"Review bonus bet","بررسی و تأیید شرط بونوسی"),
                fontSize=12.sp,fontWeight=FontWeight.Black)
        }
    }

    if(picker) {
        AlertDialog(
            onDismissRequest={picker=false},
            title={Text(tr(lang,"Select Bonus Account","انتخاب حساب بونوس"),
                fontWeight=FontWeight.Black)},
            text={
                if(grants.isEmpty()) {
                    Text(tr(lang,
                        "No active bonus exists for the current wallet currency.",
                        "برای ارز فعلی حساب، بونوس فعالی وجود ندارد."))
                } else {
                    LazyColumn(Modifier.heightIn(max=340.dp),
                        verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        items(grants,key={it.id}) { option ->
                            Surface(
                                modifier=Modifier.fillMaxWidth().clickable {
                                    chosenId=option.id
                                    review=null; reviewContext=null
                                    errorMessage=null;picker=false
                                },
                                color=if(option.id==chosenId)Color(0xFFF4E6FF)
                                    else Color(0xFFF5F7F9),
                                shape=RoundedCornerShape(13.dp),
                                border=BorderStroke(1.dp,
                                    if(option.id==chosenId)slipPurple
                                    else Color(0xFFE1E6E9))
                            ) {
                                Row(Modifier.padding(12.dp),
                                    verticalAlignment=Alignment.CenterVertically) {
                                    Icon(Icons.Default.CardGiftcard,null,tint=slipPurple)
                                    Spacer(Modifier.width(9.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(money(option.remainingMinor,option.currency),
                                            color=slipInk,fontWeight=FontWeight.Black)
                                        Text(tr(lang,"Expires in ","انقضا تا: ")+
                                            bonusClockLabel(bonusMillisecondsLeft(
                                                option.expiresAt,now)),
                                            color=slipMuted,fontSize=11.sp)
                                    }
                                    if(option.id==chosenId)
                                        Icon(Icons.Default.CheckCircle,null,tint=slipPurple)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton={
                TextButton(onClick={picker=false}) {
                    Text(tr(lang,"Done","تأیید"))
                }
            }
        )
    }

    review?.let { quote ->
        val currentGrant = grants.firstOrNull { it.id==chosenId }
        val same = currentGrant!=null &&
            reviewContext==bonusSlipIdentity(state.picks,currentGrant)
        val reason=if(currentGrant==null) "select_bonus" else
            validateBonusQuote(quote,state.picks,currentGrant,now)
        AlertDialog(
            onDismissRequest={if(!busy) review=null},
            icon={Icon(Icons.Default.VerifiedUser,null,tint=slipPurple)},
            title={Text(tr(lang,"Confirm bonus-funded bet","تأیید نهایی شرط بونوسی"),
                fontWeight=FontWeight.Black)},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
                    Text(tr(lang,"Funding: Bonus Account","حساب پرداخت: بونوس"),
                        fontSize=13.sp,fontWeight=FontWeight.Bold,color=slipPurple)
                    Text(tr(lang,"Stake: ","مبلغ شرط: ")+
                        (currentGrant?.let { money(it.remainingMinor,it.currency) } ?: "—"),
                        fontWeight=FontWeight.Black)
                    Text(tr(lang,"4 selections · combined odds ",
                        "۴ انتخاب · ضریب ترکیبی ")+odds(quote.combinedOddsScaled))
                    Text(tr(lang,
                        "On a qualifying win, only your original bonus amount is credited to your Main Account.",
                        "در صورت برد واجد شرایط، فقط اصل بونوس به حساب اصلی اضافه می‌شود."),
                        fontSize=11.sp,color=slipMuted)
                    if(quote.movements.isNotEmpty()) {
                        Surface(shape=RoundedCornerShape(10.dp),
                            color=Color(0xFFFFF3E8)) {
                            Column(Modifier.padding(10.dp)) {
                                Text(tr(lang,
                                    "Odds changed. Confirm these new prices explicitly:",
                                    "ضرایب تغییر کرده‌اند؛ قیمت‌های جدید را صریحاً تأیید کنید:"),
                                    color=Color(0xFF925A19),fontSize=11.sp,
                                    fontWeight=FontWeight.Black)
                                quote.movements.forEach { change ->
                                    Text(odds(change.previousScaled)+" → "+
                                        odds(change.currentScaled),fontSize=12.sp,
                                        color=Color(0xFF925A19),
                                        fontWeight=FontWeight.Bold)
                                }
                            }
                        }
                    }
                    if(reason!=null || !same)
                        Text(bonusSlipMessage(reason ?: "stake_changed",lang),
                            color=Color(0xFFC14154),fontSize=11.sp)
                }
            },
            confirmButton={
                Button(
                    onClick={
                        if(busy || !same || reason!=null || currentGrant==null) return@Button
                        scope.launch {
                            busy=true
                            errorMessage=null
                            val frozenPicks=state.picks.toList()
                            val frozenGrant=currentGrant
                            val identifier=UUID.randomUUID().toString()
                            try {
                                val token=vault.accessToken(api)
                                    ?: throw IllegalStateException("Session expired")
                                // Recheck freshness and slip fingerprint at the
                                // final user-confirmed mutation boundary.
                                require(
                                    bonusSlipIdentity(state.picks,frozenGrant)==reviewContext &&
                                    validateBonusQuote(quote,state.picks,frozenGrant,
                                        System.currentTimeMillis())==null
                                ) { "Selection changed" }
                                val result=api.placeBonusBet(token,frozenPicks,
                                    frozenGrant,quote,identifier)
                                val bet=result.optJSONObject("bet")
                                    ?: throw IllegalStateException("Bet receipt missing")
                                review=null
                                model.clearPicks()
                                model.showSlip(false)
                                model.refreshAccount()
                                model.refreshBetHistory()
                                model.notice(tr(lang,
                                    "Bonus bet accepted: ","شرط بونوسی ثبت شد: ")+
                                    bet.str("publicId",bet.str("id")).take(28))
                            } catch(e:Exception) {
                                review=null
                                // A definite 4xx rejection is not an accepted
                                // wager. Any transport error is ambiguous: lock
                                // re-submission and direct customer to bet history.
                                val definite=(e as? ApiFailure)?.code in
                                    setOf(400,401,403,404,409,410,422)
                                ambiguous=!definite
                                errorMessage=if(definite)
                                    tr(lang,
                                        "The server rejected the wager. Check prices and bonus balance, then request a fresh quote.",
                                        "سرور شرط را نپذیرفت. ضرایب و مانده بونوس را بررسی و مجدداً استعلام کنید.")
                                else tr(lang,
                                    "Wager status is unknown. Do not place it again before checking My Bets or Support.",
                                    "نتیجه شرط نامشخص است. تا بررسی My Bets یا پشتیبانی، آن را دوباره ثبت نکنید.")
                            } finally { busy=false }
                        }
                    },
                    enabled=!busy && same && reason==null,
                    colors=ButtonDefaults.buttonColors(containerColor=slipPurple)
                ) {
                    if(busy) CircularProgressIndicator(Modifier.size(16.dp),
                        strokeWidth=2.dp,color=Color.White)
                    else Text(if(quote.movements.isEmpty())
                        tr(lang,"Confirm & place bet","تأیید و ثبت شرط")
                    else tr(lang,"Accept odds & place","تأیید ضرایب و ثبت شرط"))
                }
            },
            dismissButton={
                TextButton(onClick={review=null},enabled=!busy) {
                    Text(tr(lang,"Cancel","انصراف"))
                }
            }
        )
    }
}
