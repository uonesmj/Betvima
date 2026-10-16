package com.betvima.app.ui

import kotlinx.coroutines.launch

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.*

private val slipNavy = Color(0xFF0C1A2E)
private val slipBlue = Color(0xFF087FF5)
private val slipGreen = Color(0xFF00D47A)
private val slipPaper = Color(0xFFF6F8FB)
private val slipBorder = Color(0xFFE2E7EF)
private val slipText = Color(0xFF202C3C)
private val slipMuted = Color(0xFF7F8B9C)
// A single horizontal gradient across BOTH the grab handle and title header.
private val slipHeaderBrush = Brush.horizontalGradient(
    listOf(Color(0xFF0B2346), Color(0xFF0756AD))
)

/**
 * Compact text wordmark specifically for the bet slip. The former SVG put
 * "Bet" and "Vima" at fixed, widely separated x positions on narrow devices.
 * Compose paints a single word; the caller controls centering and contrast.
 */
@Composable
private fun SlipBrandWordmark(
    modifier: Modifier = Modifier,
    color: Color,
    fontSize: TextUnit,
    opacity: Float = 1f
) {
    Text(
        text = "Betvima",
        modifier = modifier,
        color = color.copy(alpha = opacity),
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.SansSerif,
        fontSize = fontSize,
        letterSpacing = 0.sp,
        lineHeight = (fontSize.value * 1.1f).sp,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Clip,
        textAlign = TextAlign.Center
    )
}

@Composable
private fun SlipPickCard(
    pick: Pick, lang: Lang, number: Int, onOpen: () -> Unit, onRemove: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, slipBorder),
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth().heightIn(min = SLIP_CARD_HEIGHT_DP.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onOpen)
                .padding(start = 10.dp,end = 7.dp,top = 9.dp,bottom = 9.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(width = 32.dp, height = 34.dp),
                color = slipBlue,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color(0xFF4DA9FF)),
                shadowElevation = 2.dp
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        number.toString(),
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        color = Color.White
                    )
                }
            }
            Spacer(Modifier.width(9.dp))
            // Three complete text baselines: the previous fixed 62dp height
            // clipped the market (third row) at the bottom of every card.
            Column(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    pick.match, color = slipMuted, fontSize = 10.sp,
                    lineHeight = 14.sp, maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    pick.selection, color = slipText, fontSize = 13.sp,
                    lineHeight = 18.sp, fontWeight = FontWeight.Black,
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        pick.market, color = slipMuted, fontSize = 11.sp,
                        lineHeight = 15.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f)
                    )
                    Icon(Icons.Default.ChevronRight, null, tint = slipBlue,
                        modifier = Modifier.size(14.dp))
                }
            }
            Spacer(Modifier.width(5.dp))
            Surface(color = Color(0xFFE8F8F0),shape = RoundedCornerShape(10.dp)) {
                Text(odds(pick.oddsScaled),color = Color(0xFF078955),
                    fontWeight = FontWeight.Black,fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 10.dp,vertical = 8.dp))
            }
            IconButton(onClick = onRemove,modifier = Modifier.size(29.dp)) {
                Icon(Icons.Default.Close,
                    tr(lang,"Remove","حذف"),tint = slipMuted,
                    modifier = Modifier.size(17.dp))
            }
        }
    }
}

@Composable
private fun SlipFundingRow(
    funding: String, lang: Lang, onSelect: (String) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp),
        modifier = Modifier.fillMaxWidth()) {
        listOf(
            Triple("main",tr(lang,"Main Account","حساب اصلی"),
                Icons.Default.AccountBalanceWallet),
            Triple("bonus",tr(lang,"Bonus Account","حساب بونوس"),
                Icons.Default.CardGiftcard)
        ).forEach { (id,label,icon) ->
            val current = funding == id
            val tone = if (id == "bonus") Color(0xFF8741BC) else slipBlue
            Surface(
                modifier = Modifier.weight(1f).height(43.dp).clickable { onSelect(id) },
                color = if (current) tone.copy(alpha = .095f) else Color(0xFFF3F6FA),
                border = BorderStroke(if (current) 1.4.dp else 1.dp,
                    if (current) tone else slipBorder),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    Modifier.fillMaxSize().padding(horizontal = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(icon,null,tint = if(current) tone else slipMuted,
                        modifier = Modifier.size(16.dp))
                    Text(label,fontSize = 11.sp,fontWeight = FontWeight.Black,
                        color = if(current) slipText else slipMuted,
                        maxLines = 1,overflow=TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f))
                    if(current) Icon(Icons.Default.CheckCircle,null,
                        tint=tone,modifier=Modifier.size(13.dp))
                }
            }
        }
    }
}

@Composable
private fun MainAccountSlipControls(
    state: AppState, model: AppViewModel, mode: String, compact: Boolean
) {
    val lang=state.lang
    val curr=state.wallet?.currency ?: "USD"
    var stake by rememberSaveable(curr) {
        mutableStateOf(if (curr in setOf("IRR", "IRT")) "10000" else "5.00")
    }
    val canQuote=state.picks.isNotEmpty() &&
        ((mode=="single" && state.picks.size==1) ||
            (mode=="multiple" && state.picks.size>=2))
    val review = state.mainBetReview
    val awaitingOddsAcceptance = review != null && review.changes.isNotEmpty() &&
        state.mainOddsAcceptedToken != review.quoteToken
    Column(Modifier.fillMaxWidth(),
        verticalArrangement=Arrangement.spacedBy(8.dp)) {
        if(state.picks.isNotEmpty()) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                OutlinedTextField(
                    value=stake,
                    onValueChange={
                        if(it.matches(Regex("[0-9]{0,10}(\\.[0-9]{0,2})?"))) {
                            stake=it
                            model.clearQuote()
                        }
                    },
                    singleLine=true,
                    label={Text(tr(lang,"Stake (" + curr + ")","مبلغ شرط (" + curr + ")"),fontSize=11.sp)},
                    modifier=Modifier.weight(1f),
                    shape=RoundedCornerShape(12.dp),
                    keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal)
                )
                Spacer(Modifier.width(12.dp))
                Column(horizontalAlignment=Alignment.End,
                    verticalArrangement=Arrangement.spacedBy(4.dp)) {
                    Text(tr(lang,"Official quote","استعلام رسمی"),
                        color=slipMuted,fontSize=10.sp)
                    Text(if(canQuote)state.quote ?: "—" else "—",
                        color=Color(0xFF087F53),fontWeight=FontWeight.Black,
                        fontSize=16.sp,maxLines=1)
                }
            }
            if (!compact) Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                (if (curr in setOf("IRR","IRT")) listOf("10000","50000","100000","200000")
                else listOf("1.00","5.00","10.00","20.00")).forEach { preset ->
                    Surface(
                        color=if(stake==preset)slipBlue else Color(0xFFF0F3F7),
                        shape=RoundedCornerShape(9.dp),
                        modifier=Modifier.weight(1f).height(31.dp).clickable {
                            stake=preset;model.clearQuote()
                        }
                    ) {
                        Box(contentAlignment=Alignment.Center) {
                            Text((if(curr=="USD") "$" else "") + preset.removeSuffix(".00"),
                                fontSize=11.sp,fontWeight=FontWeight.Black,
                                color=if(stake==preset)Color.White else slipText)
                        }
                    }
                }
            }
        }
        if (state.picks.isNotEmpty()) {
            val estimate = remember(stake, state.picks) {
                previewSlipWinnings(stake, state.picks)
            }
            if (estimate != null) {
                // When a live server quote exists, it overrides the illustrative
                // payout derived from current client odds. Neither is settlement.
                val officialPayout = state.quote
                    ?.removeSuffix(" USD")
                    ?.takeIf { it.matches(Regex("[0-9]+\\.[0-9]{2}")) }
                val possibleReturn = officialPayout ?: estimate.returnUsd
                val netProfit = remember(possibleReturn, estimate.stakeUsd) {
                    java.math.BigDecimal(possibleReturn)
                        .subtract(java.math.BigDecimal(estimate.stakeUsd))
                        .setScale(2, java.math.RoundingMode.HALF_UP)
                        .toPlainString()
                }
                Surface(
                    color = Color(0xFFF0F8F4),
                    shape = RoundedCornerShape(13.dp),
                    border = BorderStroke(1.dp, Color(0xFFCEEBDD)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(
                            horizontal = 9.dp, vertical = 7.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Column {
                                    Text(
                                        tr(lang, "Combined odds", "ضریب کل"),
                                        color = slipMuted, fontSize = 9.sp,
                                        maxLines = 1
                                    )
                                    Row(verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                        Text(
                                            estimate.combinedOdds,
                                            color = slipText,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 17.sp
                                        )
                                        Text(
                                            if (officialPayout != null)
                                                tr(lang, "Quote", "قطعی")
                                            else tr(lang, "Est.", "تخمین"),
                                            color = Color(0xFF218D64),
                                            fontSize = 8.sp,
                                            maxLines = 1
                                        )
                                    }
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            tr(lang, "Return", "بازگشت"),
                                            color = slipMuted, fontSize = 8.sp,
                                            maxLines = 1
                                        )
                                        Text(
                                            "$" + possibleReturn,
                                            color = slipText, fontSize = 14.sp,
                                            fontWeight = FontWeight.Black,
                                            maxLines = 1
                                        )
                                    }
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            tr(lang, "Profit", "سود خالص"),
                                            color = slipMuted, fontSize = 8.sp,
                                            maxLines = 1
                                        )
                                        Text(
                                            "$" + netProfit,
                                            color = Color(0xFF008752), fontSize = 14.sp,
                                            fontWeight = FontWeight.Black,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                            Box(
                                Modifier.width(1.dp).height(82.dp)
                                    .background(Color(0xFFCEE4DB))
                            )
                            SlipProbabilityInline(
                                state.picks, model, lang,
                                modifier = Modifier.weight(1.05f)
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Info, null,
                                tint = slipMuted, modifier = Modifier.size(11.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                tr(lang,
                                    "Includes stake · Market estimate, not a guarantee",
                                    "شامل اصل شرط · تخمین بازار، بدون تضمین"),
                                color = slipMuted, fontSize = 8.sp,
                                maxLines = 1, overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
        if (review != null && review.changes.isNotEmpty()) {
            Surface(color = Color(0xFFFFF4E5),shape = RoundedCornerShape(11.dp),
                border = BorderStroke(1.dp,Color(0xFFFFD4A1))) {
                Column(Modifier.fillMaxWidth().padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(tr(lang,"Odds changed — review before confirming:",
                        "ضرایب تغییر کرده‌اند؛ پیش از تأیید بررسی کنید:"),
                        fontSize=11.sp,fontWeight=FontWeight.Black,color=Color(0xFF8C5D23))
                    review.changes.forEach { change ->
                        val name=state.picks.find { it.selectionId==change.selectionId }
                            ?.selection ?: change.selectionId
                        val direction = mainOddsDirection(change)
                        Text(name + " · " + odds(change.beforeScaled) +
                            (if (direction == "UP") " ↑ " else if (direction == "DOWN") " ↓ " else " → ") +
                            odds(change.afterScaled),
                            fontSize=11.sp,fontWeight=FontWeight.Bold,
                            color=if (direction == "UP") Color(0xFF078955)
                                  else if (direction == "DOWN") Color(0xFFD14C64)
                                  else Color(0xFF8C5D23))
                    }
                }
            }
        }
        if (review != null && review.changes.isNotEmpty() &&
            state.mainOddsAcceptedToken == review.quoteToken) {
            Text(tr(lang,
                "New odds accepted. Placing a bet is a separate action.",
                "ضرایب جدید پذیرفته شدند. ثبت شرط یک اقدام جداگانه است."),
                color=Color(0xFF078955),fontSize=11.sp,fontWeight=FontWeight.Bold)
        }
        if (state.mainBetUncertain) {
            Text(tr(lang,
                "Bet status is uncertain. Check My Bets before any new submission.",
                "وضعیت شرط نامشخص است؛ پیش از ارسال مجدد، شرط‌های من را بررسی کنید."),
                color=Color(0xFFB03842),fontSize=11.sp,fontWeight=FontWeight.Bold)
        }
        Button(
            onClick={
                if(!state.signedIn) {
                    model.showSlip(false)
                    model.showLogin(true)
                } else if(awaitingOddsAcceptance) {
                    model.acceptMainOddsChanges(stake)
                } else if(review != null &&
                    com.betvima.app.BuildConfig.ENABLE_WAGERING) {
                    model.placeMainBet(stake)
                } else if(review == null) {
                    model.quote(stake)
                }
            },
            enabled=canQuote && !state.busy && !state.mainBetUncertain &&
                (review == null || awaitingOddsAcceptance ||
                    com.betvima.app.BuildConfig.ENABLE_WAGERING),
            modifier=Modifier.fillMaxWidth().height(47.dp),
            shape=RoundedCornerShape(13.dp),
            colors=ButtonDefaults.buttonColors(
                containerColor=slipGreen,contentColor=slipNavy)
        ) {
            if(state.busy) {
                CircularProgressIndicator(Modifier.size(16.dp),strokeWidth=2.dp,
                    color=slipNavy)
            } else Icon(Icons.Default.CheckCircle,null,modifier=Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
            Text(when {
                !state.signedIn -> tr(lang,"Login to bet","ورود برای شرط")
                awaitingOddsAcceptance ->
                    tr(lang,"Accept new odds (no bet yet)","پذیرش ضریب جدید (بدون ثبت شرط)")
                review != null && !com.betvima.app.BuildConfig.ENABLE_WAGERING ->
                    tr(lang,"Wagering not authorized","ثبت شرط غیرفعال است")
                review != null -> tr(lang,"Place bet with approved odds","ثبت شرط با ضریب تأییدشده")
                else -> tr(lang,"Get official quote","دریافت استعلام رسمی")
            },fontWeight=FontWeight.Black,fontSize=12.sp)
        }
        if (!compact) Text(tr(lang,
            if(com.betvima.app.BuildConfig.ENABLE_WAGERING)
                "A server-signed quote is required. Funds move only after explicit confirmation."
            else "Main Account: quote preview only until licensed real-money operation is enabled."
            ,if(com.betvima.app.BuildConfig.ENABLE_WAGERING)
                "ثبت شرط فقط پس از استعلام رسمی سرور و تأیید شما انجام می‌شود."
            else "حساب اصلی: صرفاً استعلام، تا زمان تأیید فعال‌سازی شرط با پول واقعی."),
            color=slipMuted,fontSize=9.sp,lineHeight=13.sp,maxLines=2)
    }
}

/**
 * Single continuous list: the first five picks expand the sheet; the sixth
 * pick and onwards scroll within a five-card viewport. No page arrows.
 */
@Composable
private fun SlipPickList(
    state: AppState,
    model: AppViewModel,
) {
    val listState = rememberLazyListState()
    var oldCount by remember { mutableIntStateOf(state.picks.size) }
    LaunchedEffect(state.picks.size) {
        if (state.picks.size > oldCount &&
            state.picks.size > SLIP_VISIBLE_PICK_LIMIT) {
            listState.animateScrollToItem(state.picks.lastIndex)
        }
        oldCount = state.picks.size
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
        // If accessibility font scale or a small screen causes overflow before
        // five selections, the content must still remain reachable.
        userScrollEnabled = true,
        contentPadding = PaddingValues(horizontal = 13.dp, vertical = 5.dp),
        verticalArrangement = Arrangement.spacedBy(SLIP_CARD_SPACING_DP.dp)
    , flingBehavior = rememberPremiumFlingBehavior()) {
        itemsIndexed(state.picks, key = { _, pick -> pick.selectionId }) { index, pick ->
            SlipPickCard(pick, state.lang, index + 1,
                onOpen = { model.openPickMarket(pick) },
                onRemove = { model.removePick(pick.selectionId) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumSlipSheet(state: AppState,model: AppViewModel) {
    val lang=state.lang
    val config=LocalConfiguration.current
    val viewport=config.screenHeightDp.dp
    // Leave only a narrow status-bar gap; the whole slip must fit above the
    // navigation inset even with two selected cards and its action controls.
    val maxSheet=viewport*.96f
    var funding by rememberSaveable { mutableStateOf("main") }
    var mode by rememberSaveable { mutableStateOf("single") }
    LaunchedEffect(state.signedIn) {
        if (state.signedIn) model.refreshAccount()
    }
    // The chart is embedded in Combined Odds, never above the selected markets.
    val listHeight = slipPickAreaHeightDp(state.picks.size).dp
    LaunchedEffect(state.picks.size,funding) {
        val expected = if(funding=="bonus" || state.picks.size>1)
            "multiple" else "single"
        if(mode!=expected) {
            mode=expected
            model.clearQuote()
        }
    }
    val sheet=rememberModalBottomSheetState(skipPartiallyExpanded=true)
    val closeScope = rememberCoroutineScope()
    val animatedDismiss: () -> Unit = {
        closeScope.launch {
            sheet.hide()
            model.showSlip(false)
        }
    }
    ModalBottomSheet(
        onDismissRequest=animatedDismiss,
        sheetState=sheet,
        dragHandle={
            Box(Modifier.fillMaxWidth().background(slipHeaderBrush)) {
                Box(Modifier.fillMaxWidth().height(18.dp),
                    contentAlignment=Alignment.Center) {
                    Box(Modifier.size(width=34.dp,height=4.dp)
                        .clip(CircleShape).background(Color.White.copy(alpha=.36f)))
                }
            }
        },
        contentWindowInsets={WindowInsets(0,0,0,0)},
        containerColor=Color.White,
        shape=RoundedCornerShape(topStart=23.dp,topEnd=23.dp)
    ) {
        Column(
            modifier=Modifier.fillMaxWidth().heightIn(max=maxSheet).imePadding()
        ) {
            Column(
                modifier = Modifier.fillMaxWidth()
                    .background(slipHeaderBrush)
                    .padding(bottom = 3.dp)
            ) {
                Row(
                    Modifier.fillMaxWidth()
                        .padding(horizontal = 13.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = animatedDismiss,
                        modifier = Modifier.size(33.dp)
                    ) {
                        Icon(
                            Icons.Default.KeyboardArrowDown,
                            tr(lang, "Close", "بستن"),
                            tint = Color.White
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            tr(lang, "BETSLIP", "برگه پیش‌بینی"),
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            fontSize = 13.sp,
                            letterSpacing = .25.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            tr(lang, "Your prediction slip", "برگه پیش‌بینی شما"),
                            fontSize = 10.sp,
                            color = Color(0xFFC7D5E4),
                            maxLines = 1
                        )
                    }
                    Spacer(Modifier.width(5.dp))
                    Surface(
                        color = slipGreen.copy(alpha = .15f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, slipGreen.copy(alpha = .37f))
                    ) {
                        Row(
                            Modifier.widthIn(max = 153.dp)
                                .padding(horizontal = 9.dp, vertical = 7.dp),
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.AccountBalanceWallet,
                                contentDescription = null,
                                tint = Color(0xFF9CF8CE),
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                when {
                                    !state.signedIn -> tr(lang, "Sign in", "ورود")
                                    state.wallet == null -> tr(lang, "Loading…", "در حال بارگذاری…")
                                    else -> money(
                                        state.wallet.availableMinor,
                                        state.wallet.currency
                                    )
                                },
                                color = Color(0xFFDEFFEF),
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                // A dedicated centered row prevents the wordmark from sitting behind
                // the balance pill or getting cropped on narrow phone screens.
                // One compact, centered brand line, independent of the balance width.
                Box(
                    Modifier.fillMaxWidth().height(27.dp),
                    contentAlignment = Alignment.Center
                ) {
                    SlipBrandWordmark(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFFD2D6DE),
                        fontSize = 22.sp
                    )
                }
            }
            Column(
                modifier=Modifier.fillMaxWidth().padding(
                    start=13.dp,end=13.dp,top=10.dp,bottom=6.dp),
                verticalArrangement=Arrangement.spacedBy(7.dp)
            ) {
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).background(
                        Color(0xFFF0F3F7),RoundedCornerShape(12.dp))
                        .padding(3.dp),
                        horizontalArrangement=Arrangement.spacedBy(2.dp)) {
                        listOf(
                            "single" to tr(lang,"Single","تکی"),
                            "multiple" to tr(lang,"Multiple","میکس"),
                            "series" to tr(lang,"Series","سیستمی")
                        ).forEach { (id,text) ->
                            val active=mode==id
                            val allowed=id!="series" &&
                                (funding!="bonus" || id=="multiple")
                            Surface(
                                color=if(active)slipBlue else Color.Transparent,
                                shape=RoundedCornerShape(9.dp),
                                modifier=Modifier.weight(1f).height(36.dp)
                                    .clickable(enabled=allowed) {
                                        mode=id
                                        model.clearQuote()
                                    }
                            ) {
                                Box(contentAlignment=Alignment.Center) {
                                    Text(text,fontSize=11.sp,
                                        fontWeight=FontWeight.Black,
                                        color=if(active)Color.White
                                            else if(allowed)slipText else slipMuted,
                                        maxLines=1)
                                }
                            }
                        }
                    }
                    Surface(color=Color(0xFFF0F3F7),
                        shape=RoundedCornerShape(11.dp),
                        modifier=Modifier.size(42.dp).clickable{
                            model.clearPicks()
                        }) {
                        Box(contentAlignment=Alignment.Center) {
                            Icon(Icons.Default.DeleteOutline,
                                tr(lang,"Clear slip","پاک‌کردن برگه"),
                                tint=slipMuted,modifier=Modifier.size(19.dp))
                        }
                    }
                }
                SlipFundingRow(funding,lang) { next ->
                    funding=next
                    if(next=="bonus") mode="multiple"
                    model.clearQuote()
                }
                BetSlipShareActions(state,model)
            }
            // A weighted viewport reserves space for the fixed quote/submit area.
            // On normal phones it grows naturally to five cards; on exceptionally
            // small viewports it can shrink without clipping inaccessible picks.
            Box(
                modifier = Modifier.fillMaxWidth()
                    .weight(1f, fill = false)
                    .heightIn(max = listHeight)
            ) {
                if (state.picks.isEmpty()) {
                    Box(Modifier.fillMaxSize()) {
                        SlipBrandWordmark(
                            modifier = Modifier.align(Alignment.Center).fillMaxWidth(),
                            color = Color(0xFF9CA3AF),
                            fontSize = 46.sp,
                            opacity = .24f
                        )
                        Row(
                            Modifier.fillMaxSize().padding(horizontal = 17.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(Icons.Default.SportsSoccer, null, tint = slipBlue,
                                modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                tr(lang, "Pick a match to start a prediction.",
                                    "برای شروع، یک مسابقه را انتخاب کنید."),
                                color = slipMuted, fontSize = 11.sp
                            )
                        }
                    }
                } else {
                    SlipPickList(state, model)
                }
            }
            HorizontalDivider(color=slipBorder)
            // Cash stake/quote controls stay fixed. Bonus details retain
            // a bounded scroll only when required by small displays.
            Column(
                Modifier.fillMaxWidth()
                    .then(if (funding == "bonus") {
                        Modifier.heightIn(max = viewport * .37f)
                            .verticalScroll(rememberScrollState(), flingBehavior = rememberPremiumFlingBehavior())
                    } else Modifier)
                    .background(Color.White)
                    .navigationBarsPadding()
                    .padding(horizontal=14.dp,vertical=10.dp),
                verticalArrangement=Arrangement.spacedBy(6.dp)
            ) {
                if(funding=="bonus") {
                    BonusAccountSlip(state,model)
                } else {
                    MainAccountSlipControls(
                        state, model, mode,
                        compact = config.screenHeightDp < 750 ||
                            state.picks.size >= 3
                    )
                }
            }
        }
    }
}
